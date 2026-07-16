import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { ChatPanel } from "@/components/nevorai/ChatPanel";
import { DailyBrief } from "@/components/nevorai/DailyBrief";
import { QuickInsights } from "@/components/nevorai/QuickInsights";
import { ActionQueue } from "@/components/nevorai/ActionQueue";
import { ConversationList } from "@/components/nevorai/ConversationList";
import { listTurns } from "@/lib/nevorai/conversations.functions";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard/nevorai")({
  head: () => ({
    meta: [
      { title: "NevorAI · Owner AI" },
      { name: "description", content: "Your AI Academy Manager — brief, insights, and conversation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <OwnerOnly>
      <NevorAIPage />
    </OwnerOnly>
  ),
});

const SUGGESTIONS = [
  "Brief me on today",
  "Who hasn't paid this month?",
  "Today's attendance",
  "Show pending admissions",
  "Revenue this month",
  "Any automation failures?",
];

function NevorAIPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const fetchTurns = useServerFn(listTurns);

  const turnsQ = useQuery({
    enabled: !!conversationId,
    queryKey: ["nevorai", "turns", conversationId],
    queryFn: () => fetchTurns({ data: { conversationId: conversationId! } }),
  });

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!conversationId || !turnsQ.data) return [];
    return turnsQ.data
      .filter((t) => t.role === "user" || t.role === "assistant")
      .map((t) => {
        const parts = Array.isArray(t.parts)
          ? (t.parts as UIMessage["parts"])
          : ([{ type: "text", text: t.content ?? "" }] as unknown as UIMessage["parts"]);
        return {
          id: t.id,
          role: t.role as "user" | "assistant",
          parts,
        } as UIMessage;
      });
  }, [conversationId, turnsQ.data]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <ModuleHeader
        icon={Sparkles}
        title="NevorAI"
        description="Your AI Academy Manager"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Left rail — conversations */}
        <div className="hidden lg:block">
          <Card className="h-[720px] overflow-hidden">
            <ConversationList activeId={conversationId} onSelect={setConversationId} />
          </Card>
        </div>

        {/* Center — brief + chat */}
        <div className="flex flex-col gap-4">
          <DailyBrief />
          <QuickInsights />
          <Card className="h-[560px] overflow-hidden">
            <ChatPanel
              key={conversationId ?? "draft"}
              conversationId={conversationId}
              initialMessages={initialMessages}
              onConversationStarted={() => {
                // conversation gets created server-side on first send; we
                // re-fetch the list so the sidebar picks it up.
              }}
              suggestions={SUGGESTIONS}
            />
          </Card>
        </div>

        {/* Right rail — action queue */}
        <div className="flex flex-col gap-4">
          <ActionQueue />
          <Card className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Try asking</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {SUGGESTIONS.map((s) => (
                <li key={s} className="text-muted-foreground">
                  · {s}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
