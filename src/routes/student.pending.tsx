import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { myPendingRegistrationQuery } from "@/lib/admissions/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/student/pending")({
  head: () => ({ meta: [{ title: "Registration Status" }] }),
  component: PendingPage,
});

function PendingPage() {
  const { data: reg } = useSuspenseQuery(myPendingRegistrationQuery());

  if (!reg) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>No registration found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">We couldn't find an application for this account.</p>
            <Button asChild className="mt-4">
              <Link to="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = reg.review_status ?? "pending";
  const label =
    status === "pending" ? "Under Review" : status === "waitlisted" ? "Waitlisted" : status === "rejected" ? "Rejected" : status;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your Application</h1>
        <p className="text-sm text-muted-foreground">Registration submitted on {new Date(reg.created_at).toLocaleDateString()}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Status</CardTitle>
          <Badge variant={status === "rejected" ? "destructive" : "outline"}>{label}</Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {status === "pending" && (
            <p className="text-muted-foreground">
              Your application is being reviewed by the academy. We'll notify you as soon as there's an update.
            </p>
          )}
          {status === "waitlisted" && (
            <p className="text-muted-foreground">
              You've been placed on the waitlist. The academy will reach out when a slot opens.
            </p>
          )}
          {status === "rejected" && (
            <>
              <p className="text-destructive">Unfortunately your application was not approved.</p>
              {reg.review_notes && <p className="text-muted-foreground">Reason: {reg.review_notes}</p>}
            </>
          )}
          {status === "approved" && (
            <p className="text-emerald-600">
              You're approved! Your student dashboard is now active — <Link to="/student" className="underline">go to dashboard</Link>.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submitted details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <Row k="Name" v={reg.name} />
          <Row k="Phone" v={reg.phone} />
          {reg.email && <Row k="Email" v={reg.email} />}
          {reg.guardian_name && <Row k="Guardian" v={reg.guardian_name} />}
          {reg.sport && <Row k="Sport" v={reg.sport} />}
          {reg.dob && <Row k="DOB" v={reg.dob} />}
          {reg.address && <Row k="Address" v={reg.address} />}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/"))}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{k}</div>
      <div>{v ?? "—"}</div>
    </div>
  );
}
