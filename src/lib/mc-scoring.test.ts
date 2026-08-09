
import { describe, it, expect } from 'vitest';
import { ballChipLabel, deliveryTotalRuns } from './mc-commentary';
import { formatBallNotation } from './mc-ball-events-core';
import type { MCBallEvent } from './mc-ball-events';

describe('Scoring Labels (Task A, B, C)', () => {
  const baseBall: Partial<MCBallEvent> = {
    runs_off_bat: 0,
    extra_runs: 0,
    extra_type: null,
    dismissal_type: null
  };

  it('Verification 1: Wide, no extra runs -> total 1 -> WD', () => {
    const e = { ...baseBall, extra_type: 'wide', extra_runs: 1 } as MCBallEvent;
    expect(deliveryTotalRuns(e)).toBe(1);
    expect(ballChipLabel(e)).toBe('WD');
  });

  it('Verification 2: Wide + 1 run -> total 2 -> WD 2', () => {
    const e = { ...baseBall, extra_type: 'wide', extra_runs: 2 } as MCBallEvent;
    expect(deliveryTotalRuns(e)).toBe(2);
    expect(ballChipLabel(e)).toBe('WD 2');
  });

  it('Verification 3: Wide + 4 byes -> total 5 -> WD 5', () => {
    const e = { ...baseBall, extra_type: 'wide', extra_runs: 5 } as MCBallEvent;
    expect(deliveryTotalRuns(e)).toBe(5);
    expect(ballChipLabel(e)).toBe('WD 5');
  });

  it('Verification 4: No-ball only -> total 1 -> NB', () => {
    const e = { ...baseBall, extra_type: 'no_ball', extra_runs: 0, runs_off_bat: 0 } as MCBallEvent;
    expect(deliveryTotalRuns(e)).toBe(1);
    expect(ballChipLabel(e)).toBe('NB');
  });

  it('Verification 5: No-ball + batter hits 4 -> total 5 -> NB 5', () => {
    const e = { ...baseBall, extra_type: 'no_ball', extra_runs: 0, runs_off_bat: 4 } as MCBallEvent;
    expect(deliveryTotalRuns(e)).toBe(5);
    expect(ballChipLabel(e)).toBe('NB 5');
  });

  it('Verification 6: No-ball + batter hits 6 -> total 7 -> NB 7', () => {
    const e = { ...baseBall, extra_type: 'no_ball', extra_runs: 0, runs_off_bat: 6 } as MCBallEvent;
    expect(deliveryTotalRuns(e)).toBe(7);
    expect(ballChipLabel(e)).toBe('NB 7');
  });

  it('Verification 7: No-ball + 2 byes -> total 3 -> NB 3', () => {
    const e = { ...baseBall, extra_type: 'no_ball', extra_runs: 2, runs_off_bat: 0 } as MCBallEvent;
    expect(deliveryTotalRuns(e)).toBe(3);
    expect(ballChipLabel(e)).toBe('NB 3');
  });

  it('Task C: formatBallNotation should preserve total runs', () => {
    expect(formatBallNotation('WD 2')).toBe('WD 2');
    expect(formatBallNotation('NB 5')).toBe('NB 5');
    // Ensure it doesn't double-transform if a space is missing (which callers might provide)
    expect(formatBallNotation('WD2')).toBe('WD2');
  });
});
