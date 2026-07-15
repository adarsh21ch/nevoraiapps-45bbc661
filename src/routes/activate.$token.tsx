import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { activateStudent } from "@/lib/admissions/admissions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/activate/$token")({
  head: () => ({ meta: [{ title: "Activate Account" }, { name: "robots", content: "noindex" }] }),
  component: ActivatePage,
});

type State =
  | { kind: "loading" }
  | { kind: "need_signin" }
  | { kind: "success"; studentId: string }
  | { kind: "error"; message: string };

function ActivatePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const activate = useServerFn(activateStudent);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setState({ kind: "need_signin" });
        return;
      }
      try {
        const res = await activate({ data: { token } });
        if (cancelled) return;
        setState({ kind: "success", studentId: res.studentId });
        setTimeout(() => navigate({ to: "/student" }), 1500);
      } catch (e: any) {
        if (cancelled) return;
        setState({ kind: "error", message: e?.message ?? "Activation failed" });
      }
    })();
    return () => { cancelled = true; };
  }, [token, activate, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Activate your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {state.kind === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Activating…
            </div>
          )}
          {state.kind === "need_signin" && (
            <>
              <p className="text-muted-foreground">
                Please sign in with the email your academy has on file to complete activation.
              </p>
              <Button
                onClick={() =>
                  navigate({ to: "/auth", search: { redirect: `/activate/${token}` } as any })
                }
              >
                Sign in to continue
              </Button>
            </>
          )}
          {state.kind === "success" && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <p className="font-medium">Account activated!</p>
              <p className="text-muted-foreground text-xs">Redirecting to your dashboard…</p>
            </div>
          )}
          {state.kind === "error" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="size-5" /> {state.message}
              </div>
              <p className="text-muted-foreground">
                This link may be expired, already used, or invalid.
              </p>
              <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
