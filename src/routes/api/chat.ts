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
import {
  renderTopicForPrompt,
  selectRelevantTopics,
} from "@/lib/nevorai/product-knowledge";

type PageContext = {
  currentScreen?: string;
  screenLabel?: string;
  selectedStudentId?: string;
  selectedBatchId?: string;
  selectedInvoiceId?: string;
  selectedChildId?: string;
  selectedDate?: string;
  selectedCampaignId?: string;
  selectedLeadId?: string;
  selectedReportId?: string;
  selectedAutomationId?: string;
  currentFilters?: Record<string, string | number | boolean | null>;
  note?: string;
};

type ChatRequestBody = {
  messages?: UIMessage[];
  conversationId?: string;
  pageContext?: PageContext | null;
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

function jsonError(code: string, message: string, status = 200) {
  // Return 200 so the AI SDK client can read the JSON body and surface a
  // friendly error card instead of the Worker's HTML crash page.
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
        // ------------------ auth ------------------
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return jsonError("UNAUTHENTICATED", "Please sign in to chat with NevorAI.", 401);
        }
        const token = authHeader.slice("Bearer ".length);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return jsonError("SERVER_MISCONFIGURED", "The server is missing required configuration.");
        }
        if (!GOOGLE_API_KEY) {
          return jsonError(
            "AI_PROVIDER_UNCONFIGURED",
            "NevorAI is not connected to an AI provider. Please add GOOGLE_API_KEY.",
          );
        }

        const authed = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false },
          global: {
            fetch: supabaseFetchShim(SUPABASE_PUBLISHABLE_KEY),
            headers: { Authorization: `Bearer ${token}` },
          },
        });

        const { data: userRes, error: userErr } = await authed.auth.getUser(token);
        if (userErr || !userRes?.user)
          return jsonError("UNAUTHENTICATED", "Your session has expired. Please sign in again.", 401);
        const userId = userRes.user.id;

        const { data: profile } = await authed
          .from("profiles")
          .select("tenant_id, role")
          .eq("user_id", userId)
          .maybeSingle();
        if (!profile?.tenant_id)
          return jsonError("NO_TENANT", "No academy is linked to this account.", 403);

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

        // ------------------ payload (parse first so we can enrich context) ------------------
        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return jsonError("BAD_REQUEST", "Messages are required.", 400);
        }
        const pageCtx: PageContext = body.pageContext ?? {};

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
          currentScreen: pageCtx.currentScreen,
          selectedStudentId: pageCtx.selectedStudentId,
          selectedBatchId: pageCtx.selectedBatchId,
          selectedInvoiceId: pageCtx.selectedInvoiceId,
          selectedChildId: pageCtx.selectedChildId,
          selectedDate: pageCtx.selectedDate,
          currentFilters: pageCtx.currentFilters,
        });

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
        const google = createNevorAIProvider(GOOGLE_API_KEY);
        const model = google(NEVORAI_DEFAULT_MODEL);
        const tools = buildToolBag(ctx);

        const systemPrompt = defaultPromptFor(ctx);

        const lastUserText = (() => {
          for (let i = body.messages.length - 1; i >= 0; i--) {
            const m = body.messages[i];
            if (m.role === "user") {
              const part = m.parts.find((p) => p.type === "text") as { text?: string } | undefined;
              return part?.text ?? "";
            }
          }
          return "";
        })();

        const topics = selectRelevantTopics({
          currentScreen: pageCtx.currentScreen,
          query: lastUserText,
          limit: 2,
        });
        const knowledgeBlock = topics.length
          ? [
              "\n---\nRelevant product knowledge (use to answer 'how do I' questions without calling tools; do NOT quote source code or internal implementation):",
              ...topics.map(renderTopicForPrompt),
            ].join("\n")
          : "";

        const pageContextLines: string[] = [];
        if (pageCtx.currentScreen) pageContextLines.push(`Current screen: ${pageCtx.currentScreen}${pageCtx.screenLabel ? ` (${pageCtx.screenLabel})` : ""}`);
        if (pageCtx.selectedStudentId) pageContextLines.push(`Selected student: ${pageCtx.selectedStudentId}`);
        if (pageCtx.selectedBatchId) pageContextLines.push(`Selected batch: ${pageCtx.selectedBatchId}`);
        if (pageCtx.selectedInvoiceId) pageContextLines.push(`Selected invoice: ${pageCtx.selectedInvoiceId}`);
        if (pageCtx.selectedChildId) pageContextLines.push(`Selected child: ${pageCtx.selectedChildId}`);
        if (pageCtx.selectedLeadId) pageContextLines.push(`Selected lead: ${pageCtx.selectedLeadId}`);
        if (pageCtx.selectedCampaignId) pageContextLines.push(`Selected campaign: ${pageCtx.selectedCampaignId}`);
        if (pageCtx.selectedReportId) pageContextLines.push(`Selected report: ${pageCtx.selectedReportId}`);
        if (pageCtx.selectedAutomationId) pageContextLines.push(`Selected automation: ${pageCtx.selectedAutomationId}`);
        if (pageCtx.selectedDate) pageContextLines.push(`Selected date: ${pageCtx.selectedDate}`);
        if (pageCtx.currentFilters && Object.keys(pageCtx.currentFilters).length) {
          pageContextLines.push(`Active filters: ${JSON.stringify(pageCtx.currentFilters)}`);
        }
        if (pageCtx.note) pageContextLines.push(`Note: ${pageCtx.note}`);

        const enrichedSystem = [
          systemPrompt,
          `\nAcademy: ${ctx.tenantName ?? "Unknown"} (${ctx.tenantSlug ?? "-"})`,
          `Caller role: ${ctx.role}. Timezone: ${ctx.timezone ?? "UTC"}. Language: ${ctx.language ?? "en"}.`,
          `Now: ${ctx.now}.`,
          pageContextLines.length ? `\nUser is currently viewing:\n${pageContextLines.map((l) => `- ${l}`).join("\n")}\nUse this to resolve ambiguous references like "this invoice" or "today" without re-asking.` : "",
          `Follow-up policy: after answering, suggest 2–3 next actions when useful. Never call a write tool without explicit user confirmation — those return a "confirmation required" envelope and the user will approve them in the Action Queue.`,
          `Error explanation: when a tool returns an error envelope (permission denied, subscription required, feature disabled, validation failed, automation failed, webhook failed, payment verification failed), explain the cause in plain language, why it happened, and the exact next step to fix it. Never surface raw error codes or stack traces.`,
          knowledgeBlock,
        ]
          .filter(Boolean)
          .join("\n");

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
        } catch (e) {
          console.error("[nevorai] handler crashed", e);
          const msg = e instanceof Error ? e.message : "Unknown error";
          return jsonError("AI_HANDLER_FAILED", `NevorAI hit an error: ${msg}`);
        }
      },
    },
  },
});
