'use server';

import { createClient } from '@/lib/supabase/server';
import type { DriverClass, Event, Team } from '@/types/database';
import { calculateEventPoints, type PointsInput } from '@/lib/points';

// ============================================================
// Output types
// ============================================================

export interface DriverStandingRow {
  driverId: string;
  driverName: string;
  driverClass: DriverClass;
  /** Points earned per event: eventId → total pts for that event */
  pointsByEvent: Record<string, number>;
  totalPoints: number;
}

export interface TeamStandingRow {
  teamId: string;
  teamName: string;
  pointsByEvent: Record<string, number>;
  totalPoints: number;
}

export interface SeasonStandingsData {
  /** All season events in order (for column headers) */
  events: Event[];
  juniorStandings: DriverStandingRow[];
  standardStandings: DriverStandingRow[];
  heavyStandings: DriverStandingRow[];
  teamStandings: TeamStandingRow[];
}

// ============================================================
// Main action
// ============================================================

export async function getSeasonStandings(): Promise<SeasonStandingsData> {
  const supabase = await createClient();

  // 1. Active season
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .select('id')
    .eq('is_active', true)
    .single();

  if (seasonErr || !season) throw new Error('Aktiivne hooaeg puudub');

  // 2. All events for the season (all statuses — shown as columns)
  const { data: events, error: eventsErr } = await supabase
    .from('events')
    .select('*')
    .eq('season_id', season.id)
    .order('sort_order');

  if (eventsErr) throw new Error(eventsErr.message);

  // 3. Only score completed / published events
  const scorableEventIds = new Set(
    (events ?? [])
      .filter((e) => e.status === 'completed' || e.status === 'published')
      .map((e) => e.id)
  );

  // 4. Accumulate per-driver data across all scorable events
  type DriverAgg = {
    driverName: string;
    driverClass: DriverClass | null;
    pointsByEvent: Record<string, number>;
  };
  const driverAgg = new Map<string, DriverAgg>();

  for (const event of events ?? []) {
    if (!scorableEventIds.has(event.id)) continue;

    // Fetch entries + sessions+results in parallel
    const [entriesRes, sessionsRes] = await Promise.all([
      supabase
        .from('event_entries')
        .select('driver_id, class, is_excluded_from_points, driver:drivers(first_name, last_name)')
        .eq('event_id', event.id),
      supabase
        .from('sessions')
        .select(
          'id, type, group_name, results:session_results(driver_id, position, fastest_lap)'
        )
        .eq('event_id', event.id)
        .order('sort_order'),
    ]);

    if (entriesRes.error || sessionsRes.error) continue;

    const entries = entriesRes.data as unknown as (PointsInput['entries'][number] & {
      driver: { first_name: string; last_name: string };
    })[];
    const sessions = sessionsRes.data as unknown as PointsInput['sessions'];

    // Register driver names / classes (first time we see them)
    for (const entry of entries) {
      if (!driverAgg.has(entry.driver_id)) {
        driverAgg.set(entry.driver_id, {
          driverName: `${entry.driver.first_name} ${entry.driver.last_name}`,
          driverClass: entry.class,
          pointsByEvent: {},
        });
      }
    }

    // Calculate points for this event
    const pts = calculateEventPoints({ entries, sessions });

    for (const [driverId, dp] of pts) {
      const agg = driverAgg.get(driverId);
      if (!agg || dp.totalPoints === 0) continue;
      agg.pointsByEvent[event.id] = dp.totalPoints;
    }
  }

  // 5. Build standings per class
  const buildClassStandings = (cls: DriverClass): DriverStandingRow[] => {
    const rows: DriverStandingRow[] = [];
    for (const [driverId, agg] of driverAgg) {
      if (agg.driverClass !== cls) continue;
      const total = Object.values(agg.pointsByEvent).reduce((a, b) => a + b, 0);
      rows.push({
        driverId,
        driverName: agg.driverName,
        driverClass: cls,
        pointsByEvent: agg.pointsByEvent,
        totalPoints: total,
      });
    }
    return rows.sort((a, b) => b.totalPoints - a.totalPoints);
  };

  // 6. Team standings — top-2 scorers per event among team members
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('season_id', season.id)
    .order('name');

  const teamStandings: TeamStandingRow[] = [];

  for (const team of (teams ?? []) as Team[]) {
    const memberIds = [team.driver1_id, team.driver2_id];
    if (team.substitute_id) memberIds.push(team.substitute_id);

    const pointsByEvent: Record<string, number> = {};

    for (const event of events ?? []) {
      if (!scorableEventIds.has(event.id)) continue;

      // Collect each member's points for this event
      const memberPts = memberIds.map((id) => driverAgg.get(id)?.pointsByEvent[event.id] ?? 0);

      // Sort descending, take top 2 (handles substitute replacing absent member)
      memberPts.sort((a, b) => b - a);
      const eventTotal = memberPts[0] + (memberPts[1] ?? 0);

      if (eventTotal > 0) pointsByEvent[event.id] = eventTotal;
    }

    const totalPoints = Object.values(pointsByEvent).reduce((a, b) => a + b, 0);
    teamStandings.push({ teamId: team.id, teamName: team.name, pointsByEvent, totalPoints });
  }

  teamStandings.sort((a, b) => b.totalPoints - a.totalPoints);

  return {
    events: events ?? [],
    juniorStandings: buildClassStandings('Junior'),
    standardStandings: buildClassStandings('Standard'),
    heavyStandings: buildClassStandings('Heavy'),
    teamStandings,
  };
}
