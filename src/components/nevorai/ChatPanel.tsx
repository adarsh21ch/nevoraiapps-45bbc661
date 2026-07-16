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
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { RichToolOutput } from "@/components/nevorai/RichToolOutput";
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
      await sendMessage({ text: trimmed });
      setInput("");
      if (wasEmpty) onConversationStarted?.();
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    [messages.length, onConversationStarted, sendMessage, status],
  );

  const isGenerating = status === "submitted" || status === "streaming";

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
            <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="text-3xl font-semibold tracking-tight">Ask NevorAI</div>
              <p className="max-w-md text-sm text-muted-foreground">
                Your AI Academy Manager. Ask about attendance, fees, admissions, or say
                "brief me on today".
              </p>
              {suggestions.length > 0 ? (
                <div className="mt-2 flex max-w-2xl flex-wrap justify-center gap-2">
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
                    className={cn(m.role === "assistant" && "bg-transparent px-0")}
                  >
                    {m.parts.map((part, idx) => {
                      if (part.type === "text") {
                        return (
                          <div key={idx} className="whitespace-pre-wrap text-sm leading-relaxed">
                            {part.text}
                          </div>
                        );
                      }
                      if (part.type === "reasoning") {
                        return (
                          <div key={idx} className="text-xs italic text-muted-foreground">
                            {part.text}
                          </div>
                        );
                      }
                      if (part.type?.startsWith("tool-")) {
                        const p = part as {
                          type: string;
                          state?: string;
                          input?: unknown;
                          output?: unknown;
                          errorText?: string;
                        };
                        const toolName = p.type.slice("tool-".length);
                        return (
                          <Tool key={idx} defaultOpen={false}>
                            <ToolHeader
                              type={`tool-${toolName}`}
                              state={
                                (p.state as
                                  | "input-streaming"
                                  | "input-available"
                                  | "output-available"
                                  | "output-error") ?? "output-available"
                              }
                            />
                            <ToolContent>
                              <ToolInput input={p.input} />
                              <ToolOutput
                                output={
                                  p.output ? <RichToolOutput output={p.output} /> : undefined
                                }
                                errorText={p.errorText}
                              />
                            </ToolContent>
                          </Tool>
                        );
                      }
                      return null;
                    })}

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
          {isGenerating && messages.length > 0 && (
            <div className="px-2 py-1 text-xs">
              <Shimmer>NevorAI is thinking…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
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
