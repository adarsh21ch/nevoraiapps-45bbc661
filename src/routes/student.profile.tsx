import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  UserCircle,
  Phone,
  Mail,
  HeartPulse,
  Calendar,
  IdCard,
  Award,
  Trophy,
  LogOut,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyStudentContext, fetchStudentProfile, studentKeys } from "@/lib/student-app";

export const Route = createFileRoute("/student/profile")({
  component: StudentProfilePage,
});

function StudentProfilePage() {
  const navigate = useNavigate();
  const ctxQ = useQuery({ queryKey: studentKeys.me, queryFn: fetchMyStudentContext });
  const ctx = ctxQ.data;
  const q = useQuery({
    queryKey: ctx ? studentKeys.profile(ctx.student_id) : ["student", "profile", "none"],
    queryFn: () => fetchStudentProfile(ctx!),
    enabled: !!ctx,
  });

  if (!ctx || q.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const p = q.data!;
  const s = p.student as Record<string, string | null | undefined>;

  const items: { icon: React.ReactNode; label: string; value: string | null | undefined }[] = [
    { icon: <IdCard className="size-4" />, label: "Player ID", value: s.player_id },
    {
      icon: <Calendar className="size-4" />,
      label: "Joined",
      value: s.joined_at ? new Date(s.joined_at).toLocaleDateString() : null,
    },
    { icon: <UserCircle className="size-4" />, label: "Playing Role", value: s.playing_role },
    { icon: <UserCircle className="size-4" />, label: "Coach", value: s.coach_name },
    { icon: <Mail className="size-4" />, label: "Email", value: s.email },
    { icon: <Phone className="size-4" />, label: "Phone", value: s.phone },
    {
      icon: <Phone className="size-4" />,
      label: "Emergency Contact",
      value:
        s.emergency_contact_name || s.emergency_contact_phone
          ? `${s.emergency_contact_name ?? ""}${
              s.emergency_contact_phone ? " · " + s.emergency_contact_phone : ""
            }`
          : null,
    },
    { icon: <HeartPulse className="size-4" />, label: "Blood Group", value: s.blood_group },
    { icon: <HeartPulse className="size-4" />, label: "Medical Notes", value: s.medical_notes },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <Card className="p-5 flex items-center gap-4 bg-gradient-to-br from-primary/10 to-transparent">
        <div className="size-16 rounded-full bg-primary/20 grid place-items-center overflow-hidden">
          {s.photo_url ? (
            <img src={s.photo_url} alt="" className="size-full object-cover" />
          ) : (
            <UserCircle className="size-8 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{s.name}</h1>
          {s.player_id && (
            <p className="text-xs text-muted-foreground">ID · {s.player_id}</p>
          )}
          {s.playing_role && (
            <p className="text-xs text-muted-foreground">{s.playing_role}</p>
          )}
        </div>
      </Card>

      {/* Personal details */}
      <section aria-label="Personal details">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Personal Details
        </p>
        <Card className="divide-y">
          {items
            .filter((i) => i.value)
            .map((i) => (
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

      {/* Achievements */}
      {p.achievements.length > 0 && (
        <section aria-label="Achievements">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Achievements
          </p>
          <div className="space-y-2">
            {p.achievements.slice(0, 10).map((a) => (
              <Card key={a.id} className="p-3 flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 grid place-items-center text-primary">
                  <Award className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {a.event_date && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.event_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Awards */}
      {p.awards.length > 0 && (
        <section aria-label="Awards">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Awards
          </p>
          <div className="space-y-2">
            {p.awards.slice(0, 10).map((a) => (
              <Card key={a.id} className="p-3 flex items-center gap-3">
                <div className="size-8 rounded-full bg-amber-500/15 grid place-items-center text-amber-600 dark:text-amber-400">
                  <Trophy className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {a.event_date && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.event_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Future modules */}
      <section aria-label="Coming soon">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Coming Soon
        </p>
        <Card className="p-4 text-sm text-muted-foreground flex items-center gap-3">
          <FileText className="size-4" />
          Documents & Certificates will appear here.
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
