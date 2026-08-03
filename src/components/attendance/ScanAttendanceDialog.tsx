/**
 * AcademyOS — In-app QR attendance scanner (student portal).
 *
 * Opens the phone camera, reads the academy's attendance QR poster, then runs
 * the EXACT same canonical flow the standalone `/checkin` page uses:
 * browser geolocation -> `qr_attendance_scan` RPC (append-only write with
 * GPS + radius verification). No attendance logic is duplicated here.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Loader2, MapPin, CheckCircle2, AlertCircle, QrCode, CameraOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getCurrentPosition,
  scanErrorMessage,
  submitQrScan,
  type QrScanResult,
} from "@/lib/attendance/qr";
import { formatDuration } from "@/lib/attendance/constants";

type Phase = "scanning" | "locating" | "sending" | "done" | "error";

/** Accepts a full check-in URL (`.../checkin?t=xyz`) or a bare token. */
export function extractToken(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const t = url.searchParams.get("t");
    if (t) return t;
  } catch {
    /* not a URL */
  }
  const m = raw.match(/[?&]t=([^&\s]+)/);
  if (m) return decodeURIComponent(m[1]);
  return /^[A-Za-z0-9_-]{8,}$/.test(raw) ? raw : null;
}

export function ScanAttendanceDialog({
  open,
  onOpenChange,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRecorded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("scanning");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<QrScanResult, { ok: true }> | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const record = useCallback(
    async (token: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      stopCamera();
      setPhase("locating");
      setMessage(null);
      try {
        const pos = await getCurrentPosition();
        setPhase("sending");
        // One silent retry — the RPC serialises per student and never
        // double-records, so retrying a dropped request is safe.
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const r = await submitQrScan({
              token,
              lat: pos.lat,
              lng: pos.lng,
              accuracy: pos.accuracy,
            });
            if (r.ok) {
              setResult(r);
              setPhase("done");
              onRecorded?.();
            } else {
              setMessage(scanErrorMessage(r));
              setPhase("error");
            }
            return;
          } catch {
            if (attempt === 0) {
              await new Promise((res) => setTimeout(res, 700));
              continue;
            }
            setMessage("Network hiccup — please try again.");
            setPhase("error");
          }
        }
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Couldn't get your location.");
        setPhase("error");
      } finally {
        busyRef.current = false;
      }
    },
    [onRecorded, stopCamera],
  );

  const startCamera = useCallback(async () => {
    busyRef.current = false;
    setResult(null);
    setMessage(null);
    setPhase("scanning");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        if (!ctx || !video.videoWidth || busyRef.current) return;
        const w = 480;
        const h = Math.round((video.videoHeight / video.videoWidth) * w);
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
        const token = code?.data ? extractToken(code.data) : null;
        if (token) void record(token);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setMessage(
        "Camera access is blocked. Allow camera for this site in your browser settings, then try again.",
      );
      setPhase("error");
    }
  }, [record]);

  useEffect(() => {
    if (open) void startCamera();
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) stopCamera();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="size-4 text-primary" />
            Mark attendance
          </DialogTitle>
        </DialogHeader>

        {phase === "scanning" ? (
          <div className="space-y-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} muted playsInline className="size-full object-cover" />
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Point your camera at the academy QR poster.
            </p>
          </div>
        ) : (
          <div className="py-3 text-center">
            <StatusIcon
              tone={phase === "done" ? "success" : phase === "error" ? "danger" : "neutral"}
            >
              {phase === "done" ? (
                <CheckCircle2 className="size-7" />
              ) : phase === "error" ? (
                message?.startsWith("Camera") ? (
                  <CameraOff className="size-7" />
                ) : (
                  <AlertCircle className="size-7" />
                )
              ) : phase === "locating" ? (
                <MapPin className="size-7" />
              ) : (
                <Loader2 className="size-7 animate-spin" />
              )}
            </StatusIcon>

            {phase === "locating" && (
              <>
                <p className="text-base font-semibold">Checking your location…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Allow location and hold still for a few seconds — we need a good GPS fix.
                </p>
              </>
            )}
            {phase === "sending" && <p className="text-base font-semibold">Recording…</p>}
            {phase === "done" && result && (
              <>
                <p className="text-base font-semibold">
                  {result.action === "check_in" ? "Checked in" : "Checked out"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.student_name} ·{" "}
                  {new Date(result.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {result.action === "check_out" && (
                  <p className="mt-1 text-sm font-medium">
                    Time at academy today: {formatDuration(result.total_minutes_today)}
                  </p>
                )}
                <Button
                  className="mt-5 h-11 w-full rounded-xl"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
              </>
            )}
            {phase === "error" && (
              <>
                <p className="text-base font-semibold">Couldn't mark attendance</p>
                <p className="mt-1 text-sm text-muted-foreground">{message}</p>
                <Button className="mt-5 h-11 w-full rounded-xl" onClick={() => void startCamera()}>
                  Try again
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusIcon({
  tone,
  children,
}: {
  tone: "neutral" | "success" | "danger";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-primary/10 text-primary"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground";
  return (
    <div className={`mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl ${cls}`}>
      {children}
    </div>
  );
}
