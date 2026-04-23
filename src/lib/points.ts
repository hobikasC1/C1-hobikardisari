/**
 * Pure points calculation engine — no DB, no Next.js imports.
 * Implements the Corner 1 Hobikardisari scoring rules.
 */

import type { DriverClass, SessionType } from '@/types/database';

// ============================================================
// Points tables
// ============================================================

/** Position → points for heat sessions (per group). */
export const HEAT_POINTS: Record<number, number> = {
  1: 13,
  2: 11,
  3: 10,
  4: 9,
  5: 8,
  6: 7,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

/** Class rank (0-indexed) → points for final sessions. */
export const FINAL_POINTS: number[] = [
  35, 31, 28, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15,
  14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
];

// ============================================================
// Input types (subset of full DB types)
// ============================================================

export interface PointsInputEntry {
  driver_id: string;
  class: DriverClass;
  is_excluded_from_points: boolean;
}

export interface PointsInputResult {
  driver_id: string;
  position: number | null;
  fastest_lap: string | null;
}

export interface PointsInputSession {
  id: string;
  type: SessionType;
  group_name: string;
  results: PointsInputResult[];
}

export interface PointsInput {
  entries: PointsInputEntry[];
  sessions: PointsInputSession[];
}

// ============================================================
// Output type
// ============================================================

export interface DriverEventPoints {
  driverId: string;
  heatPoints: number;
  finalPoints: number;
  fastestLapBonus: number;
  totalPoints: number;
}

// ============================================================
// Lap time parser (MM:SS.mmm or SS.mmm → milliseconds)
// ============================================================

function parseLapMs(time: string): number {
  if (!time) return 0;
  const trimmed = time.trim();
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx !== -1) {
    const minutes = parseInt(trimmed.slice(0, colonIdx), 10);
    const seconds = parseFloat(trimmed.slice(colonIdx + 1));
    return minutes * 60_000 + Math.round(seconds * 1000);
  }
  return Math.round(parseFloat(trimmed) * 1000);
}

// ============================================================
// Main calculation
// ============================================================

/**
 * Calculate each driver's points breakdown for a single event.
 *
 * Rules:
 * - Heat points: position-based per group (HEAT_POINTS table)
 * - Final points: class-rank-based across all final groups (FINAL_POINTS table)
 * - Fastest lap bonus (finals only):
 *     overall fastest across all groups → 3 pts
 *     per-group fastest (not the overall winner) → 1 pt
 * - Excluded drivers (is_excluded_from_points) earn 0 pts
 */
export function calculateEventPoints(data: PointsInput): Map<string, DriverEventPoints> {
  const result = new Map<string, DriverEventPoints>();

  const init = (driverId: string): DriverEventPoints => {
    if (!result.has(driverId)) {
      result.set(driverId, {
        driverId,
        heatPoints: 0,
        finalPoints: 0,
        fastestLapBonus: 0,
        totalPoints: 0,
      });
    }
    return result.get(driverId)!;
  };

  // Build look-ups
  const excluded = new Set(
    data.entries.filter((e) => e.is_excluded_from_points).map((e) => e.driver_id)
  );
  const driverClass = new Map<string, DriverClass>(
    data.entries.map((e) => [e.driver_id, e.class])
  );

  // ---- Heat points ------------------------------------------------
  const heatSessions = data.sessions.filter((s) => s.type === 'heat');
  for (const session of heatSessions) {
    for (const r of session.results) {
      if (excluded.has(r.driver_id) || r.position == null) continue;
      const pts = HEAT_POINTS[r.position] ?? 0;
      init(r.driver_id).heatPoints += pts;
    }
  }

  // ---- Final points (per class) -----------------------------------
  const finalSessions = data.sessions.filter((s) => s.type === 'final');

  // Collect all final results, grouped by class
  type FlatResult = { driverId: string; position: number; sessionId: string; fastestLap: string | null };
  const byClass = new Map<DriverClass, FlatResult[]>();

  for (const session of finalSessions) {
    for (const r of session.results) {
      if (r.position == null) continue;
      const cls = driverClass.get(r.driver_id);
      if (!cls) continue;
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls)!.push({
        driverId: r.driver_id,
        position: r.position,
        sessionId: session.id,
        fastestLap: r.fastest_lap,
      });
    }
  }

  for (const [, classResults] of byClass) {
    // Sort by finishing position (all final groups combined, within class)
    classResults.sort((a, b) => a.position - b.position);
    for (let i = 0; i < classResults.length; i++) {
      const r = classResults[i];
      if (excluded.has(r.driverId)) continue;
      const pts = FINAL_POINTS[i] ?? 0;
      init(r.driverId).finalPoints += pts;
    }
  }

  // ---- Fastest lap bonus (final sessions only) --------------------
  type LapEntry = { driverId: string; lapMs: number; sessionId: string };
  const lapTimes: LapEntry[] = [];

  for (const session of finalSessions) {
    for (const r of session.results) {
      if (!r.fastest_lap) continue;
      const ms = parseLapMs(r.fastest_lap);
      if (ms > 0) {
        lapTimes.push({ driverId: r.driver_id, lapMs: ms, sessionId: session.id });
      }
    }
  }

  if (lapTimes.length > 0) {
    // Overall fastest → 3 pts
    const overall = lapTimes.reduce((best, cur) => (cur.lapMs < best.lapMs ? cur : best));
    if (!excluded.has(overall.driverId)) {
      init(overall.driverId).fastestLapBonus += 3;
    }

    // Per-group fastest → 1 pt (skip if already awarded overall 3 pts)
    const sessionIds = [...new Set(lapTimes.map((l) => l.sessionId))];
    for (const sessionId of sessionIds) {
      const groupLaps = lapTimes.filter((l) => l.sessionId === sessionId);
      if (groupLaps.length === 0) continue;
      const groupFastest = groupLaps.reduce((best, cur) => (cur.lapMs < best.lapMs ? cur : best));
      if (excluded.has(groupFastest.driverId)) continue;
      if (groupFastest.driverId === overall.driverId) continue; // already gets 3
      init(groupFastest.driverId).fastestLapBonus += 1;
    }
  }

  // ---- Totals -----------------------------------------------------
  for (const d of result.values()) {
    d.totalPoints = d.heatPoints + d.finalPoints + d.fastestLapBonus;
  }

  return result;
}
