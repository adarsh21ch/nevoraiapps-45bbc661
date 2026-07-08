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
import { CheckCheck, Trash2, Phone } from "lucide-react";

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
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Registrations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          New sign-ups from your website · newest first
          {newCount > 0 ? ` · ${newCount} unactioned` : ""}
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white shadow-sm animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl bg-white border border-black/[0.06] shadow-sm p-10 text-center">
          <div
            className="mx-auto h-14 w-14 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: "color-mix(in oklab, var(--brand) 12%, white)" }}
          >
            📮
          </div>
          <div className="mt-3 font-semibold">No registrations yet</div>
          <div className="text-sm text-muted-foreground mt-1">
            New sign-ups from your public site will appear here.
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((r: any) => (
            <RegistrationCard
              key={r.id}
              reg={r}
              onOpen={() => setOpenId(r.id)}
              onAccept={() => approve.mutate(r.id)}
              accepting={approve.isPending}
            />
          ))}
        </div>
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

function RegistrationCard({
  reg,
  onOpen,
  onAccept,
  accepting,
}: {
  reg: any;
  onOpen: () => void;
  onAccept: () => void;
  accepting: boolean;
}) {
  const plan = reg.fee_plans as { name?: string; amount?: number } | null;
  const batch = reg.batches as { name?: string } | null;
  const isNew = reg.status === "new";
  const approved = reg.status === "approved";
  const rejected = reg.status === "rejected";
  const paid = reg.payment_status === "verified" || reg.payment_status === "claimed_paid";
  return (
    <div
      className={cn(
        "rounded-2xl bg-white border shadow-sm p-4 flex flex-col gap-3 transition-shadow hover:shadow-md",
        approved
          ? "border-emerald-100"
          : rejected
            ? "border-rose-100 opacity-70"
            : "border-black/[0.06]",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex items-start gap-3 text-left"
      >
        <PersonAvatar name={reg.name} src={reg.photo_url} className="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{reg.name}</span>
            {isNew && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5"
                style={{ backgroundColor: "var(--brand)", color: "white" }}
              >
                New
              </span>
            )}
            {approved && (
              <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700">
                Accepted
              </span>
            )}
            {rejected && (
              <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-rose-50 text-rose-700">
                Rejected
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-0.5 inline-flex items-center gap-1">
            <Phone className="size-3" /> {reg.phone}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {batch?.name ?? "No batch"} · {plan?.name ?? "No plan"}
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between border-t border-black/[0.06] pt-3">
        <div>
          <div className="text-base font-bold tabular-nums">
            {plan?.amount ? money(Number(plan.amount)) : "—"}
          </div>
          <div
            className={cn(
              "text-[11px] font-semibold inline-flex items-center gap-1 mt-0.5",
              paid ? "text-emerald-700" : "text-rose-700",
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                paid ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
            {paid ? "Paid" : "Not paid"}
            {reg.payment_ref ? ` · ref ${reg.payment_ref.slice(0, 12)}` : ""}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {formatDistanceToNow(new Date(reg.created_at), { addSuffix: true })}
          </div>
        </div>
        {!approved && !rejected && (
          <Button
            onClick={onAccept}
            disabled={accepting}
            className="rounded-full h-10 px-5 font-semibold"
            style={{ backgroundColor: "var(--brand)", color: "white" }}
          >
            <CheckCheck className="size-4 mr-1" /> Accept
          </Button>
        )}
      </div>
    </div>
  );
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

      <dl className="rounded-2xl bg-white border border-black/[0.06] shadow-sm divide-y divide-black/[0.06] text-sm">
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
      <div className={cn("font-medium text-neutral-800", multiline ? "whitespace-pre-wrap" : "")}>
        {value}
      </div>
    </div>
  );
}
