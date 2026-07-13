import { useSyncExternalStore, useMemo } from "react";
import { generateDemoData, type DemoData } from "./generate";

const FLAG_KEY = (tenantId: string) => `mc:demo:${tenantId}`;
const DATA_KEY = (tenantId: string) => `mc:demo:data:${tenantId}`;
const VERSION = 2;

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

function readFlag(tenantId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FLAG_KEY(tenantId)) === "on";
  } catch {
    return false;
  }
}

function readData(tenantId: string): DemoData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DATA_KEY(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.__v !== VERSION) return null;
    return parsed as DemoData;
  } catch {
    return null;
  }
}

function writeData(tenantId: string, data: DemoData) {
  try {
    window.localStorage.setItem(DATA_KEY(tenantId), JSON.stringify(data));
  } catch {
    // storage full / unavailable – demo just won't persist
  }
}

export function setDemoMode(tenantId: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(FLAG_KEY(tenantId), "on");
    else window.localStorage.removeItem(FLAG_KEY(tenantId));
  } catch {
    /* noop */
  }
  emit();
}

export function resetDemoData(tenantId: string) {
  try {
    window.localStorage.removeItem(DATA_KEY(tenantId));
  } catch {
    /* noop */
  }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = () => l();
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function useDemoMode(tenantId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readFlag(tenantId),
    () => false,
  );
}

export function useDemoData(tenantId: string): DemoData | null {
  const on = useDemoMode(tenantId);
  return useMemo(() => {
    if (!on) return null;
    let d = readData(tenantId);
    if (!d) {
      d = generateDemoData(tenantId);
      d.__v = VERSION;
      writeData(tenantId, d);
    }
    return d;
  }, [on, tenantId]);
}

export function isDemoId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("demo-");
}

/**
 * Look up a demo dataset for any tenant that contains the given match id.
 * Used by routes (e.g. /scorer/$matchId) that live outside the DashboardProvider
 * and don't know the tenant id up-front. If no dataset is found but a demo
 * flag is on for some tenant, the caller can regenerate via useDemoData.
 */
export function findDemoDatasetByMatchId(matchId: string): { tenantId: string; data: DemoData } | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("mc:demo:data:")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as DemoData & { __v?: number };
      if (parsed?.__v !== VERSION) continue;
      if (parsed.matches?.some((m) => m.id === matchId)) {
        return { tenantId: key.slice("mc:demo:data:".length), data: parsed };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Find any tenant that currently has demo mode enabled. */
export function findAnyDemoTenant(): string | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("mc:demo:") || key.startsWith("mc:demo:data:")) continue;
      if (window.localStorage.getItem(key) === "on") {
        return key.slice("mc:demo:".length);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type DemoEntity =
  | { kind: "player"; player: DemoData["players"][number] }
  | { kind: "team"; team: DemoData["teams"][number] }
  | { kind: "tournament"; tournament: DemoData["tournaments"][number] }
  | { kind: "match"; match: DemoData["matches"][number] };

export function useDemoEntity(tenantId: string, id: string | undefined | null): DemoEntity | null {
  const demo = useDemoData(tenantId);
  if (!demo || !id || !isDemoId(id)) return null;
  const match = demo.matches.find((m) => m.id === id);
  if (match) return { kind: "match", match };
  const player = demo.players.find((p) => p.id === id);
  if (player) return { kind: "player", player };
  const team = demo.teams.find((t) => t.id === id);
  if (team) return { kind: "team", team };
  const tournament = demo.tournaments.find((t) => t.id === id);
  if (tournament) return { kind: "tournament", tournament };
  return null;
}
