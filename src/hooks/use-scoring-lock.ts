/**
 * Client hook wrapping the durable scoring-lock RPCs
 * (`acquire_match_scoring_lock` / `release_match_scoring_lock`).
 *
 * Semantics
 *   status = "pending"   → attempting first acquire
 *   status = "acquired"  → this tab owns the lock; scoring is safe
 *   status = "blocked"   → a *different user* is actively scoring (fresh heartbeat)
 *   status = "error"     → RPC failed (network etc.); scoring blocked defensively
 *
 * Design
 *   - Stable per-tab session id (survives re-renders and StrictMode double mounts).
 *   - Same-user acquire always succeeds server-side, so heartbeats never flip a
 *     live scorer to "blocked". Transient RPC failures are tolerated: they do
 *     not downgrade an already-acquired status.
 *   - One heartbeat interval, one visibility listener, one pagehide listener.
 *   - Release only on real unmount (matchId change / disabled toggle) and on
 *     pagehide/beforeunload.
 */
import { useEffect, useRef, useState } from "react";
import { acquireMatchScoringLock, releaseMatchScoringLock } from "@/lib/bulk-ops";

export type ScoringLockStatus = "pending" | "acquired" | "blocked" | "error";

const HEARTBEAT_MS = 30_000;

// Module-level session id so React StrictMode's double-mount and effect
// re-runs within the same tab reuse the same identity server-side.
let cachedSessionId: string | null = null;
function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  if (typeof window !== "undefined") {
    try {
      const KEY = "mc.scoring.sessionId";
      const existing = window.sessionStorage.getItem(KEY);
      if (existing) {
        cachedSessionId = existing;
        return existing;
      }
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      window.sessionStorage.setItem(KEY, id);
      cachedSessionId = id;
      return id;
    } catch {
      // sessionStorage disabled — fall through
    }
  }
  cachedSessionId = `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  return cachedSessionId;
}

export function useScoringLock(matchId: string | undefined | null, enabled = true) {
  const [status, setStatus] = useState<ScoringLockStatus>("pending");
  // Ref mirror so async callbacks see the latest state without re-subscribing.
  const statusRef = useRef<ScoringLockStatus>("pending");
  statusRef.current = status;
  const heldRef = useRef(false);

  useEffect(() => {
    if (!matchId || !enabled) {
      setStatus("pending");
      return;
    }
    let cancelled = false;
    const sessionId = getSessionId();

    const setStatusSafe = (next: ScoringLockStatus) => {
      if (cancelled) return;
      // Do not downgrade an already-acquired lock on a transient RPC failure
      // or a mid-flight race — only real "blocked" from the server can move
      // us out of "acquired", and same-user acquires never return false.
      if (statusRef.current === "acquired" && (next === "error" || next === "pending")) return;
      setStatus(next);
    };

    const tick = async () => {
      try {
        const ok = await acquireMatchScoringLock(matchId, sessionId);
        if (cancelled) return;
        if (ok) {
          heldRef.current = true;
          setStatusSafe("acquired");
        } else {
          // Only reachable when a *different* user is actively scoring.
          setStatusSafe("blocked");
        }
      } catch (e) {
        console.warn("[scoring-lock] acquire failed", e);
        setStatusSafe("error");
      }
    };

    void tick();
    const heartbeat = window.setInterval(() => void tick(), HEARTBEAT_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const releaseNow = () => {
      if (!heldRef.current) return;
      // keepalive not used: pg unlock via same-user reacquire policy is
      // idempotent, and the 90s stale-heartbeat rule frees the lock for
      // another user without us needing to guarantee this call lands.
      void releaseMatchScoringLock(matchId, sessionId).catch(() => {});
    };
    window.addEventListener("pagehide", releaseNow);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", releaseNow);
      if (heldRef.current) {
        heldRef.current = false;
        void releaseMatchScoringLock(matchId, sessionId).catch(() => {});
      }
    };
  }, [matchId, enabled]);

  return status;
}
