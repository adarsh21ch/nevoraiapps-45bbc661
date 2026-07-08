import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchRegistrations, qk } from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CheckCheck, Trash2, Phone, Share2, Copy } from "lucide-react";

export const Route = createFileRoute("/dashboard/registrations")({
  component: RegistrationsInbox,
});

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function RegistrationsInbox() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: qk.regs(tenant.id),
    queryFn: () => fetchRegistrations(tenant.id),
  });

  const [openId, setOpenId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.regs(tenant.id) });
    qc.invalidateQueries({ queryKey: ["d", "regs-new-count", tenant.id] });
    qc.invalidateQueries({ queryKey: qk.kpis(tenant.id) });
    qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
  };

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { data: newId, error } = await supabase.rpc("approve_registration" as never, {
        _registration_id: id,
      } as never);
      if (error) throw error;
      return newId;
    },
    onSuccess: () => {
      toast.success("Accepted — student added");
      invalidate();
      setOpenId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registration deleted");
      invalidate();
      setOpenId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sorted = useMemo(
    () =>
      [...data].sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [data],
  );

  const openReg = sorted.find((r: any) => r.id === openId) ?? null;
  const newCount = sorted.filter((r: any) => r.status === "new").length;

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            New sign-ups from your website · newest first
            {newCount > 0 ? ` · ${newCount} unactioned` : ""}
          </p>
        </div>
        <ShareLinkButton tenant={tenant} />
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border shadow-sm p-10 text-center">
          <div
            className="mx-auto h-14 w-14 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: "color-mix(in oklab, var(--brand) 20%, transparent)" }}
          >
            📮
          </div>
          <div className="mt-3 font-semibold">No registrations yet</div>
          <div className="text-sm text-muted-foreground mt-1">
            New sign-ups from your public site will appear here.
          </div>
        </div>
      ) : (
        <RegistrationsTable
          rows={sorted}
          onOpen={(id) => setOpenId(id)}
          onAccept={(id) => approve.mutate(id)}
          onReject={(id) => del.mutate(id)}
          accepting={approve.isPending}
          rejecting={del.isPending}
        />
      )}

      <RegistrationSheet
        reg={openReg}
        onClose={() => setOpenId(null)}
        onAccept={() => openReg && approve.mutate(openReg.id)}
        onDelete={() => openReg && del.mutate(openReg.id)}
        accepting={approve.isPending}
        deleting={del.isPending}
      />
    </div>
  );
}

function ShareLinkButton({
  tenant,
}: {
  tenant: {
    name: string;
    slug: string;
    custom_domain?: string | null;
    whatsapp?: string | null;
    phone?: string | null;
  };
}) {
  const link =
    tenant.custom_domain
      ? `https://${tenant.custom_domain}/register`
      : typeof window !== "undefined"
        ? `${window.location.origin}/register?tenant=${tenant.slug}`
        : `/register?tenant=${tenant.slug}`;
  const contact = (tenant.whatsapp ?? tenant.phone ?? "").toString();
  const message = `Sign up for ${tenant.name} training — ${link}${
    contact ? ` · Coach: ${contact}` : ""
  }`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(link).then(
              () => toast.success("Link copied"),
              () => toast.error("Could not copy"),
            );
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
      >
        <Copy className="size-3.5" /> Copy link
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm bg-emerald-600 hover:bg-emerald-700"
      >
        <Share2 className="size-3.5" /> Share on WhatsApp
      </a>
    </div>
  );
}

