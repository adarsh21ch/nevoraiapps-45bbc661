import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { activateStudent } from "@/lib/admissions/admissions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

export const Route = createFileRoute("/activate/$token")({
  head: () => ({ meta: [{ title: "Activate Account" }, { name: "robots", content: "noindex" }] }),
  component: ActivatePage,
});

type State =
  | { kind: "loading" }
  | { kind: "need_signin" }
  | { kind: "confirm"; student: { name: string; phone: string | null; email: string | null } }
  | { kind: "activating" }
  | { kind: "success" }
  | { kind: "already" }
  | { kind: "expired" }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

function ActivatePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const activate = useServerFn(activateStudent);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setState({ kind: "need_signin" });
        return;
      }
      // Look up token to distinguish invalid vs already-used before activating.
      const { data: student } = await supabase
        .from("students")
        .select("id, name, phone, email, lifecycle_status, activated_at, activation_token, activation_sent_at")
        .eq("activation_token", token)
        .maybeSingle();
      if (cancelled) return;
      if (!student) {
        // Check if maybe this user is already activated (token cleared).
        const { data: mine } = await supabase
          .from("students")
          .select("id, activated_at")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        setState({ kind: mine?.activated_at ? "already" : "invalid" });
        return;
      }
      if ((student as any).activated_at) {
        setState({ kind: "already" });
        return;
      }
      // 30-day expiry window from activation_sent_at (if present).
      const sentAt = (student as any).activation_sent_at;
      if (sentAt) {
        const ageMs = Date.now() - new Date(sentAt).getTime();
        if (ageMs > 30 * 24 * 60 * 60 * 1000) {
          setState({ kind: "expired" });
          return;
        }
      }
      setState({
        kind: "confirm",
        student: {
          name: (student as any).name,
          phone: (student as any).phone,
          email: (student as any).email,
        },
      });
    })();
    return () => { cancelled = true; };
  }, [token]);

  const doActivate = async () => {
    setState({ kind: "activating" });
    try {
      await activate({ data: { token } });
      setState({ kind: "success" });
      setTimeout(() => navigate({ to: "/student" }), 1200);
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "Activation failed" });
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Activate your account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {state.kind === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Checking link…
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
          {state.kind === "confirm" && (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Verify your details</div>
                <div className="font-medium">{state.student.name}</div>
                {state.student.phone && <div className="text-xs text-muted-foreground">{state.student.phone}</div>}
                {state.student.email && <div className="text-xs text-muted-foreground">{state.student.email}</div>}
              </div>
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(Boolean(v))} />
                <span>
                  I confirm the details above are correct and I accept the academy's terms of service.
                </span>
              </label>
              <Button className="w-full" onClick={doActivate} disabled={!accepted}>
                Activate my account
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Not you? <Link to="/auth" className="underline">Sign in with a different account</Link>.
              </p>
            </>
          )}
          {state.kind === "activating" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Activating…
            </div>
          )}
          {state.kind === "success" && (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="size-10 text-emerald-500" />
              <p className="font-medium">Account activated!</p>
              <p className="text-muted-foreground text-xs">Redirecting to your dashboard…</p>
            </div>
          )}
          {state.kind === "already" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="size-5" /> Already activated
              </div>
              <p className="text-muted-foreground">This account is already active — head to your dashboard.</p>
              <Button asChild><Link to="/student">Go to dashboard</Link></Button>
            </div>
          )}
          {state.kind === "expired" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-600">
                <Clock className="size-5" /> Link expired
              </div>
              <p className="text-muted-foreground">
                This activation link has expired. Please contact your academy to send a new one.
              </p>
              <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
            </div>
          )}
          {state.kind === "invalid" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="size-5" /> Invalid link
              </div>
              <p className="text-muted-foreground">
                This link isn't valid. Please check with your academy or request a new activation.
              </p>
              <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
            </div>
          )}
          {state.kind === "error" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="size-5" /> {state.message}
              </div>
              <Button asChild variant="outline"><Link to="/">Back to home</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
