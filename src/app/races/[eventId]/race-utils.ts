// Group generation and kart assignment utilities for race day workflow

// ============================================================
// Types
// ============================================================

export interface GroupParticipant {
  driverId: string;
  kartNumber: number | null;
}

export interface GeneratedGroup {
  groupName: string;
  participants: GroupParticipant[];
}

export interface RankedDriver {
  driverId: string;
  bestLap: number | null; // milliseconds
  position: number | null;
  totalTime: string | null;
}

// ============================================================
// Time parsing
// ============================================================

/** Parse "MM:SS.mmm" or "SS.mmm" to milliseconds. Returns null if invalid. */
export function parseLapTime(time: string | null): number | null {
  if (!time) return null;
  const clean = time.trim();

  // MM:SS.mmm
  const full = clean.match(/^(\d+):(\d{2})\.(\d{3})$/);
  if (full) {
    return parseInt(full[1]) * 60000 + parseInt(full[2]) * 1000 + parseInt(full[3]);
  }

  // SS.mmm
  const short = clean.match(/^(\d+)\.(\d{3})$/);
  if (short) {
    return parseInt(short[1]) * 1000 + parseInt(short[2]);
  }

  return null;
}

export function millisToTimeStr(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
  return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

// ============================================================
// Group count recommendation
// ============================================================

/**
 * Recommend optimal group count given participant count and max karts.
 * Rules: no group smaller than 3 drivers, groups as equal as possible.
 */
export function recommendGroupCount(participantCount: number, maxKarts: number): number {
  if (participantCount <= 0 || maxKarts <= 0) return 0;
  if (participantCount <= maxKarts) return 1;

  const groupCount = Math.ceil(participantCount / maxKarts);

  // Check that smallest group is at least 3
  const minGroupSize = Math.floor(participantCount / groupCount);
  if (minGroupSize < 3 && groupCount > 1) {
    return groupCount - 1;
  }

  return groupCount;
}

/**
 * Get group sizes that are as equal as possible.
 * e.g. 17 drivers in 2 groups → [9, 8]
 */
export function getGroupSizes(participantCount: number, groupCount: number): number[] {
  if (groupCount <= 0) return [];
  const base = Math.floor(participantCount / groupCount);
  const remainder = participantCount % groupCount;
  return Array.from({ length: groupCount }, (_, i) =>
    i < remainder ? base + 1 : base
  );
}

// ============================================================
// Shuffle
// ============================================================

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================
// Kart assignment
// ============================================================

/**
 * Assign kart numbers to drivers, minimizing repeats from previous sessions.
 * @param driverIds - drivers to assign karts to
 * @param availableKarts - kart numbers available at this venue
 * @param previousKarts - map of driverId → set of kart numbers already used
 */
export function assignKarts(
  driverIds: string[],
  availableKarts: number[],
  previousKarts: Map<string, Set<number>> = new Map()
): Map<string, number> {
  const result = new Map<string, number>();
  const usedInThisGroup = new Set<number>();

  // Shuffle karts to add randomness
  const shuffledKarts = shuffleArray(availableKarts);

  for (const driverId of driverIds) {
    const prev = previousKarts.get(driverId) ?? new Set();

    // Try to find a kart not used by this driver before AND not used in this group yet
    let assigned = shuffledKarts.find((k) => !prev.has(k) && !usedInThisGroup.has(k));

    // Fallback: any kart not used in this group
    if (assigned === undefined) {
      assigned = shuffledKarts.find((k) => !usedInThisGroup.has(k));
    }

    // Last resort: just use the first available (shouldn't happen with correct kart count)
    if (assigned === undefined) {
      assigned = shuffledKarts[0];
    }

    result.set(driverId, assigned);
    usedInThisGroup.add(assigned);
  }

  return result;
}

// ============================================================
// Generate qualification groups (random split)
// ============================================================

export function generateQualiGroups(
  driverIds: string[],
  groupCount: number,
  availableKarts: number[],
  previousKarts: Map<string, Set<number>> = new Map()
): GeneratedGroup[] {
  const shuffled = shuffleArray(driverIds);
  const sizes = getGroupSizes(shuffled.length, groupCount);
  const groupNames = 'ABCDEFGHIJKLMNOP'.split('');

  const groups: GeneratedGroup[] = [];
  let offset = 0;

  for (let i = 0; i < groupCount; i++) {
    const groupDrivers = shuffled.slice(offset, offset + sizes[i]);
    const kartMap = assignKarts(groupDrivers, availableKarts, previousKarts);

    groups.push({
      groupName: groupNames[i],
      participants: groupDrivers.map((dId) => ({
        driverId: dId,
        kartNumber: kartMap.get(dId) ?? null,
      })),
    });

    offset += sizes[i];
  }

  return groups;
}

// ============================================================
// Generate heat groups from qualification ranking
// ============================================================

/**
 * Generate heats by distributing drivers based on qualification ranking.
 * Best drivers are spread across groups (snake draft pattern).
 */
export function generateHeatGroups(
  rankedDrivers: RankedDriver[],
  groupCount: number,
  availableKarts: number[],
  previousKarts: Map<string, Set<number>> = new Map()
): GeneratedGroup[] {
  const groupNames = 'ABCDEFGHIJKLMNOP'.split('');
  const groups: string[][] = Array.from({ length: groupCount }, () => []);

  // Snake draft: 0,1,2,...,n-1, n-1,...,2,1,0, 0,1,2,...
  let groupIdx = 0;
  let direction = 1;

  for (const driver of rankedDrivers) {
    groups[groupIdx].push(driver.driverId);

    groupIdx += direction;
    if (groupIdx >= groupCount) {
      groupIdx = groupCount - 1;
      direction = -1;
    } else if (groupIdx < 0) {
      groupIdx = 0;
      direction = 1;
    }
  }

  return groups.map((driverIds, i) => {
    const kartMap = assignKarts(driverIds, availableKarts, previousKarts);
    return {
      groupName: groupNames[i],
      participants: driverIds.map((dId) => ({
        driverId: dId,
        kartNumber: kartMap.get(dId) ?? null,
      })),
    };
  });
}

// ============================================================
// Generate final groups from heat results
// ============================================================

/**
 * Generate finals by ranking all heat participants by position (lower is better).
 * Best performers go to "Finaal A", next best to "Finaal B", etc.
 */
export function generateFinalGroups(
  rankedDrivers: RankedDriver[],
  groupCount: number,
  availableKarts: number[],
  previousKarts: Map<string, Set<number>> = new Map()
): GeneratedGroup[] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  const sizes = getGroupSizes(rankedDrivers.length, groupCount);

  let offset = 0;
  for (let i = 0; i < groupCount; i++) {
    const count = sizes[i];
    for (let j = 0; j < count && offset + j < rankedDrivers.length; j++) {
      groups[i].push(rankedDrivers[offset + j].driverId);
    }
    offset += count;
  }

  const groupNames = 'ABCDEFGHIJKLMNOP'.split('');
  return groups.map((driverIds, i) => {
    const kartMap = assignKarts(driverIds, availableKarts, previousKarts);
    return {
      groupName: groupNames[i],
      participants: driverIds.map((dId) => ({
        driverId: dId,
        kartNumber: kartMap.get(dId) ?? null,
      })),
    };
  });
}

