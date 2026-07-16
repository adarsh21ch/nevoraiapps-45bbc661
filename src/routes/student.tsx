import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, TrendingUp, Building2, UserCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyStudentContext, studentKeys } from "@/lib/student-app";
import { isPendingApproval, needsActivation, isBlocked, LIFECYCLE_LABEL, type LifecycleStatus } from "@/lib/admissions/lifecycle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [
      { title: "My Academy — Student" },
      { name: "description", content: "Your attendance, matches, and progress in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentLayout,
});

// Player nav: Home · Performance · Manage · Profile.
// Attendance/Fees live inside Manage (personal information hub).
const TABS = [
  { to: "/student", label: "Home", icon: Home, exact: true },
  { to: "/student/progress", label: "Performance", icon: TrendingUp, exact: false },
  { to: "/student/manage", label: "Manage", icon: Building2, exact: false },
  { to: "/student/profile", label: "Profile", icon: UserCircle, exact: false },
] as const;

function StudentLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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

  const ctxQ = useQuery({
    queryKey: studentKeys.me,
    queryFn: fetchMyStudentContext,
    enabled: signedIn,
  });

  // Lifecycle gate: fetch student's lifecycle_status and pending registration status.
  const gateQ = useQuery({
    queryKey: ["student", "gate", ctxQ.data?.student_id ?? "none"],
    enabled: signedIn && ctxQ.data !== undefined,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      let lifecycle: string | null = null;
      if (ctxQ.data?.student_id) {
        const { data } = await supabase
          .from("students")
          .select("lifecycle_status")
          .eq("id", ctxQ.data.student_id)
          .maybeSingle();
        lifecycle = (data as any)?.lifecycle_status ?? null;
      }
      let pendingReg = false;
      if (!ctxQ.data && uid) {
        const { data: reg } = await supabase
          .from("registrations")
          .select("id, review_status")
          .eq("applicant_user_id", uid)
          .in("review_status", ["pending", "waitlisted", "rejected", "changes_requested"])
          .limit(1)
          .maybeSingle();
        pendingReg = Boolean(reg);
      }
      return { lifecycle, pendingReg };
    },
  });

  const onPendingRoute = pathname === "/student/pending";

  useEffect(() => {
    if (!gateQ.data) return;
    const lifecycle = gateQ.data.lifecycle;
    const shouldGate =
      gateQ.data.pendingReg ||
      (lifecycle && (isPendingApproval(lifecycle) || needsActivation(lifecycle)));
    if (shouldGate && !onPendingRoute) {
      navigate({ to: "/student/pending" });
    }
  }, [gateQ.data, onPendingRoute, navigate]);

  const blockedLifecycle = gateQ.data?.lifecycle && isBlocked(gateQ.data.lifecycle) ? gateQ.data.lifecycle : null;

  if (!ready) return <PageSkeleton />;
  if (!signedIn) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 bg-background">
        <Card className="p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Sign in required</h1>
          <p className="text-sm text-muted-foreground">
            Please sign in with the email registered with your academy.
          </p>
          <Button onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
        </Card>
      </div>
    );
  }
  if (ctxQ.isLoading || gateQ.isLoading) return <PageSkeleton />;

  // Allow /student/pending to render even without a student record.
  if (onPendingRoute) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30">
        <Outlet />
      </div>
    );
  }

  if (blockedLifecycle) {
    const label = LIFECYCLE_LABEL[blockedLifecycle as LifecycleStatus] ?? blockedLifecycle;
    return (
      <div className="min-h-dvh grid place-items-center p-6 bg-background">
        <Card className="p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Account {label}</h1>
          <p className="text-sm text-muted-foreground">
            Your player account is currently marked as <b>{label.toLowerCase()}</b>. Please contact your academy for assistance.
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

  if (!ctxQ.data) {
    // No student record and no pending registration → guidance card.
    return (
      <div className="min-h-dvh grid place-items-center p-6 bg-background">
        <Card className="p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">No player record</h1>
          <p className="text-sm text-muted-foreground">
            Your sign-in email is not linked to a student. Please contact your academy so they can
            update your email in your profile.
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

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-muted/30 pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <Outlet />
      </div>

      {/* Bottom nav */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 pb-[env(safe-area-inset-bottom)]"
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

function PageSkeleton() {
  return (
    <div className="min-h-dvh p-6 space-y-3 max-w-3xl mx-auto">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
