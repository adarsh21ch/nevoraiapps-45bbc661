import { describe, it, expect } from "vitest";
import type { MCBallEvent } from "./mc-ball-events";
import {
  completedLegalBallsFromEvents,
  formatLiveOver,
  formatOversCompact,
} from "./mc-statistics-engine";

/* ================================================================
 * formatLiveOver — the SINGLE source of truth for the "current over"
 * label rendered by the scorer, live viewer, public viewer and every
 * over-strip / header. The formatter must always display the ball
 * that has JUST been recorded — it may never pre-increment to the
 * next legal delivery.
 * ============================================================== */

describe("formatLiveOver — never pre-increments to the next ball", () => {
  it("matches the required completed-legal-ball sequence exactly", () => {
    expect(formatLiveOver(0)).toBe("Over 1");
    expect(formatLiveOver(1)).toBe("1.1");
    expect(formatLiveOver(2)).toBe("1.2");
    expect(formatLiveOver(3)).toBe("1.3");
    expect(formatLiveOver(4)).toBe("1.4");
    expect(formatLiveOver(5)).toBe("1.5");
    expect(formatLiveOver(6)).toBe("1.6");
    expect(formatLiveOver(6, { preOver: true })).toBe("Over 2");
    expect(formatLiveOver(7)).toBe("2.1");
    expect(formatLiveOver(8)).toBe("2.2");
  });

  it("renders 'Over 1' before any ball has been bowled", () => {
    expect(formatLiveOver(0)).toBe("Over 1");
    expect(formatLiveOver(0, { preOver: true })).toBe("Over 1");
  });

  it("labels the first over as 1.M using 1-indexed current-over naming", () => {
    expect(formatLiveOver(1)).toBe("1.1");
    expect(formatLiveOver(2)).toBe("1.2");
    expect(formatLiveOver(3)).toBe("1.3");
    expect(formatLiveOver(4)).toBe("1.4");
    expect(formatLiveOver(5)).toBe("1.5");
    expect(formatLiveOver(6)).toBe("1.6");
  });

  it("labels the second over 2.1 immediately after the first legal ball", () => {
    expect(formatLiveOver(7)).toBe("2.1");
    expect(formatLiveOver(8)).toBe("2.2");
  });

  // Exact transitions asked for in the bug report.
  it("mid-over (15.5) → 15.5", () => {
    expect(formatLiveOver(15 * 6 - 1)).toBe("15.5");
  });

  it("last ball of the 15th over (15.6) → 15.6 — NEVER 16.1", () => {
    expect(formatLiveOver(15 * 6)).toBe("15.6");
  });

  it("pre-over state after 15.6 → 'Over 16'", () => {
    expect(formatLiveOver(15 * 6, { preOver: true })).toBe("Over 16");
  });

  it("first legal delivery of the 16th over → 16.1", () => {
    expect(formatLiveOver(15 * 6 + 1)).toBe("16.1");
  });

  it("second legal delivery of the 16th over → 16.2", () => {
    expect(formatLiveOver(15 * 6 + 2)).toBe("16.2");
  });

  it("preOver flag is a no-op mid-over (ballInOver !== 6)", () => {
    // Mid-over the flag must be ignored so a stale prop cannot leak a
    // "next over" label onto an in-progress delivery.
    expect(formatLiveOver(15 * 6 + 1, { preOver: true })).toBe("16.1");
    expect(formatLiveOver(15 * 6 + 3, { preOver: true })).toBe("16.3");
  });

  it("full 20-over T20 sequence rolls cleanly without ever showing N.0", () => {
    const labels: string[] = [];
    for (let l = 0; l <= 120; l += 1) {
      labels.push(formatLiveOver(l));
    }
    // No N.0 label is ever exposed to the scorer.
    for (const s of labels) expect(s).not.toMatch(/\.0$/);
    // Spot checks across the innings.
    expect(labels[0]).toBe("Over 1");
    expect(labels[1]).toBe("1.1");
    expect(labels[6]).toBe("1.6");
    expect(labels[7]).toBe("2.1");
    expect(labels[60]).toBe("10.6");
    expect(labels[61]).toBe("11.1");
    expect(labels[120]).toBe("20.6");
  });

  it("guards against negative / bad input", () => {
    expect(formatLiveOver(-1)).toBe("Over 1");
    expect(formatLiveOver(-100)).toBe("Over 1");
    expect(formatLiveOver(1.9)).toBe("1.1");
  });
});

describe("formatOversCompact — stat-table figures", () => {
  it("collapses full overs to the integer count", () => {
    expect(formatOversCompact(0)).toBe("0");
    expect(formatOversCompact(6)).toBe("1");
    expect(formatOversCompact(24)).toBe("4");
    expect(formatOversCompact(120)).toBe("20");
  });

  it("shows partial overs as N.M", () => {
    expect(formatOversCompact(1)).toBe("0.1");
    expect(formatOversCompact(5)).toBe("0.5");
    expect(formatOversCompact(25)).toBe("4.1");
    expect(formatOversCompact(91)).toBe("15.1");
  });
});

describe("completedLegalBallsFromEvents — live label input", () => {
  const legal = (seq: number): MCBallEvent =>
    ({
      id: `legal-${seq}`,
      sequence_number: seq,
      over_number: Math.floor((seq - 1) / 6),
      ball_number: ((seq - 1) % 6) + 1,
      extra_type: null,
    }) as MCBallEvent;

  const illegal = (seq: number, kind: "wide" | "no_ball"): MCBallEvent =>
    ({
      id: `${kind}-${seq}`,
      sequence_number: seq,
      over_number: 0,
      ball_number: 1,
      extra_type: kind,
    }) as MCBallEvent;

  it("counts legal deliveries directly — one ball per legal event", () => {
    const events: MCBallEvent[] = [];
    for (let i = 1; i <= 102; i += 1) events.push(legal(i));
    expect(completedLegalBallsFromEvents(events)).toBe(102);
    expect(formatLiveOver(completedLegalBallsFromEvents(events))).toBe("17.6");

    events.push(legal(103));
    expect(formatLiveOver(completedLegalBallsFromEvents(events))).toBe("18.1");

    events.push(legal(104));
    expect(formatLiveOver(completedLegalBallsFromEvents(events))).toBe("18.2");

    events.push(legal(105));
    expect(formatLiveOver(completedLegalBallsFromEvents(events))).toBe("18.3");
  });

  it("does not advance the display for wides or no-balls", () => {
    const events: MCBallEvent[] = [];
    for (let i = 1; i <= 102; i += 1) events.push(legal(i));
    events.push(illegal(103, "wide"));
    events.push(illegal(104, "no_ball"));
    expect(completedLegalBallsFromEvents(events)).toBe(102);
    expect(formatLiveOver(completedLegalBallsFromEvents(events))).toBe("17.6");
  });

  it("is independent of stored over_number indexing (0- vs 1-based)", () => {
    // Even if legacy demo data stored over_number 1-indexed and live data
    // stored 0-indexed, the count of legal events is the same.
    const events: MCBallEvent[] = [
      { id: "a", sequence_number: 1, over_number: 999, ball_number: 999, extra_type: null } as MCBallEvent,
      { id: "b", sequence_number: 2, over_number: 0, ball_number: 1, extra_type: null } as MCBallEvent,
    ];
    expect(completedLegalBallsFromEvents(events)).toBe(2);
    expect(formatLiveOver(completedLegalBallsFromEvents(events))).toBe("1.2");
  });
});
