import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  MatchHeader,
  PlayerPanel,
  BowlerPanel,
  OverTimeline,
  ScoreButton,
  RunsButton,
  ExtraButton,
  UndoButton,
  DismissalModal,
  PlayerPickerModal,
  RunOutModal,
  ExtraRunsModal,
  SquadDrawer,
  CommentaryPanel,
  type DismissalKind,
  type PlayerOption,
} from "@/components/match-center/scoring-ui";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Users,
  ClipboardList,
  Pause,
  Pencil,
  StickyNote,
  Settings2,
  ArrowLeft,
  Flag,
} from "lucide-react";

export const Route = createFileRoute("/scorer/$matchId")({
  head: () => ({
    meta: [
      { title: "Live Scorer · Match Center" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: ScorerPage,
});

const MOCK_PLAYERS: PlayerOption[] = [
  { id: "1", name: "Rohit Sharma", role: "Opener" },
  { id: "2", name: "Shubman Gill", role: "Opener" },
  { id: "3", name: "Virat Kohli", role: "Top order" },
  { id: "4", name: "Suryakumar Yadav", role: "Middle order" },
  { id: "5", name: "Hardik Pandya", role: "All-rounder" },
  { id: "6", name: "Rishabh Pant", role: "Wicket-keeper" },
  { id: "7", name: "Ravindra Jadeja", role: "All-rounder" },
  { id: "8", name: "Kuldeep Yadav", role: "Spinner" },
  { id: "9", name: "Jasprit Bumrah", role: "Pacer" },
  { id: "10", name: "Mohammed Siraj", role: "Pacer" },
  { id: "11", name: "Arshdeep Singh", role: "Pacer" },
];

function ScorerPage() {
  const [dismissOpen, setDismissOpen] = useState(false);
  const [caughtOpen, setCaughtOpen] = useState(false);
  const [runOutOpen, setRunOutOpen] = useState(false);
  const [newBatterOpen, setNewBatterOpen] = useState(false);
  const [extraKind, setExtraKind] = useState<string | null>(null);
  const [rightDrawer, setRightDrawer] = useState(false);
  const [leftDrawer, setLeftDrawer] = useState(false);
  const [commentaryCollapsed, setCommentaryCollapsed] = useState(false);

  // Placeholder demo values (UI only — no calculations)
  const striker = {
    name: "Rohit Sharma",
    runs: 42,
    balls: 31,
    fours: 5,
    sixes: 1,
    strikeRate: "135.4",
    last5: ["1", "4", "0", "1", "6"],
    onStrike: true,
  };
  const nonStriker = {
    name: "Shubman Gill",
    runs: 28,
    balls: 24,
    strikeRate: "116.6",
  };
  const bowler = {
    name: "Trent Boult",
    overs: "3.3",
    runs: 24,
    wickets: 1,
    economy: "6.85",
    lastOver: ["1", "0", "4", "WD", "0"],
  };

  const handleDismissal = (kind: DismissalKind) => {
    setDismissOpen(false);
    if (kind === "Caught") setCaughtOpen(true);
    else if (kind === "Run Out") setRunOutOpen(true);
    else setNewBatterOpen(true);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Match header */}
      <MatchHeader
        homeTeam="India"
        awayTeam="New Zealand"
        score="142/4"
        overs="18.3"
        crr="7.68"
        rrr="9.20"
        target="187"
        status="2nd Innings"
        format="T20"
        ground="Wankhede Stadium"
        tournament="Series 2026"
        timer="01:42:18"
        connection="online"
      />

      {/* Sub toolbar */}
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-1.5 text-xs">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5">
            <Link to="/match-center/live">
              <ArrowLeft className="size-3.5" /> Exit
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setLeftDrawer(true)}
          >
            <ClipboardList className="size-3.5" /> Match info
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            <StickyNote className="size-3.5" /> Notes
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            <Pencil className="size-3.5" /> Manual edit
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5">
            <Pause className="size-3.5" /> Pause
          </Button>
          <SettingsSheet />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setRightDrawer(true)}
          >
            <Users className="size-3.5" /> Squad
          </Button>
        </div>
      </div>

      {/* Main split */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Left: Batters */}
        <PlayerPanel striker={striker} nonStriker={nonStriker} />

        {/* Center: over timeline + scoring buttons + over strip */}
        <div className="flex min-h-0 flex-col gap-3">
          <OverTimeline balls={bowler.lastOver} />

          {/* Runs row */}
          <div className="grid grid-cols-6 gap-2">
            {([0, 1, 2, 3, 4, 6] as const).map((r) => (
              <RunsButton key={r} value={r} />
            ))}
          </div>

          {/* Extras row */}
          <div className="grid grid-cols-4 gap-2">
            <ExtraButton label="Wide" onClick={() => setExtraKind("Wide")} />
            <ExtraButton
              label="No Ball"
              onClick={() => setExtraKind("No Ball")}
            />
            <ExtraButton label="Bye" onClick={() => setExtraKind("Bye")} />
            <ExtraButton
              label="Leg Bye"
              onClick={() => setExtraKind("Leg Bye")}
            />
          </div>

          {/* Wicket + control row */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ScoreButton
              label="OUT"
              tone="wicket"
              size="xl"
              onClick={() => setDismissOpen(true)}
              className="sm:col-span-2"
            />
            <ScoreButton
              label="End Over"
              tone="neutral"
              sublabel="Innings"
              onClick={() => {}}
            />
            <ScoreButton
              label="End Match"
              tone="danger"
              sublabel="Finalize"
              onClick={() => {}}
            />
          </div>

          {/* Commentary */}
          <CommentaryPanel
            entries={[]}
            collapsed={commentaryCollapsed}
            onToggle={() => setCommentaryCollapsed((v) => !v)}
          />
        </div>

        {/* Right: Bowler + undo */}
        <div className="flex min-h-0 flex-col gap-3">
          <BowlerPanel bowler={bowler} />
          <div className="grid grid-cols-2 gap-2">
            <UndoButton />
            <Button variant="secondary" size="lg" className="h-14 gap-2">
              <Flag className="size-4" /> Retire
            </Button>
          </div>
          <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-foreground">
              Waiting states
            </div>
            <ul className="space-y-1">
              <li>• Toss result captured</li>
              <li>• First batter selected</li>
              <li>• Bowler assigned</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DismissalModal
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        onSelect={handleDismissal}
      />
      <PlayerPickerModal
        open={caughtOpen}
        onOpenChange={setCaughtOpen}
        title="Who took the catch?"
        description="Select the fielder."
        players={MOCK_PLAYERS}
        recent={MOCK_PLAYERS.slice(0, 3)}
        onSelect={() => {
          setCaughtOpen(false);
          setNewBatterOpen(true);
        }}
      />
      <RunOutModal
        open={runOutOpen}
        onOpenChange={setRunOutOpen}
        onSelect={() => {
          setRunOutOpen(false);
          setNewBatterOpen(true);
        }}
      />
      <PlayerPickerModal
        open={newBatterOpen}
        onOpenChange={setNewBatterOpen}
        title="Select next batter"
        description="Only remaining players are shown."
        players={MOCK_PLAYERS.slice(3)}
        onSelect={() => setNewBatterOpen(false)}
      />
      <ExtraRunsModal
        open={!!extraKind}
        onOpenChange={(v) => !v && setExtraKind(null)}
        kind={extraKind ?? ""}
        onSelect={() => setExtraKind(null)}
      />

      {/* Squad drawer (right) */}
      <SquadDrawer
        open={rightDrawer}
        onOpenChange={setRightDrawer}
        side="right"
        title="Squad"
      >
        <SquadSection title="Playing XI" players={MOCK_PLAYERS} />
        <SquadSection title="Bench" players={[]} />
        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">Roles</div>
          <div>Captain: Rohit Sharma</div>
          <div>Keeper: Rishabh Pant</div>
          <div>Substitutes: —</div>
        </div>
      </SquadDrawer>

      {/* Match info drawer (left) */}
      <SquadDrawer
        open={leftDrawer}
        onOpenChange={setLeftDrawer}
        side="left"
        title="Match info"
      >
        <InfoRow label="Match notes" value="Fresh pitch. Dew expected." />
        <InfoRow label="Weather" value="Clear · 26°C · Humidity 62%" />
        <InfoRow label="Pitch" value="Hard, good bounce" />
        <InfoRow label="Umpires" value="Kumar Dharmasena · Marais Erasmus" />
        <InfoRow label="Scorer" value="You (Academy OS)" />
      </SquadDrawer>
    </div>
  );
}

function SquadSection({
  title,
  players,
}: {
  title: string;
  players: PlayerOption[];
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      {players.length === 0 ? (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          No players.
        </div>
      ) : (
        <ul className="space-y-1">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
            >
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.role}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function SettingsSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5">
          <Settings2 className="size-3.5" /> Settings
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Scoring preferences</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          <SettingRow label="Dark mode">
            <Switch />
          </SettingRow>
          <SettingRow label="Sound">
            <Switch defaultChecked />
          </SettingRow>
          <SettingRow label="Vibration">
            <Switch defaultChecked />
          </SettingRow>
          <div>
            <Label className="text-sm">Font size</Label>
            <Slider defaultValue={[100]} min={80} max={140} step={10} className="mt-2" />
          </div>
          <div>
            <Label className="text-sm">Button size</Label>
            <Slider defaultValue={[100]} min={80} max={140} step={10} className="mt-2" />
          </div>
          <div>
            <Label className="text-sm">Theme</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm">
                Auto
              </Button>
              <Button variant="outline" size="sm">
                Light
              </Button>
              <Button variant="outline" size="sm">
                Dark
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
