/**
 * Phase 3 — Client hook wrapping the Postgres advisory-lock RPCs
 * (`acquire_match_scoring_lock` / `release_match_scoring_lock`).
 *
 * Semantics
 *   status = "pending"   → attempting to acquire on mount
 *   status = "acquired"  → this tab owns the lock; scoring is safe
 *   status = "blocked"   → another user/tab is already scoring this match
 *   status = "error"     → RPC failed (network etc.); scoring blocked defensively
 *
 * The lock is released on unmount and on page hide/close. A lightweight
 * heartbeat re-acquires every 30s so a crashed tab's lock ages out naturally
 * (RPC is idempotent for the same owner).
 */
import { useEffect, useRef, useState } from "react";
import { acquireMatchScoringLock, releaseMatchScoringLock } from "@/lib/bulk-ops";

export type ScoringLockStatus = "pending" | "acquired" | "blocked" | "error";

export function useScoringLock(matchId: string | undefined | null, enabled = true) {
  const [status, setStatus] = useState<ScoringLockStatus>("pending");
  const heldRef = useRef(false);

  useEffect(() => {
    if (!matchId || !enabled) {
      setStatus("pending");
      return;
    }
    let cancelled = false;

    const acquire = async () => {
      try {
        const ok = await acquireMatchScoringLock(matchId);
        if (cancelled) return;
        if (ok) {
          heldRef.current = true;
          setStatus("acquired");
        } else {
          setStatus("blocked");
        }
      } catch (e) {
        console.warn("[scoring-lock] acquire failed", e);
        if (!cancelled) setStatus("error");
      }
    };

    void acquire();
    const heartbeat = window.setInterval(() => void acquire(), 30_000);
    const onHide = () => {
      if (heldRef.current) {
        void releaseMatchScoringLock(matchId).catch(() => {});
      }
    };
    window.addEventListener("pagehide", onHide);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", onHide);
      if (heldRef.current) {
        heldRef.current = false;
        void releaseMatchScoringLock(matchId).catch(() => {});
      }
    };
  }, [matchId, enabled]);

  return status;
}
