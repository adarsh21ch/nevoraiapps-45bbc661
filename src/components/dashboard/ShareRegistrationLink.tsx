/**
 * Share the academy's public self-registration link.
 *
 * The fastest way to onboard a WhatsApp group: paste one link (or show one QR),
 * every player/parent registers themselves, and the owner just approves.
 */
import { useEffect, useMemo, useState } from "react";
import { Copy, MessageCircle, QrCode, Download, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDashboard } from "@/lib/dashboard-context";
import { tenantSiteUrl } from "@/lib/tenant";

export function useRegistrationLink() {
  const { tenant } = useDashboard();
  return useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = tenantSiteUrl(tenant as never);
    // Fallback base already carries ?tenant=slug — keep the param on /register.
    if (base.includes("?tenant=")) {
      const [origin, q] = base.split("?");
      return `${origin.replace(/\/$/, "")}/register?${q}`;
    }
    return `${base.replace(/\/$/, "")}/register`;
  }, [tenant]);
}

export function ShareRegistrationLink({
  trigger,
  variant = "outline",
}: {
  trigger?: React.ReactNode;
  variant?: "outline" | "ghost" | "default";
}) {
  const { tenant } = useDashboard();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const link = useRegistrationLink();

  useEffect(() => {
    if (!open || !link) return;
    let alive = true;
    (async () => {
      const { default: QRCode } = await import("qrcode");
      const url = await QRCode.toDataURL(link, { width: 640, margin: 1 });
      if (alive) setQr(url);
    })();
    return () => {
      alive = false;
    };
  }, [open, link]);

  const message = `Join ${tenant.name} 🏏\n\nRegister here — it takes 2 minutes:\n${link}\n\nCreate your login, fill your details, and you're in.`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Registration link copied");
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(message);
    toast.success("Message copied — paste it in your WhatsApp group");
  };

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${tenant.name} registration`, text: message, url: link });
      } catch {
        /* user cancelled */
      }
    } else {
      copyMessage();
    }
  };

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `${tenant.slug || "academy"}-registration-qr.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={variant} size="sm" className="rounded-full h-9 shrink-0">
            <Share2 className="size-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Invite</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite players to register</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Share this link in your WhatsApp group — or print the QR at the academy. Everyone who
          registers lands in <span className="font-medium text-foreground">Registrations</span> for
          your approval.
        </p>

        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Registration link
          </div>
          <div className="mt-1 break-all text-sm font-medium">{link}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={whatsapp} className="rounded-xl h-11 bg-[#25D366] hover:bg-[#1fb457] text-white">
            <MessageCircle className="size-4 mr-1.5" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={copy} className="rounded-xl h-11">
            <Copy className="size-4 mr-1.5" /> Copy link
          </Button>
          <Button variant="outline" onClick={copyMessage} className="rounded-xl h-11">
            <Copy className="size-4 mr-1.5" /> Copy message
          </Button>
          <Button variant="outline" onClick={nativeShare} className="rounded-xl h-11">
            <Share2 className="size-4 mr-1.5" /> Share…
          </Button>
        </div>

        <div className="rounded-2xl border p-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <QrCode className="size-3.5" /> Scan to register
          </div>
          {qr ? (
            <img src={qr} alt="Registration QR code" className="w-48 h-48 rounded-lg border bg-white" />
          ) : (
            <div className="w-48 h-48 animate-pulse rounded-lg bg-muted" />
          )}
          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={downloadQr}>
              <Download className="size-3.5 mr-1.5" /> Download QR
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 rounded-lg"
              onClick={() => window.open(link, "_blank", "noopener")}
            >
              <ExternalLink className="size-3.5 mr-1.5" /> Preview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
