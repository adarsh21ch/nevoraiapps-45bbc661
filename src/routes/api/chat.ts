/**
 * NevorAI streaming chat endpoint.
 *
 * The Owner AI panel talks to this route via the AI SDK `useChat` hook.
 * Every call:
 *   1. Verifies the caller's Supabase JWT (bearer header — attached by the
 *      client from `supabase.auth.getSession()`).
 *   2. Loads their profile + tenant + subscription for the AIContext.
 *   3. Builds the tool bag from the NevorAI Core registry (role-scoped).
 *   4. Streams the model response back through `streamText`.
 *   5. Persists the assistant turn to `ai_conversation_turns` on finish.
 *
 * Reuses:
 *   - NevorAI Core tool + agent registries (Phase 11.0/11.3)
 *   - Supabase persistence tables (Phase 11.2)
 */

import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
} from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createNevorAIProvider, NEVORAI_DEFAULT_MODEL } from "@/lib/nevorai-provider.server";
import { buildContext, defaultPromptFor } from "@/lib/ai-os";
import { buildToolBag } from "@/lib/nevorai/tools-adapter.server";
import { bootstrapNevorAI } from "@/lib/ai-os/bootstrap.server";

type ChatRequestBody = {
  messages?: UIMessage[];
  conversationId?: string;
};

function supabaseFetchShim(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (
      (supabaseKey.startsWith("sb_publishable_") || supabaseKey.startsWith("sb_secret_")) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ------------------ auth ------------------
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Missing Supabase env", { status: 500 });
        }
        if (!LOVABLE_API_KEY) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const authed = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false },
          global: {
            fetch: supabaseFetchShim(SUPABASE_PUBLISHABLE_KEY),
            headers: { Authorization: `Bearer ${token}` },
          },
        });

        const { data: userRes, error: userErr } = await authed.auth.getUser(token);
        if (userErr || !userRes?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userRes.user.id;

        const { data: profile } = await authed
          .from("profiles")
          .select("tenant_id, role")
          .eq("user_id", userId)
          .maybeSingle();
        if (!profile?.tenant_id) return new Response("No tenant", { status: 403 });

        // ------------------ context ------------------
        const { data: tenant } = await authed
          .from("tenants")
          .select("id, slug, name, status, subscription_status, features")
          .eq("id", profile.tenant_id)
          .maybeSingle();

        const role = (profile.role as
          | "owner"
          | "admin"
          | "coach"
          | "parent"
          | "student"
          | "platform_admin") ?? "owner";

        const ctx = buildContext({
          tenantId: profile.tenant_id,
          tenantSlug: tenant?.slug ?? null,
          tenantName: tenant?.name ?? null,
          role,
          userId,
          subscription: tenant
            ? { plan: tenant.subscription_status ?? "trial", status: tenant.status ?? "active" }
            : undefined,
          features: (tenant?.features as Record<string, boolean> | null) ?? undefined,
        });

        // ------------------ payload ------------------
        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages required", { status: 400 });
        }

        // Ensure the conversation row exists / belongs to this user.
        let conversationId = body.conversationId ?? null;
        if (conversationId) {
          const { data: conv } = await authed
            .from("ai_conversations")
            .select("id")
            .eq("id", conversationId)
            .eq("user_id", userId)
            .is("deleted_at", null)
            .maybeSingle();
          if (!conv) conversationId = null;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (!conversationId) {
          const firstText = body.messages
            .find((m) => m.role === "user")
            ?.parts.find((p) => p.type === "text") as { text?: string } | undefined;
          const title = firstText?.text?.slice(0, 80) ?? "New conversation";
          const { data: created, error: createErr } = await supabaseAdmin
            .from("ai_conversations")
            .insert({
              tenant_id: profile.tenant_id,
              user_id: userId,
              agent_id: "owner_ai",
              title,
            })
            .select("id")
            .single();
          if (createErr) return new Response("Failed to create conversation", { status: 500 });
          conversationId = created.id;
        }

        // Persist the latest user message.
        const lastMessage = body.messages[body.messages.length - 1];
        if (lastMessage?.role === "user") {
          await supabaseAdmin.from("ai_conversation_turns").insert({
            conversation_id: conversationId,
            tenant_id: profile.tenant_id,
            role: "user",
            content: (lastMessage.parts.find((p) => p.type === "text") as { text?: string } | undefined)
              ?.text ?? "",
            parts: lastMessage.parts as never,
          });
        }

        // ------------------ streaming ------------------
        bootstrapNevorAI();
        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway(NEVORAI_DEFAULT_MODEL);
        const tools = buildToolBag(ctx);

        const systemPrompt = defaultPromptFor(ctx);

        const enrichedSystem = [
          systemPrompt,
          `\nAcademy: ${ctx.tenantName ?? "Unknown"} (${ctx.tenantSlug ?? "-"})`,
          `Caller role: ${ctx.role}. Timezone: ${ctx.timezone ?? "UTC"}. Language: ${ctx.language ?? "en"}.`,
          `Now: ${ctx.now}.`,
          `Follow-up policy: after answering, suggest 2–3 next actions when useful. Never call a write tool without explicit user confirmation — those return a "confirmation required" envelope and the user will approve them in the Action Queue.`,
        ].join("\n");

        const result = streamText({
          model,
          system: enrichedSystem,
          tools,
          stopWhen: stepCountIs(50),
          messages: await convertToModelMessages(body.messages),
          abortSignal: request.signal,
        });

        return result.toUIMessageStreamResponse({
          sendReasoning: true,
          originalMessages: body.messages,
          onFinish: async ({ responseMessage, isAborted }) => {
            if (isAborted) return;
            if (!responseMessage?.parts || responseMessage.parts.length === 0) return;
            try {
              const textPart = responseMessage.parts.find((p) => p.type === "text") as
                | { text?: string }
                | undefined;
              await supabaseAdmin.from("ai_conversation_turns").insert({
                conversation_id: conversationId,
                tenant_id: profile.tenant_id,
                role: "assistant",
                content: textPart?.text ?? "",
                parts: responseMessage.parts as never,
              });
              await supabaseAdmin
                .from("ai_conversations")
                .update({ updated_at: new Date().toISOString() })
                .eq("id", conversationId);
            } catch (e) {
              console.error("[nevorai] persist assistant turn failed", e);
            }
          },
          onError: (err) => {
            console.error("[nevorai] stream error", err);
            return err instanceof Error ? err.message : "stream failed";
          },
        });
      },
    },
  },
});
