import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "lucide-react";

type PublicSquadPlayer = {
  match_id: string;
  team_id: string | null;
  squad_row_id: string;
  athlete_profile_id: string | null;
  external_player_name: string | null;
  display_name: string | null;
  photo_url: string | null;
  role: string | null;
  batting_order: number | null;
  is_playing: boolean | null;
  is_captain: boolean | null;
  is_vice_captain: boolean | null;
  is_keeper: boolean | null;
  is_substitute: boolean | null;
};

export function SquadList({
  matchId,
  teamId,
  teamName,
}: {
  matchId: string;
  teamId: string;
  teamName: string;
}) {
  const q = useQuery({
    queryKey: ["public_match_squad", matchId, teamId],
    queryFn: async (): Promise<PublicSquadPlayer[]> => {
      // View isn't in generated types yet; cast the client.
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => {
                order: (c: string, o: { ascending: boolean; nullsFirst?: boolean }) => Promise<{ data: PublicSquadPlayer[] | null; error: unknown }>;
              };
            };
          };
        };
      };
      const { data, error } = await client
        .from("mc_public_squad_players")
        .select(
          "match_id,team_id,squad_row_id,athlete_profile_id,external_player_name,display_name,photo_url,role,batting_order,is_playing,is_captain,is_vice_captain,is_keeper,is_substitute",
        )
        .eq("match_id", matchId)
        .eq("team_id", teamId)
        .order("batting_order", { ascending: true, nullsFirst: false });
      if (error) throw error as Error;
      return (data ?? []) as PublicSquadPlayer[];
    },
    staleTime: 60_000,
  });

  const rows = q.data ?? [];
  const playing = rows.filter((r) => r.is_playing !== false && !r.is_substitute);
  const subs = rows.filter((r) => r.is_substitute);

  return (
    <section className="mt-6 rounded-3xl border border-border/60 bg-card p-4 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Squad · {teamName}
        </div>
        <div className="text-[10px] font-semibold tabular-nums text-muted-foreground">
          {playing.length} playing{subs.length ? ` · ${subs.length} sub` : ""}
        </div>
      </div>

      {q.isLoading ? (
        <div className="mt-4 text-center text-xs text-muted-foreground">Loading squad…</div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/50 px-3 py-6 text-center text-xs text-muted-foreground">
          Squad not published yet
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <PlayerGrid rows={playing} />
          {subs.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Substitutes
              </div>
              <PlayerGrid rows={subs} muted />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PlayerGrid({ rows, muted }: { rows: PublicSquadPlayer[]; muted?: boolean }) {
  return (
    <ul
      className={
        "grid grid-cols-1 gap-2 sm:grid-cols-2 " + (muted ? "opacity-80" : "")
      }
    >
      {rows.map((p) => (
        <li
          key={p.squad_row_id}
          className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/50 px-3 py-2"
        >
          <Avatar url={p.photo_url} name={p.display_name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">
                {p.display_name ?? "—"}
              </span>
              {p.is_captain && <Badge>C</Badge>}
              {p.is_vice_captain && <Badge>VC</Badge>}
              {p.is_keeper && <Badge>WK</Badge>}
            </div>
            {p.role && (
              <div className="truncate text-[11px] capitalize text-muted-foreground">
                {p.role.replace(/_/g, " ")}
              </div>
            )}
          </div>
          {p.batting_order != null && (
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
              #{p.batting_order}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? ""}
        loading="lazy"
        className="size-10 shrink-0 rounded-full object-cover ring-1 ring-border/60"
      />
    );
  }
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground ring-1 ring-border/60">
      {initials || <User className="size-4" />}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
      {children}
    </span>
  );
}
