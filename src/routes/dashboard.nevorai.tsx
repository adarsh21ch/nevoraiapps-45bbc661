import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import { PanelLeft, PanelRight, Plus, Sparkles } from "lucide-react";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import { ChatPanel } from "@/components/nevorai/ChatPanel";
import { ConversationList } from "@/components/nevorai/ConversationList";
import { TodaysPriorities } from "@/components/nevorai/TodaysPriorities";
import { ActionQueue } from "@/components/nevorai/ActionQueue";
import { QuickInsights } from "@/components/nevorai/QuickInsights";
import { SmartInsights } from "@/components/nevorai/SmartInsights";
import { listTurns } from "@/lib/nevorai/conversations.functions";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/nevorai")({
  head: () => ({
    meta: [
      { title: "NevorAI · AI Academy Manager" },
      {
        name: "description",
        content:
          "Chat with NevorAI — your AI academy manager for attendance, fees, admissions, and reports.",
      },
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

/**
 * NevorAI is a normal dashboard module. It lives INSIDE the DashboardShell
 * (sidebar + header + bottom nav remain visible at all times). The workspace
 * fills the available content area with a 3-column layout on xl+, collapsing
 * to drawers on smaller viewports. Chat dominates; conversations and
 * intelligence rails are secondary.
 */
function NevorAIPage() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [convOpen, setConvOpen] = useState(false); // < lg drawer
  const [rightOpen, setRightOpen] = useState(false); // < xl drawer
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

  // Negate the dashboard <main>'s padding so the workspace is flush inside the
  // shell content area, while keeping the shell's sidebar/header/bottom-nav
  // visible. Height fills viewport minus the shell header (3.5rem) and safe
  // areas; bottom padding respects mobile bottom nav via env(safe-area).
  return (
    <div
      className={cn(
        "-mx-4 md:-mx-8 -mt-4 md:-mt-8 -mb-32 md:-mb-8",
        "flex bg-background text-foreground",
        "h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)]",
      )}
    >
      {/* Conversations rail — persistent on lg+ (~22%) */}
      <aside className="hidden lg:flex w-[22%] min-w-[220px] max-w-[300px] shrink-0 flex-col border-r border-border/60 bg-card/40">
        <LeftHeader onNew={() => setConversationId(null)} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ConversationList activeId={conversationId} onSelect={setConversationId} />
        </div>
      </aside>

      {/* Center — chat (~56% on xl, more on lg, full on <lg) */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2 lg:px-5">
          <button
            type="button"
            onClick={() => setConvOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Open conversations"
          >
            <PanelLeft className="size-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles
              className="size-4 shrink-0"
              style={{ color: "var(--tenant-brand, var(--brand, #E8873C))" }}
            />
            <span className="truncate text-sm font-semibold">NevorAI</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              · AI Academy Manager
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setConversationId(null)}
              className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Plus className="size-3.5" /> New
            </button>
            <button
              type="button"
              onClick={() => setRightOpen(true)}
              className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent xl:hidden"
              aria-label="Open intelligence panel"
            >
              <PanelRight className="size-4" />
            </button>
          </div>
        </header>

        {/* Chat: centered, max-w ~800px like ChatGPT */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col px-2 sm:px-4">
            <ChatPanel
              key={conversationId ?? "draft"}
              conversationId={conversationId}
              initialMessages={initialMessages}
              onConversationStarted={() => {
                /* server creates row; sidebar re-queries. */
              }}
              suggestions={SUGGESTIONS}
            />
          </div>
        </div>
      </main>

      {/* Intelligence rail — persistent on xl+ (~22%) */}
      <aside className="hidden xl:flex w-[22%] min-w-[280px] max-w-[360px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border/60 bg-card/30 p-4">
        <RightRail />
      </aside>

      {/* < lg: conversations drawer */}
      <Sheet open={convOpen} onOpenChange={setConvOpen}>
        <SheetContent side="left" className="w-[300px] max-w-[85vw] p-0">
          <div className="flex h-full flex-col">
            <LeftHeader
              onNew={() => {
                setConversationId(null);
                setConvOpen(false);
              }}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConversationList
                activeId={conversationId}
                onSelect={(id) => {
                  setConversationId(id);
                  setConvOpen(false);
                }}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* < xl: intelligence drawer */}
      <Sheet open={rightOpen} onOpenChange={setRightOpen}>
        <SheetContent side="right" className="w-[380px] max-w-[92vw] overflow-y-auto p-4">
          <div className="mb-3 text-sm font-semibold">Today at your academy</div>
          <div className="flex flex-col gap-3">
            <RightRail />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LeftHeader({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Conversations
      </div>
      <button
        type="button"
        onClick={onNew}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-accent",
        )}
      >
        <Plus className="size-3.5" /> New
      </button>
    </div>
  );
}

function RightRail() {
  return (
    <>
      <TodaysPriorities />
      <ActionQueue />
      <QuickInsights />
      <SmartInsights />
    </>
  );
}
