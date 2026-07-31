/**
 * AcademyOS — QR check-in setup (owner/admin).
 *
 * Pins the academy location, sets the allowed radius, generates the printable
 * QR poster and shows a live audit of every scan attempt (accepted and
 * rejected). All writes go through `set_attendance_qr_settings`; attendance
 * itself is written only by `qr_attendance_scan`.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { toast } from "sonner";
import { ArrowLeft, MapPin, RefreshCw, Printer, QrCode, Loader2 } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  fetchQrScanLog,
  fetchQrSettings,
  getCurrentPosition,
  qrKeys,
  saveQrSettings,
} from "@/lib/attendance/qr";

export const Route = createFileRoute("/dashboard/attendance-qr")({
  head: () => ({
    meta: [
      { title: "QR check-in setup · AcademyOS" },
      {
        name: "description",
        content:
          "Print an academy QR poster and let students check themselves in and out, verified by GPS.",
      },
    ],
  }),
  component: QrSetupPage,
});

function QrSetupPage() {
  const { tenant } = useDashboard();
  const { isAdmin } = usePermissions();
  const canEdit = isAdmin;
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: qrKeys.settings(tenant.id),
    queryFn: () => fetchQrSettings(tenant.id),
  });
  const logQ = useQuery({
    queryKey: qrKeys.scans(tenant.id),
    queryFn: () => fetchQrScanLog(tenant.id),
    refetchInterval: 30_000,
  });

  const s = settingsQ.data;
  const [radius, setRadius] = useState<number>(150);
  useEffect(() => {
    if (s?.radius_m) setRadius(s.radius_m);
  }, [s?.radius_m]);

  const save = useMutation({
    mutationFn: saveQrSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qrKeys.settings(tenant.id) });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't save"),
  });

  const checkinUrl = useMemo(() => {
    if (!s?.token || typeof window === "undefined") return null;
    return `${window.location.origin}/checkin?t=${s.token}`;
  }, [s?.token]);

  const [qrPng, setQrPng] = useState<string | null>(null);
  useEffect(() => {
    if (!checkinUrl) {
      setQrPng(null);
      return;
    }
    QRCode.toDataURL(checkinUrl, { width: 640, margin: 1 })
      .then(setQrPng)
      .catch(() => setQrPng(null));
  }, [checkinUrl]);

  const [pinning, setPinning] = useState(false);
  async function pinHere() {
    setPinning(true);
    try {
      const p = await getCurrentPosition();
      await save.mutateAsync({ tenantId: tenant.id, lat: p.lat, lng: p.lng });
      toast.success(`Academy location pinned (±${Math.round(p.accuracy ?? 0)} m)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read your location");
    } finally {
      setPinning(false);
    }
  }

  function printPoster() {
    if (!qrPng || typeof window === "undefined") return;
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${tenant.name} — Check-in QR</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,sans-serif;text-align:center;padding:48px 32px;margin:0}
        h1{font-size:34px;margin:0 0 4px}
        h2{font-size:20px;font-weight:500;color:#555;margin:0 0 28px}
        img{width:420px;height:420px}
        ol{display:inline-block;text-align:left;font-size:17px;line-height:1.7;margin-top:24px;color:#333}
        p.small{color:#777;font-size:13px;margin-top:26px}
      </style></head><body>
      <h1>${tenant.name}</h1>
      <h2>Scan to check in &amp; check out</h2>
      <img src="${qrPng}" alt="Check-in QR code" />
      <ol>
        <li>Open your phone camera and scan this code</li>
        <li>Sign in with your student account</li>
        <li>Allow location — you must be at the academy</li>
        <li>Scan again when you leave to check out</li>
      </ol>
      <p class="small">Attendance is GPS-verified. Scanning a photo of this code from elsewhere will not work.</p>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 md:px-8">
      <div className="mb-3 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link to="/dashboard/attendance" aria-label="Back to attendance">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-base font-semibold">QR check-in</h1>
          <p className="text-xs text-muted-foreground">
            Students scan a printed poster. GPS confirms they're at the academy.
          </p>
        </div>
      </div>

      {settingsQ.isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : settingsQ.isError ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Couldn't load QR settings.
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Enable */}
          <Card className="flex items-center justify-between gap-3 p-4">
            <div>
              <Label className="text-sm font-medium">Enable QR check-in</Label>
              <p className="text-xs text-muted-foreground">
                Off by default. Manual check-in always keeps working.
              </p>
            </div>
            <Switch
              checked={!!s?.enabled}
              disabled={!canEdit || save.isPending}
              onCheckedChange={(v) =>
                save.mutate(
                  { tenantId: tenant.id, enabled: v },
                  { onSuccess: () => toast.success(v ? "QR check-in on" : "QR check-in off") },
                )
              }
            />
          </Card>

          {/* Location */}
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Academy location</Label>
                <p className="text-xs text-muted-foreground">
                  {s?.lat != null && s?.lng != null
                    ? `Pinned at ${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`
                    : "Not set — stand at your academy and pin it."}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={!canEdit || pinning}
                onClick={pinHere}
                className="shrink-0 rounded-full"
              >
                {pinning ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <MapPin className="mr-1 size-3.5" />
                )}
                Pin here
              </Button>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Allowed radius</span>
                <span className="font-medium">{radius} m</span>
              </div>
              <Slider
                value={[radius]}
                min={50}
                max={1000}
                step={10}
                disabled={!canEdit}
                onValueChange={(v) => setRadius(v[0] ?? 150)}
                onValueCommit={(v) =>
                  save.mutate(
                    { tenantId: tenant.id, radiusM: v[0] ?? 150 },
                    { onSuccess: () => toast.success("Radius updated") },
                  )
                }
              />
            </div>
          </Card>

          {/* Poster */}
          <Card className="space-y-3 p-4 text-center">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Academy QR poster</Label>
              <Button
                size="sm"
                variant="ghost"
                disabled={!canEdit || save.isPending}
                onClick={() =>
                  save.mutate(
                    { tenantId: tenant.id, rotateToken: true },
                    {
                      onSuccess: () => toast.success("New QR generated — reprint the poster"),
                    },
                  )
                }
                className="rounded-full text-xs"
              >
                <RefreshCw className="mr-1 size-3.5" /> Rotate
              </Button>
            </div>
            {qrPng ? (
              <>
                <img
                  src={qrPng}
                  alt="Academy check-in QR code"
                  className="mx-auto size-48 rounded-xl border border-border/60 bg-white p-2"
                />
                <Button onClick={printPoster} className="h-11 w-full rounded-xl">
                  <Printer className="mr-2 size-4" /> Print poster
                </Button>
              </>
            ) : (
              <div className="py-6 text-sm text-muted-foreground">
                <QrCode className="mx-auto mb-2 size-6" />
                Turn on QR check-in to generate the poster.
              </div>
            )}
          </Card>

          {/* Audit */}
          <Card className="p-4">
            <Label className="text-sm font-medium">Recent scans</Label>
            <div className="mt-2 divide-y divide-border/60">
              {(logQ.data ?? []).length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No scans yet.</p>
              ) : (
                (logQ.data ?? []).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <span className="font-medium">
                      {row.result === "ok"
                        ? row.action === "check_in"
                          ? "Checked in"
                          : "Checked out"
                        : row.result.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted-foreground">
                      {row.distance_m != null ? `${Math.round(row.distance_m)} m · ` : ""}
                      {new Date(row.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