function RegistrationsTable({
  rows,
  onOpen,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: {
  rows: any[];
  onOpen: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  accepting: boolean;
  rejecting: boolean;
}) {
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [confirmAcceptId, setConfirmAcceptId] = useState<string | null>(null);
  const rejectTarget = rows.find((r) => r.id === confirmRejectId);
  const acceptTarget = rows.find((r) => r.id === confirmAcceptId);

  return (
    <>
      {/* Desktop / tablet — proper table */}
      <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/50">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Batch · Plan</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, idx) => {
              const plan = r.fee_plans as { name?: string } | null;
              const batch = r.batches as { name?: string } | null;
              const status = statusMeta(r);
              const actionable = r.status !== "approved" && r.status !== "rejected";
              return (
                <tr key={r.id} className="hover:bg-accent/60 transition-colors">
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(r.id)}
                      className="flex items-center gap-2.5 text-left hover:underline"
                    >
                      <PersonAvatar name={r.name} src={r.photo_url} className="h-8 w-8 text-xs" />
                      <span className="font-semibold truncate max-w-[160px]">{r.name}</span>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground tabular-nums">{r.phone}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    <div className="truncate max-w-[180px]">{batch?.name ?? "—"}</div>
                    <div className="truncate max-w-[180px] opacity-70">{plan?.name ?? ""}</div>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {actionable ? (
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => setConfirmAcceptId(r.id)}
                          disabled={accepting}
                          className="h-8 rounded-full font-semibold text-white"
                          style={{ backgroundColor: "var(--brand)" }}
                        >
                          <CheckCheck className="size-3.5 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmRejectId(r.id)}
                          disabled={rejecting}
                          className="h-8 rounded-full text-rose-500 border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500"
                        >
                          <Trash2 className="size-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile — stacked rows, still numbered */}
      <div className="md:hidden space-y-2">
        {rows.map((r, idx) => {
          const status = statusMeta(r);
          const actionable = r.status !== "approved" && r.status !== "rejected";
          const batch = r.batches as { name?: string } | null;
          return (
            <div
              key={r.id}
              className="rounded-xl border border-border bg-card p-3 flex items-center gap-3"
            >
              <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0">
                {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
              >
                <PersonAvatar name={r.name} src={r.photo_url} className="h-9 w-9 text-xs shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold truncate text-sm">{r.name}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {r.phone} · {batch?.name ?? "No batch"}
                  </div>
                </div>
              </button>
              {actionable ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmAcceptId(r.id)}
                    disabled={accepting}
                    aria-label="Accept"
                    className="inline-grid place-items-center size-9 rounded-full text-white"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    <CheckCheck className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRejectId(r.id)}
                    disabled={rejecting}
                    aria-label="Reject"
                    className="inline-grid place-items-center size-9 rounded-full border border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmAcceptId} onOpenChange={(o) => !o && setConfirmAcceptId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Accept {acceptTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add them as a student with an auto-generated Player ID.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={accepting}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAcceptId) onAccept(confirmAcceptId);
                setConfirmAcceptId(null);
              }}
              style={{ backgroundColor: "var(--brand)", color: "#fff" }}
            >
              Yes, accept
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmRejectId} onOpenChange={(o) => !o && setConfirmRejectId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {rejectTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This registration will be permanently deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={rejecting}
              onClick={(e) => {
                e.preventDefault();
                if (confirmRejectId) onReject(confirmRejectId);
                setConfirmRejectId(null);
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function statusMeta(r: any): { label: string; className: string } {
  if (r.status === "approved")
    return { label: "Accepted", className: "bg-emerald-500/15 text-emerald-500" };
  if (r.status === "rejected")
    return { label: "Rejected", className: "bg-rose-500/15 text-rose-500" };
  return { label: "New", className: "bg-[var(--brand)]/20 text-[var(--brand)]" };
}

function RegistrationSheet({
  reg,
  onClose,
  onAccept,
  onDelete,
  accepting,
  deleting,
}: {
  reg: any | null;
  onClose: () => void;
  onAccept: () => void;
  onDelete: () => void;
  accepting: boolean;
  deleting: boolean;
}) {
  const isMobile = useIsMobile();
  const [confirmDel, setConfirmDel] = useState(false);
  const open = !!reg;
  const content = reg ? (
    <RegistrationDetails
      reg={reg}
      accepting={accepting}
      deleting={deleting}
      onAccept={onAccept}
      onRequestDelete={() => setConfirmDel(true)}
    />
  ) : null;

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl p-0 border-0 max-h-[92vh] overflow-y-auto"
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-black/10" />
            <div className="p-5 pt-3">
              <SheetHeader>
                <SheetTitle className="text-left sr-only">Registration</SheetTitle>
              </SheetHeader>
              {content}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
          <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="sr-only">Registration</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      )}
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this registration?</AlertDialogTitle>
            <AlertDialogDescription>
              Only do this for spam or mistakes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                onDelete();
                setConfirmDel(false);
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RegistrationDetails({
  reg,
  accepting,
  deleting,
  onAccept,
  onRequestDelete,
}: {
  reg: any;
  accepting: boolean;
  deleting: boolean;
  onAccept: () => void;
  onRequestDelete: () => void;
}) {
  const plan = reg.fee_plans as { name?: string; amount?: number } | null;
  const batch = reg.batches as { name?: string } | null;
  const paid = reg.payment_status === "verified" || reg.payment_status === "claimed_paid";
  const waPhone = (reg.phone || "").replace(/\D/g, "");
  const approved = reg.status === "approved";
  const rejected = reg.status === "rejected";

  return (
    <div className="space-y-5 pt-2 pb-2">
      <div className="flex flex-col items-center text-center gap-2">
        <PersonAvatar
          name={reg.name}
          src={reg.photo_url}
          className="h-20 w-20 ring-4 ring-white shadow-sm"
        />
        <div className="text-lg font-bold">{reg.name}</div>
        <div className="text-xs text-muted-foreground">
          Submitted {formatDistanceToNow(new Date(reg.created_at), { addSuffix: true })}
        </div>
      </div>

      <dl className="rounded-2xl bg-card border border-border shadow-sm divide-y divide-border text-sm">
        <DRow label="Phone" value={reg.phone} />
        {reg.whatsapp && reg.whatsapp !== reg.phone && (
          <DRow label="WhatsApp" value={reg.whatsapp} />
        )}
        {reg.guardian_name && <DRow label="Parent" value={reg.guardian_name} />}
        {reg.guardian_phone && <DRow label="Parent phone" value={reg.guardian_phone} />}
        {reg.dob && (
          <DRow
            label="DOB"
            value={new Date(reg.dob).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          />
        )}
        {reg.address && <DRow label="Address" value={reg.address} multiline />}
        <DRow label="Batch" value={batch?.name ?? "—"} />
        <DRow
          label="Fee plan"
          value={plan?.name ? `${plan.name}${plan.amount ? ` · ${money(plan.amount)}` : ""}` : "—"}
        />
        <DRow
          label="Payment"
          value={
            paid
              ? `Paid${reg.payment_ref ? ` · ref ${reg.payment_ref}` : ""}`
              : "Not marked paid"
          }
        />
      </dl>

      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1 rounded-xl h-11">
          <a href={`tel:${reg.phone}`}>
            <Phone className="size-4 mr-1.5" /> Call
          </a>
        </Button>
        <Button
          asChild
          className="flex-1 rounded-xl h-11"
          style={{ backgroundColor: "#25D366", color: "white" }}
        >
          <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </Button>
      </div>

      {!approved && !rejected && (
        <Button
          onClick={onAccept}
          disabled={accepting}
          className="w-full h-14 rounded-xl text-base font-semibold"
          style={{ backgroundColor: "var(--brand)", color: "white" }}
        >
          <CheckCheck className="size-5 mr-2" />
          {accepting ? "Accepting…" : "Accept as student"}
        </Button>
      )}
      {approved && (
        <div className="text-center text-sm font-medium text-emerald-700">
          ✓ Already accepted as a student
        </div>
      )}

      <button
        type="button"
        onClick={onRequestDelete}
        disabled={deleting}
        className="w-full text-center text-xs text-muted-foreground hover:text-rose-600 inline-flex items-center justify-center gap-1 py-1"
      >
        <Trash2 className="size-3.5" /> Cancel / delete
      </button>
    </div>
  );
}

function DRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="px-4 py-3 grid grid-cols-[100px_minmax(0,1fr)] gap-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("font-medium text-foreground", multiline ? "whitespace-pre-wrap" : "")}>
        {value}
      </div>
    </div>
  );
}
