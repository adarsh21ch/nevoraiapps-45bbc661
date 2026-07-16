import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MoreVertical } from "lucide-react";
import { AdmissionActionDialog } from "@/components/dashboard/AdmissionActionDialog";
import { useDashboard } from "@/lib/dashboard-context";
import { admissionsRegistrationsQuery } from "@/lib/admissions/queries";
import {
  rejectRegistration,
  waitlistRegistration,
} from "@/lib/admissions/admissions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterTabs, DashboardSearch } from "@/components/dashboard-ui";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admissions-review")({
  head: () => ({ meta: [{ title: "Admissions Review" }] }),
  component: AdmissionsReviewPage,
});

const PRIMARY_FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

const SECONDARY_FILTERS = [
  { key: "changes_requested", label: "Changes Requested" },
  { key: "waitlisted", label: "Waitlisted" },
] as const;

const ALL_FILTER_LABELS: Record<string, string> = {
  ...Object.fromEntries(PRIMARY_FILTERS.map((f) => [f.key, f.label])),
  ...Object.fromEntries(SECONDARY_FILTERS.map((f) => [f.key, f.label])),
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function AdmissionsReviewPage() {
  const { tenant } = useDashboard();
  const tenantId = tenant.id!;
  const [filter, setFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ id: string; mode: "approve" | "changes" } | null>(null);
  const { data: rows } = useSuspenseQuery(admissionsRegistrationsQuery(tenantId, filter));
  const qc = useQueryClient();

  const reject = useServerFn(rejectRegistration);
  const waitlist = useServerFn(waitlistRegistration);

  const rejectMut = useMutation({
    mutationFn: (registrationId: string) =>
      reject({ data: { registrationId, tenantId, reason: "Not eligible" } }),
    onSuccess: () => {
      toast.success("Registration rejected");
      qc.invalidateQueries({ queryKey: ["admissions"] });
    },
  });
  const waitlistMut = useMutation({
    mutationFn: (registrationId: string) => waitlist({ data: { registrationId, tenantId } }),
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
          r.email?.toLowerCase().includes(s) ||
          r.guardian_name?.toLowerCase().includes(s) ||
          r.guardian_phone?.includes(s) ||
          r.id?.toLowerCase().includes(s)
        );
      }),
    [rows, search],
  );

  const isSecondary = SECONDARY_FILTERS.some((f) => f.key === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admissions Review</h1>
          <p className="text-sm text-muted-foreground">Approve, request changes, waitlist, or reject applications.</p>
        </div>
        <Link to="/dashboard/students" className="text-sm text-primary underline">
          View all students →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <FilterTabs
            value={isSecondary ? "" : filter}
            onChange={setFilter}
            items={PRIMARY_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
            ariaLabel="Application status"
            fullWidth
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-11 rounded-full">
              {isSecondary ? ALL_FILTER_LABELS[filter] : "More filters"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SECONDARY_FILTERS.map((f) => (
              <DropdownMenuItem key={f.key} onSelect={() => setFilter(f.key)}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <DashboardSearch
        value={search}
        onChange={setSearch}
        placeholder="Search player, parent, phone or application ID..."
        ariaLabel="Search applications"
      />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">No applications in this queue.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((r: any) => {
            const canAct = r.review_status === "pending" || r.review_status === "changes_requested";
            const appliedAt = formatDate(r.created_at ?? r.submitted_at);
            const appId = r.id ? String(r.id).slice(0, 8).toUpperCase() : null;
            return (
              <Card key={r.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{r.name}</CardTitle>
                      {appId && (
                        <div className="text-xs text-muted-foreground font-mono">ID · {appId}</div>
                      )}
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {ALL_FILTER_LABELS[r.review_status] ?? r.review_status?.replaceAll("_", " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
                    {r.guardian_name && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Guardian</div>
                        <div>{r.guardian_name}</div>
                      </div>
                    )}
                    {(r.phone || r.guardian_phone) && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Phone</div>
                        <div>{r.phone ?? r.guardian_phone}</div>
                      </div>
                    )}
                    {appliedAt && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Date Applied</div>
                        <div>{appliedAt}</div>
                      </div>
                    )}
                    {(r.batch_name ?? r.requested_batch ?? r.sport) && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {r.batch_name || r.requested_batch ? "Requested Batch" : "Sport"}
                        </div>
                        <div>{r.batch_name ?? r.requested_batch ?? r.sport}</div>
                      </div>
                    )}
                  </div>
                  {r.review_notes && (
                    <div className="text-muted-foreground text-xs italic">Notes: {r.review_notes}</div>
                  )}
                  {canAct && (
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => setDialog({ id: r.id, mode: "changes" })}>
                        Request Changes
                      </Button>
                      <Button size="sm" onClick={() => setDialog({ id: r.id, mode: "approve" })}>
                        Approve
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" aria-label="More actions">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/dashboard/registrations" search={{ id: r.id } as any}>
                              View Application
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => waitlistMut.mutate(r.id)}
                            disabled={waitlistMut.isPending}
                          >
                            Waitlist
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => rejectMut.mutate(r.id)}
                            disabled={rejectMut.isPending}
                            className="text-destructive focus:text-destructive"
                          >
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AdmissionActionDialog
        registrationId={dialog?.id ?? null}
        mode={dialog?.mode ?? null}
        tenantId={tenantId}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
