/* ================================================================
 * Tournament Share Dialog
 * ----------------------------------------------------------------
 * Reusable share sheet: copy link, QR code, native share fallback,
 * social intents. Presentation only.
 * ================================================================ */

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildQRDataUrl, copyToClipboard } from "@/lib/mc-tournament-export";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  title: string;
  description?: string;
}

export function TournamentShareDialog({ open, onOpenChange, url, title, description }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    if (open && url) {
      buildQRDataUrl(url, 220)
        .then((d) => alive && setQr(d))
        .catch(() => alive && setQr(null));
    }
    return () => {
      alive = false;
    };
  }, [open, url]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Could not copy");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator).share({ title, text: description, url });
      } catch {
        /* user dismissed */
      }
    } else {
      await handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share tournament</DialogTitle>
          <DialogDescription>Anyone with this link can view the public page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid place-items-center rounded-xl border border-border bg-muted/30 p-4">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR code" className="size-40 rounded-md bg-white p-1.5" />
            ) : (
              <div className="size-40 animate-pulse rounded-md bg-muted" />
            )}
          </div>
          <div className="flex gap-2">
            <Input readOnly value={url} className="text-xs" />
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleNativeShare}>
              <Share2 className="mr-1.5 size-3.5" /> Share
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <ExternalLink className="size-3.5" /> Open public page
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Twitter
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
