import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, TrendingUp, CalendarDays, UserCircle, LogOut, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAttendanceRealtime } from "@/lib/attendance/queries";
import {
  listMyChildren,
  fetchChildContext,
  getLastSelectedChildId,
  setLastSelectedChildId,
  parentKeys,
  type ParentChildRow,
} from "@/lib/parent-app";
import { fetchStudentProgress, studentKeys } from "@/lib/student-app";
import { ParentCtx } from "@/hooks/use-parent-child";

export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [
      { title: "Family — Parent Portal" },
      { name: "description", content: "Follow your child's academy journey." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParentLayout,
});

const TABS = [
  { to: "/parent", label: "Home", icon: Home, exact: true },
  { to: "/parent/progress", label: "Progress", icon: TrendingUp, exact: false },
  { to: "/parent/timeline", label: "Timeline", icon: CalendarDays, exact: false },
  { to: "/parent/profile", label: "Profile", icon: UserCircle, exact: false },
] as const;

function ParentLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => getLastSelectedChildId());
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const childrenQ = useQuery({
    queryKey: parentKeys.children,
    queryFn: listMyChildren,
    enabled: signedIn,
  });

  // Auto-select first child; persist last selection
  useEffect(() => {
    if (!childrenQ.data || childrenQ.data.length === 0) return;
    const valid = childrenQ.data.find((c) => c.student_id === selectedId);
    const initial = valid?.student_id ?? childrenQ.data[0].student_id;
    if (initial !== selectedId) setSelectedId(initial);
  }, [childrenQ.data, selectedId]);

  const ctxQ = useQuery({
    queryKey: selectedId ? parentKeys.child(selectedId) : ["parent", "child", "none"],
    queryFn: () => fetchChildContext(selectedId!),
    enabled: !!selectedId,
  });

  // Realtime attendance for selected child's tenant
  useAttendanceRealtime(ctxQ.data?.tenant_id ?? null, qc);

  // Prefetch next child's progress (helps switching feel instant)
  useEffect(() => {
    const kids = childrenQ.data;
    if (!kids || kids.length < 2 || !selectedId) return;
    const idx = kids.findIndex((k) => k.student_id === selectedId);
    const next = kids[(idx + 1) % kids.length];
    if (!next) return;
    qc.prefetchQuery({
      queryKey: parentKeys.child(next.student_id),
      queryFn: () => fetchChildContext(next.student_id),
    }).then(() => {
      const cached = qc.getQueryData<Awaited<ReturnType<typeof fetchChildContext>>>(
        parentKeys.child(next.student_id),
      );
      if (cached) {
        qc.prefetchQuery({
          queryKey: studentKeys.progress(next.student_id),
          queryFn: () => fetchStudentProgress(cached),
        });
      }
    });
  }, [childrenQ.data, selectedId, qc]);

  if (!ready) return <PageSkeleton />;
  if (!signedIn) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background">
        <Card className="p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Sign in required</h1>
          <p className="text-sm text-muted-foreground">
            Please sign in with the parent account linked to your child.
          </p>
          <Button onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
        </Card>
      </div>
    );
  }
  if (childrenQ.isLoading || !childrenQ.data) return <PageSkeleton />;
  const kids = childrenQ.data;
  if (kids.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background">
        <Card className="p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">No linked children</h1>
          <p className="text-sm text-muted-foreground">
            Ask your academy to link your account to your child's profile.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4 mr-1" /> Sign out
          </Button>
        </Card>
      </div>
    );
  }

  const selectedChild = kids.find((k) => k.student_id === selectedId) ?? kids[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* Child switcher header */}
        <div className="mb-4">
          <ChildSwitcher
            children={kids}
            selected={selectedChild}
            onSelect={(id) => {
              setSelectedId(id);
              setLastSelectedChildId(id);
            }}
          />
        </div>
        <ParentCtx.Provider value={{ child: ctxQ.data, childRow: selectedChild }}>
          <Outlet />
        </ParentCtx.Provider>
      </div>

      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center py-3 gap-1 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "scale-110")} />
                <span className={cn(active && "font-medium")}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function ChildSwitcher({
  children: kids,
  selected,
  onSelect,
}: {
  children: ParentChildRow[];
  selected: ParentChildRow;
  onSelect: (id: string) => void;
}) {
  const hasMultiple = kids.length > 1;
  const avatar = (k: ParentChildRow) => (
    <div className="size-10 rounded-full bg-primary/15 grid place-items-center overflow-hidden shrink-0">
      {k.photo_url ? (
        <img src={k.photo_url} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-sm font-semibold text-primary">
          {k.student_name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
  if (!hasMultiple) {
    return (
      <Card className="p-3 flex items-center gap-3">
        {avatar(selected)}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Viewing</p>
          <p className="text-sm font-medium truncate">{selected.student_name}</p>
        </div>
      </Card>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="w-full text-left rounded-lg border bg-card hover:bg-muted/50 transition-colors p-3 flex items-center gap-3"
        >
          {avatar(selected)}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Viewing</p>
            <p className="text-sm font-medium truncate">{selected.student_name}</p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Your children</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {kids.map((k) => (
          <DropdownMenuItem
            key={k.student_id}
            onSelect={() => onSelect(k.student_id)}
            className="gap-3"
          >
            {avatar(k)}
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{k.student_name}</p>
              {k.player_id && <p className="text-[10px] text-muted-foreground">{k.player_id}</p>}
            </div>
            {k.student_id === selected.student_id && (
              <span className="text-[10px] text-primary font-medium">Active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen p-6 space-y-3 max-w-3xl mx-auto">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
