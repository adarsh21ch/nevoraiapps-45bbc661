import { useSyncExternalStore } from "react";
import { generateDemoData, type DemoData } from "./generate";

const FLAG_KEY = (tenantId: string) => `mc:demo:${tenantId}`;
const DATA_KEY = (tenantId: string) => `mc:demo:data:${tenantId}`;
const VERSION = 4;

const listeners = new Set<() => void>();
const dataCache = new Map<string, DemoData>();
const pendingWrites = new Map<string, number>();
let revision = 0;

function emit() {
  revision += 1;
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
    /* storage full / unavailable */
  }
}

function scheduleWriteData(tenantId: string, data: DemoData) {
  if (typeof window === "undefined") return;
  const pending = pendingWrites.get(tenantId);
  if (pending) window.clearTimeout(pending);
  const handle = window.setTimeout(() => {
    pendingWrites.delete(tenantId);
    writeData(tenantId, dataCache.get(tenantId) ?? data);
  }, 0);
  pendingWrites.set(tenantId, handle);
}

function ensureData(tenantId: string): DemoData {
  const cached = dataCache.get(tenantId);
  if (cached) return cached;
  let d = readData(tenantId);
  if (!d) {
    d = generateDemoData(tenantId);
    d.__v = VERSION;
    writeData(tenantId, d);
  }
  dataCache.set(tenantId, d);
  return d;
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

/** Reset the entire demo academy back to freshly seeded state. */
export function resetDemoData(tenantId: string) {
  try {
    window.localStorage.removeItem(DATA_KEY(tenantId));
  } catch {
    /* noop */
  }
  const pending = pendingWrites.get(tenantId);
  if (pending) window.clearTimeout(pending);
  pendingWrites.delete(tenantId);
  dataCache.delete(tenantId);
  // Immediately regenerate so subsequent reads are consistent
  ensureData(tenantId);
  emit();
}

/**
 * Mutate the demo dataset for a tenant. Produces a shallow-cloned snapshot,
 * runs the mutator, persists and emits so every subscriber re-renders.
 */
export function updateDemoData(tenantId: string, mutator: (draft: DemoData) => void) {
  const cur = ensureData(tenantId);
  const next: DemoData = {
    ...cur,
    players: cur.players.slice(),
    teams: cur.teams.slice(),
    tournaments: cur.tournaments.slice(),
    matches: cur.matches.slice(),
    innings: cur.innings.slice(),
    ballEvents: cur.ballEvents.slice(),
    records: cur.records.slice(),
    recognitions: cur.recognitions.slice(),
    hallOfFame: cur.hallOfFame.slice(),
    perfRows: cur.perfRows.slice(),
    aiReports: cur.aiReports.slice(),
  };
  mutator(next);
  dataCache.set(tenantId, next);
  emit();
  scheduleWriteData(tenantId, next);
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
  return useSyncExternalStore(
    subscribe,
    () => (readFlag(tenantId) ? ensureData(tenantId) : null),
    () => null,
  );
}

export function useDemoRevision(): number {
  return useSyncExternalStore(
    subscribe,
    () => revision,
    () => 0,
  );
}

export function isDemoId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("demo-");
}

/** Look up a demo dataset for any tenant that contains the given match id. */
export function findDemoDatasetByMatchId(
  matchId: string,
): { tenantId: string; data: DemoData } | null {
  if (typeof window === "undefined") return null;
  // Try cache first
  for (const [tenantId, data] of dataCache) {
    if (data.matches?.some((m) => m.id === matchId) || data.liveMatch?.id === matchId)
      return { tenantId, data };
  }
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith("mc:demo:data:")) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as DemoData & { __v?: number };
      if (parsed?.__v !== VERSION) continue;
      if (parsed.matches?.some((m) => m.id === matchId) || parsed.liveMatch?.id === matchId) {
        const tenantId = key.slice("mc:demo:data:".length);
        dataCache.set(tenantId, parsed);
        return { tenantId, data: parsed };
      }
    }
  } catch {
    /* ignore */
  }
  if (matchId.startsWith("demo-")) {
    const tenantId = "demo-auto";
    const data = generateDemoData(tenantId);
    data.__v = VERSION;
    dataCache.set(tenantId, data);
    try {
      window.localStorage.setItem(FLAG_KEY(tenantId), "on");
      writeData(tenantId, data);
    } catch {
      /* ignore */
    }
    if (data.matches?.some((m) => m.id === matchId) || data.liveMatch?.id === matchId) {
      return { tenantId, data };
    }
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
