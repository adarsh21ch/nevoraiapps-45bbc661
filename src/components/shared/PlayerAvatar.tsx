import { Link } from "@tanstack/react-router";
import { User2 } from "lucide-react";

/**
 * Shared player avatar — photo if available, otherwise deterministic
 * initials chip in a gradient derived from the name. Optionally links
 * to the player profile.
 */
export interface PlayerAvatarProps {
  name?: string | null;
  photoUrl?: string | null;
  athleteId?: string | null;
  /** Pixel size — falls back to Tailwind size classes when omitted. */
  size?: 24 | 28 | 32 | 36 | 44 | 56 | 72;
  className?: string;
  /** Disable the wrapping Link even when athleteId is present. */
  noLink?: boolean;
  ring?: boolean;
}

const SIZE_MAP: Record<NonNullable<PlayerAvatarProps["size"]>, string> = {
  24: "size-6 text-[9px]",
  28: "size-7 text-[10px]",
  32: "size-8 text-[11px]",
  36: "size-9 text-xs",
  44: "size-11 text-sm",
  56: "size-14 text-base",
  72: "size-[72px] text-lg",
};

const GRADIENT_TOKENS: Array<[string, string]> = [
  ["from-primary/40", "to-primary/10"],
  ["from-emerald-500/40", "to-emerald-500/10"],
  ["from-sky-500/40", "to-sky-500/10"],
  ["from-amber-500/40", "to-amber-500/10"],
  ["from-rose-500/40", "to-rose-500/10"],
  ["from-violet-500/40", "to-violet-500/10"],
  ["from-teal-500/40", "to-teal-500/10"],
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialsOf(name?: string | null): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PlayerAvatar({
  name,
  photoUrl,
  athleteId,
  size = 36,
  className = "",
  noLink = false,
  ring = false,
}: PlayerAvatarProps) {
  const sizeCls = SIZE_MAP[size];
  const initials = initialsOf(name);
  const [g1, g2] = GRADIENT_TOKENS[hashName(name ?? "") % GRADIENT_TOKENS.length];
  const ringCls = ring ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : "";

  const inner = photoUrl ? (
    <img
      src={photoUrl}
      alt={name ? `${name} photo` : "Player photo"}
      loading="lazy"
      decoding="async"
      className={`${sizeCls} ${ringCls} shrink-0 rounded-full object-cover ${className}`}
    />
  ) : (
    <div
      aria-label={name ? `${name} avatar` : "Player avatar"}
      className={`${sizeCls} ${ringCls} shrink-0 rounded-full bg-gradient-to-br ${g1} ${g2} grid place-items-center font-black text-foreground/80 ${className}`}
    >
      {initials || <User2 className="size-1/2" />}
    </div>
  );

  if (athleteId && !noLink) {
    return (
      <Link
        to="/match-center/players/$athleteId"
        params={{ athleteId }}
        className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={name ? `View ${name}'s profile` : "View player profile"}
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
