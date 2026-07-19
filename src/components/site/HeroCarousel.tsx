import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { signedUrl } from "@/lib/storage";

/**
 * Auto-sliding background image carousel used behind public page heroes.
 * - 0 images → renders nothing (parent keeps its default gradient background).
 * - 1 image → static.
 * - 2+ images → crossfade every 5s, respects prefers-reduced-motion.
 *
 * Images sit behind a dark scrim so overlaid white text stays readable on any photo.
 */
export function HeroCarousel({
  paths,
  intervalMs = 5000,
  scrim = true,
}: {
  paths: string[] | null | undefined;
  intervalMs?: number;
  scrim?: boolean;
}) {
  const list = useMemo(() => (paths ?? []).filter(Boolean), [paths]);
  const [urls, setUrls] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all(
      list.map((p) => (p.startsWith("http") ? Promise.resolve(p) : signedUrl(p).catch(() => ""))),
    ).then((resolved) => {
      if (active) setUrls(resolved.filter((u): u is string => !!u));
    });
    return () => {
      active = false;
    };
  }, [list]);

  useEffect(() => {
    if (urls.length < 2) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % urls.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [urls.length, intervalMs]);

  if (urls.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence mode="sync">
        <motion.div
          key={urls[idx]}
          initial={{ opacity: 0, scale: 1.04, x: 24 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 1, x: -24 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${urls[idx]})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </AnimatePresence>
      {scrim ? (
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/55" />
      ) : null}
      {urls.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {urls.map((_, i) => (
            <span
              key={i}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === idx ? "w-6 bg-white/90" : "w-1.5 bg-white/45")
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