// ============================================================
// Build previous karts map from existing sessions
// ============================================================

export function buildPreviousKartsMap(
  sessions: { participants: { driver_id: string; kart_number: number | null }[] }[]
): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const session of sessions) {
    for (const p of session.participants) {
      if (p.kart_number != null) {
        if (!map.has(p.driver_id)) map.set(p.driver_id, new Set());
        map.get(p.driver_id)!.add(p.kart_number);
      }
    }
  }
  return map;
}

// ============================================================
// Rank drivers from session results
// ============================================================

/**
 * Rank drivers across multiple sessions of the same type.
 * For qualification: best fastest_lap from Q1+Q2.
 * For heats/finals: by position, with fastest_lap tiebreaker.
 */
export function rankDriversByBestLap(
  sessions: { results: { driver_id: string; fastest_lap: string | null }[] }[]
): RankedDriver[] {
  // Gather best lap per driver across all sessions
  const bestLaps = new Map<string, number>();

  for (const session of sessions) {
    for (const r of session.results) {
      const ms = parseLapTime(r.fastest_lap);
      if (ms !== null) {
        const current = bestLaps.get(r.driver_id);
        if (current === undefined || ms < current) {
          bestLaps.set(r.driver_id, ms);
        }
      }
    }
  }

  // Sort: fastest lap first (null laps at the end)
  const ranked: { driverId: string; bestLap: number | null }[] = Array.from(bestLaps.entries())
    .map(([driverId, ms]) => ({ driverId, bestLap: ms as number | null }))
    .sort((a, b) => (a.bestLap ?? Infinity) - (b.bestLap ?? Infinity));

  // Add drivers with no lap times
  const allDriverIds = new Set<string>();
  for (const session of sessions) {
    for (const r of session.results) {
      allDriverIds.add(r.driver_id);
    }
  }
  for (const driverId of allDriverIds) {
    if (!bestLaps.has(driverId)) {
      ranked.push({ driverId, bestLap: null });
    }
  }

  return ranked.map((r, i) => ({
    driverId: r.driverId,
    bestLap: r.bestLap ?? null,
    position: i + 1,
    totalTime: null as string | null,
  }));
}

export function rankDriversByPosition(
  sessions: { results: { driver_id: string; position: number | null; fastest_lap: string | null }[] }[]
): RankedDriver[] {
  // Gather all results, ranked by position within their group, then by fastest lap
  const driverResults: { driverId: string; position: number; bestLap: number | null }[] = [];

  for (const session of sessions) {
    for (const r of session.results) {
      driverResults.push({
        driverId: r.driver_id,
        position: r.position ?? 999,
        bestLap: parseLapTime(r.fastest_lap),
      });
    }
  }

  // Sort by position, then by fastest lap for tiebreaker
  driverResults.sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return (a.bestLap ?? Infinity) - (b.bestLap ?? Infinity);
  });

  return driverResults.map((r, i) => ({
    driverId: r.driverId,
    bestLap: r.bestLap,
    position: i + 1,
    totalTime: null,
  }));
}
