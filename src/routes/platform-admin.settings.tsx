import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchPlatformSettings,
  platformSettingsKey,
  savePlatformSettings,
  waHref,
} from "@/lib/platform-settings";
import { ExternalLink, Mail, MessageCircle, Save } from "lucide-react";

export const Route = createFileRoute("/platform-admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: platformSettingsKey,
    queryFn: fetchPlatformSettings,
  });

  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (data) {
      setWhatsapp(data.contact_whatsapp);
      setEmail(data.contact_email);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      savePlatformSettings({
        contact_whatsapp: whatsapp.trim(),
        contact_email: email.trim(),
      }),
    onSuccess: () => {
      toast.success("Contact details saved");
      qc.invalidateQueries({ queryKey: platformSettingsKey });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not save");
    },
  });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const waValid = whatsapp.replace(/\D/g, "").length >= 10;
  const canSave = emailValid && waValid && !save.isPending;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Platform contact</h1>
        <p className="text-sm text-neutral-400">
          Shown on the public landing page so prospects can reach you.
        </p>
      </header>

      <Card className="p-6 bg-neutral-900 border-white/10 text-neutral-100 space-y-5 max-w-2xl">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 bg-white/5" />
            <Skeleton className="h-10 bg-white/5" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="text-neutral-300">
                WhatsApp number
              </Label>
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="9329040508"
                className="bg-neutral-950 border-white/10 text-white"
              />
              <p className="text-xs text-neutral-500">
                Indian 10-digit numbers get a 91 prefix automatically on wa.me links.
              </p>
              {whatsapp && waValid && (
                <a
                  href={waHref(whatsapp, "Hi — testing the Academy OS contact link")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                >
                  <MessageCircle className="size-3" /> Test WhatsApp link{" "}
                  <ExternalLink className="size-3" />
                </a>
              )}
              {whatsapp && !waValid && (
                <p className="text-xs text-rose-400">Enter at least 10 digits.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-300">
                Contact email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="team@nevorai.com"
                className="bg-neutral-950 border-white/10 text-white"
              />
              {email && emailValid && (
                <a
                  href={`mailto:${email.trim()}`}
                  className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200"
                >
                  <Mail className="size-3" /> Test mailto
                </a>
              )}
              {email && !emailValid && (
                <p className="text-xs text-rose-400">Enter a valid email address.</p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
              <Button
                onClick={() => save.mutate()}
                disabled={!canSave}
                className="bg-white text-neutral-900 hover:bg-neutral-100"
              >
                <Save className="size-4 mr-1" />
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
