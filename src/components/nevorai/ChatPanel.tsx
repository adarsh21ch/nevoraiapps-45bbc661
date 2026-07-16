import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  conversationId: string | null;
  initialMessages?: UIMessage[];
  onConversationStarted?: () => void;
  suggestions?: string[];
};

export function ChatPanel({
  conversationId,
  initialMessages = [],
  onConversationStarted,
  suggestions = [],
}: Props) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({
          Authorization: token ? `Bearer ${token}` : "",
        }),
        body: () => ({ conversationId }),
      }),
    [token, conversationId],
  );

  const chatId = conversationId ?? "draft";

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "NevorAI failed to respond"),
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
            messages.map((m) => (
              <Message key={m.id} from={m.role as "user" | "assistant" | "system"}>
                <MessageContent
                  variant={m.role === "assistant" ? "flat" : "contained"}
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
                                p.output ? (
                                  <pre className="whitespace-pre-wrap text-xs">
                                    {typeof p.output === "string"
                                      ? p.output
                                      : JSON.stringify(p.output, null, 2)}
                                  </pre>
                                ) : undefined
                              }
                              errorText={p.errorText}
                            />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
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
          <PromptInputFooter className="justify-end">
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
