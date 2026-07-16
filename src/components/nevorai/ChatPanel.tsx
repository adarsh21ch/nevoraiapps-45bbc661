import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { Copy, Download, RotateCcw } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { ResponseRenderer } from "@/components/nevorai/ResponseRenderer";
import { ThinkingDots } from "@/components/nevorai/ThinkingDots";
import {
  FollowUpChips,
  deriveFollowUps,
  extractRecommendedActions,
} from "@/components/nevorai/FollowUpChips";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { copyText, downloadMarkdown, messagesToMarkdown } from "@/lib/nevorai/export";
import type { NevorAIPageContext } from "@/lib/nevorai/page-context";

type Props = {
  conversationId: string | null;
  initialMessages?: UIMessage[];
  onConversationStarted?: () => void;
  suggestions?: string[];
  conversationTitle?: string | null;
  /** Live page context — attached to every request so NevorAI knows where the user is. */
  pageContext?: NevorAIPageContext;
  /** Optional pending prompt to auto-send once the panel opens. */
  pendingPrompt?: string | null;
  onPendingPromptConsumed?: () => void;
  /**
   * Lazily create a conversation the first time the user submits from a draft
   * chat. Returning the persisted ID prevents the server from silently
   * creating a new row on every subsequent turn (which would fragment
   * history into many "New conversation" entries).
   */
  ensureConversationId?: () => Promise<string | null>;
};

