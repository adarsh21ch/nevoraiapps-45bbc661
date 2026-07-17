import { Link } from "@tanstack/react-router";
import { ArrowRight, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { useTenant } from "@/lib/tenant-context";
import { StoragedImage } from "./StoragedImage";

export type RawStarPlayer = {
  name: string;
  achievement: string;
  photo_url?: string | null;
  teams?: string[] | string | null;
  featured?: boolean | string | null;
  currently_playing?: string | null;
};

export type StarPlayer = {
  name: string;
  achievement: string;
  photo_url?: string | null;
  teams: string[];
  featured: boolean;
  currently_playing: string | null;
};

export function normalizeStar(raw: RawStarPlayer): StarPlayer {
  const teams = Array.isArray(raw.teams)
    ? raw.teams.filter(Boolean).map(String)
    : typeof raw.teams === "string"
      ? raw.teams
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const featured = raw.featured === true || raw.featured === "true";
  return {
    name: raw.name,
    achievement: raw.achievement,
    photo_url: raw.photo_url ?? null,
    teams,
    featured,
    currently_playing: raw.currently_playing ?? null,
  };
}

/** Pick which player to render as the featured hero card. */
export function pickFeatured(players: StarPlayer[]): {
  featured: StarPlayer | null;
  rest: StarPlayer[];
} {
  if (players.length === 0) return { featured: null, rest: [] };
  const flagged = players.findIndex((p) => p.featured);
  const idx = flagged >= 0 ? flagged : 0;
  return {
    featured: players[idx],
    rest: players.filter((_, i) => i !== idx),
  };
}

/** Big split hero card for the top star. */
export function StarPlayerFeaturedCard({ player }: { player: StarPlayer }) {
  const tenant = useTenant();
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center"
    >
      <div className="relative">
        <div
          className="absolute -inset-4 rounded-[36px] opacity-40 blur-2xl"
          style={{
            background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.secondary_color})`,
          }}
        />
        <div
          className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-white/15 bg-white/[0.04]"
          style={{ boxShadow: `0 30px 80px -30px ${tenant.primary_color}80` }}
        >
          <StoragedImage
            path={player.photo_url}
            alt={player.name}
            className="h-full w-full object-cover"
            fallback={
              <div
                className="grid h-full w-full place-items-center text-7xl font-black text-white"
                style={{
                  background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.secondary_color})`,
                }}
              >
                {player.name.charAt(0)}
              </div>
            }
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
      </div>

      <div>
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{ color: tenant.primary_color }}
        >
          From {tenant.name} to the National Stage
        </div>
        <h3 className="mt-4 text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl">
          {player.name}
        </h3>
        {player.currently_playing ? (
          <div className="mt-3 text-lg font-semibold text-white/85">
            {player.currently_playing}
          </div>
        ) : null}
        <p className="mt-5 flex items-start gap-2 text-base leading-relaxed text-white/70 sm:text-lg">
          <Trophy
            className="mt-1 h-5 w-5 flex-shrink-0"
            style={{ color: tenant.primary_color }}
          />
          <span>{player.achievement}</span>
        </p>

        {player.teams.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {player.teams.map((t, i) => (
              <span
                key={i}
                className="rounded-full border border-white/20 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-white/90 backdrop-blur"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-8">
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.secondary_color})`,
            }}
          >
            Your child could be next
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

/** Compact secondary card for non-featured stars. */
export function StarPlayerCard({ player }: { player: StarPlayer }) {
  const tenant = useTenant();
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 transition-all hover:-translate-y-1 hover:border-white/25">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl transition-opacity group-hover:opacity-90"
        style={{ backgroundColor: `${tenant.primary_color}40` }}
      />
      <div className="relative flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 ring-white/20">
          <StoragedImage
            path={player.photo_url}
            alt={player.name}
            className="h-full w-full object-cover"
            fallback={
              <div
                className="flex h-full w-full items-center justify-center text-xl font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${tenant.primary_color}, ${tenant.secondary_color})`,
                }}
              >
                {player.name.charAt(0)}
              </div>
            }
          />
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{player.name}</div>
          <div className="line-clamp-2 text-sm text-white/60">{player.achievement}</div>
          {player.teams.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {player.teams.slice(0, 3).map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/80"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
