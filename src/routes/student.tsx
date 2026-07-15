import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Home, TrendingUp, Building2, UserCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyStudentContext, studentKeys } from "@/lib/student-app";
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

  if (!ready) return <PageSkeleton />;
  if (!signedIn) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background">
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
  if (ctxQ.isLoading) return <PageSkeleton />;
  if (!ctxQ.data) {
    return (
      <div className="min-h-screen grid place-items-center p-6 bg-background">
        <Card className="p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">No player record</h1>
          <p className="text-sm text-muted-foreground">
            Your sign-in email is not linked to a student. Please contact your academy so
            they can update your email in your profile.
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <Outlet />
      </div>

      {/* Bottom nav */}
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

function PageSkeleton() {
  return (
    <div className="min-h-screen p-6 space-y-3 max-w-3xl mx-auto">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
