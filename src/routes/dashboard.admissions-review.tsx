import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useDashboard } from "@/lib/dashboard-context";
import { admissionsRegistrationsQuery } from "@/lib/admissions/queries";
import {
  approveRegistration,
  rejectRegistration,
  waitlistRegistration,
} from "@/lib/admissions/admissions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admissions-review")({
  head: () => ({ meta: [{ title: "Admissions Review" }] }),
  component: () => (
    <DashboardShell>
      <AdmissionsReviewPage />
    </DashboardShell>
  ),
});

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "waitlisted", label: "Waitlisted" },
] as const;

function AdmissionsReviewPage() {
  const { tenantId } = useDashboard();
  const [filter, setFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const { data: rows } = useSuspenseQuery(admissionsRegistrationsQuery(tenantId!, filter));
  const qc = useQueryClient();

  const approve = useServerFn(approveRegistration);
  const reject = useServerFn(rejectRegistration);
  const waitlist = useServerFn(waitlistRegistration);

  const approveMut = useMutation({
    mutationFn: (registrationId: string) => approve({ data: { registrationId, tenantId: tenantId! } }),
    onSuccess: () => {
      toast.success("Registration approved");
      qc.invalidateQueries({ queryKey: ["admissions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to approve"),
  });
  const rejectMut = useMutation({
    mutationFn: (registrationId: string) =>
      reject({ data: { registrationId, tenantId: tenantId!, reason: "Not eligible" } }),
    onSuccess: () => {
      toast.success("Registration rejected");
      qc.invalidateQueries({ queryKey: ["admissions"] });
    },
  });
  const waitlistMut = useMutation({
    mutationFn: (registrationId: string) => waitlist({ data: { registrationId, tenantId: tenantId! } }),
    onSuccess: () => {
      toast.success("Waitlisted");
      qc.invalidateQueries({ queryKey: ["admissions"] });
    },
  });

  const filtered = useMemo(
    () =>
      rows.filter((r: any) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          r.name?.toLowerCase().includes(s) ||
          r.phone?.includes(s) ||
          r.email?.toLowerCase().includes(s)
        );
      }),
    [rows, search],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admissions Review</h1>
          <p className="text-sm text-muted-foreground">Approve, reject, or waitlist incoming applications.</p>
        </div>
        <Link to="/dashboard/students" className="text-sm text-primary underline">
          View all students →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
        <Input
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">No applications in this queue.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r: any) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {r.name} <span className="text-xs text-muted-foreground">· {r.phone}</span>
                  </CardTitle>
                  <Badge variant="outline">{r.review_status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                <div className="space-y-1">
                  {r.guardian_name && (
                    <div>
                      <span className="text-muted-foreground">Guardian:</span> {r.guardian_name} · {r.guardian_phone}
                    </div>
                  )}
                  {r.email && (
                    <div>
                      <span className="text-muted-foreground">Email:</span> {r.email}
                    </div>
                  )}
                  {r.sport && (
                    <div>
                      <span className="text-muted-foreground">Sport:</span> {r.sport}
                    </div>
                  )}
                  {r.dob && (
                    <div>
                      <span className="text-muted-foreground">DOB:</span> {r.dob}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-end justify-end gap-2">
                  {r.review_status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => approveMut.mutate(r.id)}
                        disabled={approveMut.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => waitlistMut.mutate(r.id)}
                        disabled={waitlistMut.isPending}
                      >
                        Waitlist
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMut.mutate(r.id)}
                        disabled={rejectMut.isPending}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