export function ChatPanel({
  conversationId,
  initialMessages = [],
  onConversationStarted,
  suggestions = [],
  conversationTitle,
  pageContext,
  pendingPrompt,
  onPendingPromptConsumed,
}: Props) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keep latest pageContext in a ref so DefaultChatTransport reads the current
  // value at send-time without recreating the transport on every navigation.
  const pageContextRef = useRef<NevorAIPageContext | undefined>(pageContext);
  useEffect(() => {
    pageContextRef.current = pageContext;
  }, [pageContext]);

  const [chatError, setChatError] = useState<{ code?: string; message: string } | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({
          Authorization: token ? `Bearer ${token}` : "",
        }),
        body: () => ({ conversationId, pageContext: pageContextRef.current ?? null }),
        // Intercept non-SSE responses (JSON error / HTML crash page) so the AI SDK
        // never renders a raw HTML document inside the conversation.
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          const ct = res.headers.get("content-type") ?? "";
          if (!res.ok || (!ct.includes("event-stream") && !ct.includes("text/plain"))) {
            let code: string | undefined;
            let message = `NevorAI is temporarily unavailable (HTTP ${res.status}).`;
            if (ct.includes("application/json")) {
              try {
                const body = (await res.clone().json()) as {
                  error?: { code?: string; message?: string };
                };
                if (body?.error?.message) message = body.error.message;
                code = body?.error?.code;
              } catch {
                /* fall through */
              }
            }
            const err = new Error(message) as Error & { code?: string };
            err.code = code;
            throw err;
          }
          return res;
        },
      }),
    [token, conversationId],
  );

  const chatId = conversationId ?? "draft";

  const { messages, sendMessage, status, stop, setMessages, regenerate } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (e) => {
      const code = (e as Error & { code?: string }).code;
      setChatError({ code, message: e.message || "NevorAI failed to respond" });
      toast.error(e.message || "NevorAI failed to respond");
    },
  });

  // Reset when conversation switches.
  const lastConvIdRef = useRef(conversationId);
  useEffect(() => {
    if (lastConvIdRef.current !== conversationId) {
      setMessages(initialMessages);
      lastConvIdRef.current = conversationId;
    }
  }, [conversationId, initialMessages, setMessages]);

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversationId]);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === "streaming" || status === "submitted") return;
      const wasEmpty = messages.length === 0;
      setChatError(null);
      await sendMessage({ text: trimmed });
      setInput("");
      if (wasEmpty) onConversationStarted?.();
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [messages.length, onConversationStarted, sendMessage, status],
  );

  const isGenerating = status === "submitted" || status === "streaming";

  // Owner-facing loader: no changing text, just a subtle three-dot pulse.
  // See <ThinkingDots />.

  // Auto-send a pending prompt (e.g. "Explain this invoice") once and only once.
  const consumedPromptRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingPrompt || !token) return;
    if (consumedPromptRef.current === pendingPrompt) return;
    if (isGenerating) return;
    consumedPromptRef.current = pendingPrompt;
    void submit(pendingPrompt);
    onPendingPromptConsumed?.();
  }, [pendingPrompt, token, isGenerating, submit, onPendingPromptConsumed]);


  const handleCopy = useCallback(async (text: string) => {
    const ok = await copyText(text);
    toast[ok ? "success" : "error"](ok ? "Copied" : "Copy failed");
  }, []);

  const handleExport = useCallback(() => {
    const md = messagesToMarkdown(conversationTitle || "NevorAI Conversation", messages);
    downloadMarkdown(`nevorai-${(conversationTitle || "conversation").slice(0, 40)}`, md);
  }, [conversationTitle, messages]);

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-5 px-4 py-16 text-center">
              <div
                aria-hidden
                className="grid size-14 place-items-center rounded-2xl text-2xl text-white shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, var(--tenant-brand, var(--brand, #E8873C)), color-mix(in oklab, var(--tenant-brand, var(--brand, #E8873C)) 55%, transparent))",
                }}
              >
                ✨
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Hi, I&apos;m NevorAI
                </div>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Your AI Academy Manager. Ask anything about attendance, fees,
                  admissions, automations or reports — I&apos;ll cite the data and never
                  change anything without your approval.
                </p>
              </div>
              {suggestions.length > 0 ? (
                <div className="mt-1 flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestions.slice(0, 6).map((s) => (
                    <button
                      key={s}
                      onClick={() => void submit(s)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            messages.map((m) => {
              const isLastAssistant = m.id === lastAssistantId;
              const assistantText = m.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("\n");
              const followUps =
                m.role === "assistant" && isLastAssistant && !isGenerating
                  ? [
                      ...extractRecommendedActions(m.parts),
                      ...deriveFollowUps(assistantText),
                    ]
                  : [];
              return (
                <Message key={m.id} from={m.role as "user" | "assistant" | "system"}>
                  <MessageContent
                    className={cn(
                      "animate-fade-in",
                      m.role === "assistant" && "bg-transparent px-0",
                    )}
                  >
                    {m.role === "assistant" ? (
                      assistantText ? (
                        <ResponseRenderer
                          text={assistantText}
                          onAction={(label) => void submit(label)}
                        />
                      ) : null
                    ) : (
                      m.parts.map((part, idx) =>
                        part.type === "text" ? (
                          <div
                            key={idx}
                            className="whitespace-pre-wrap text-sm leading-relaxed"
                          >
                            {part.text}
                          </div>
                        ) : null,
                      )
                    )}

                    {m.role === "assistant" && !isGenerating && assistantText ? (
                      <div className="mt-2 flex items-center gap-1 opacity-60 transition hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => void handleCopy(assistantText)}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label="Copy response"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        {isLastAssistant ? (
                          <button
                            type="button"
                            onClick={() => void regenerate()}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="Retry"
                          >
                            <RotateCcw className="h-3 w-3" /> Retry
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {followUps.length > 0 ? (
                      <FollowUpChips items={followUps} onSelect={(p) => void submit(p)} />
                    ) : null}
                  </MessageContent>
                </Message>
              );
            })
          )}
          {isGenerating ? <ThinkingDots className="ml-1 mt-1" /> : null}
          {chatError && !isGenerating ? (
            <div className="mx-2 my-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="font-medium text-destructive">
                {chatError.code === "AI_PROVIDER_UNCONFIGURED"
                  ? "AI provider not configured"
                  : chatError.code === "UNAUTHENTICATED"
                    ? "Session expired"
                    : chatError.code === "RATE_LIMITED"
                      ? "Too many requests"
                      : "NevorAI couldn't respond"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{chatError.message}</div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChatError(null);
                    void regenerate();
                  }}
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => setChatError(null)}
                  className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div
        className="border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >

        <PromptInput
          onSubmit={(_msg, e) => {
            e?.preventDefault();
            void submit(input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder="Ask NevorAI about attendance, fees, admissions…"
          />
          <PromptInputFooter className="justify-between">
            <div className="flex items-center gap-1">
              {messages.length > 0 ? (
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Export conversation"
                >
                  <Download className="h-3 w-3" /> Export
                </button>
              ) : null}
            </div>
            <PromptInputSubmit
              size="icon-sm"
              className="rounded-full"
              status={status}
              onStop={stop}
              disabled={!token || (!isGenerating && !input.trim())}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
