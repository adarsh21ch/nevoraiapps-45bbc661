import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  UserCircle,
  Phone,
  Mail,
  HeartPulse,
  Calendar,
  IdCard,
  Users,
  LogOut,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { fetchStudentProfile, studentKeys } from "@/lib/student-app";
import { useParentChild } from "@/hooks/use-parent-child";

export const Route = createFileRoute("/parent/profile")({
  component: ParentProfilePage,
});

function ParentProfilePage() {
  const navigate = useNavigate();
  const { child, childRow } = useParentChild();
  const q = useQuery({
    queryKey: child ? studentKeys.profile(child.student_id) : ["parent", "profile", "none"],
    queryFn: () => fetchStudentProfile(child!),
    enabled: !!child,
  });

  if (!child || q.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const p = q.data!;
  const s = p.student as Record<string, string | null | undefined>;

  const playerInfo: { icon: React.ReactNode; label: string; value: string | null | undefined }[] = [
    { icon: <IdCard className="size-4" />, label: "Player ID", value: s.player_id },
    {
      icon: <Calendar className="size-4" />,
      label: "Joined",
      value: s.joined_at ? new Date(s.joined_at).toLocaleDateString() : null,
    },
    { icon: <UserCircle className="size-4" />, label: "Playing Role", value: s.playing_role },
    { icon: <UserCircle className="size-4" />, label: "Coach", value: s.coach_name },
  ];
  const parentInfo: { icon: React.ReactNode; label: string; value: string | null | undefined }[] = [
    { icon: <Users className="size-4" />, label: "Guardian", value: s.guardian_name },
    { icon: <Phone className="size-4" />, label: "Guardian phone", value: s.guardian_phone },
    { icon: <Mail className="size-4" />, label: "Player email", value: s.email },
    { icon: <Phone className="size-4" />, label: "Player phone", value: s.phone },
  ];
  const emergency: { icon: React.ReactNode; label: string; value: string | null | undefined }[] = [
    {
      icon: <Phone className="size-4" />,
      label: "Emergency contact",
      value:
        s.emergency_contact_name || s.emergency_contact_phone
          ? `${s.emergency_contact_name ?? ""}${
              s.emergency_contact_phone ? " · " + s.emergency_contact_phone : ""
            }`
          : null,
    },
  ];
  const medical: { icon: React.ReactNode; label: string; value: string | null | undefined }[] = [
    { icon: <HeartPulse className="size-4" />, label: "Blood group", value: s.blood_group },
    { icon: <HeartPulse className="size-4" />, label: "Medical notes", value: s.medical_notes },
  ];

  return (
    <div className="space-y-5">
      <Card className="p-5 flex items-center gap-4 bg-gradient-to-br from-primary/10 to-transparent">
        <div className="size-16 rounded-full bg-primary/20 grid place-items-center overflow-hidden">
          {s.photo_url ? (
            <img src={s.photo_url} alt="" className="size-full object-cover" />
          ) : (
            <UserCircle className="size-8 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{childRow.student_name}</h1>
          {s.player_id && <p className="text-xs text-muted-foreground">ID · {s.player_id}</p>}
          {childRow.relationship && (
            <p className="text-xs text-muted-foreground">
              Your relationship: {childRow.relationship}
            </p>
          )}
        </div>
      </Card>

      <Section title="Player Information" items={playerInfo} />
      <Section title="Parent Information" items={parentInfo} />
      <Section title="Emergency Contact" items={emergency} />
      <Section title="Medical Information" items={medical} />

      <section aria-label="Documents">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Documents & Certificates
        </p>
        <Card className="p-4 text-sm text-muted-foreground flex items-center gap-3">
          <FileText className="size-4" />
          Coming soon — certificates and documents will appear here.
        </Card>
      </section>

      <div className="pt-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="size-4 mr-2" /> Sign out
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: { icon: React.ReactNode; label: string; value: string | null | undefined }[];
}) {
  const visible = items.filter((i) => i.value);
  if (visible.length === 0) return null;
  return (
    <section aria-label={title}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
        {title}
      </p>
      <Card className="divide-y">
        {visible.map((i) => (
          <div key={i.label} className="p-3 flex items-center gap-3">
            <span className="text-muted-foreground">{i.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {i.label}
              </p>
              <p className="text-sm truncate">{i.value}</p>
            </div>
          </div>
        ))}
      </Card>
    </section>
  );
}
