'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type {
  Event,
  EventEntry,
  EventEntryWithDriver,
  Driver,
  Session,
  SessionParticipant,
  SessionResult,
  SessionType,
  DriverClass,
} from '@/types/database';
import { assignKarts, buildPreviousKartsMap } from './race-utils';

// ============================================================
// Event + full data loader
// ============================================================

export interface EventFullData {
  event: Event;
  entries: EventEntryWithDriver[];
  sessions: (Session & {
    participants: (SessionParticipant & { driver: Driver })[];
    results: (SessionResult & { driver: Driver })[];
  })[];
}

export async function getEventFullData(eventId: string): Promise<EventFullData> {
  const supabase = await createClient();

  const [eventRes, entriesRes, sessionsRes] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase
      .from('event_entries')
      .select('*, driver:drivers(*)')
      .eq('event_id', eventId)
      .order('created_at'),
    supabase
      .from('sessions')
      .select('*, participants:session_participants(*, driver:drivers(*)), results:session_results(*, driver:drivers(*))')
      .eq('event_id', eventId)
      .order('sort_order'),
  ]);

  if (eventRes.error) throw new Error(eventRes.error.message);
  if (entriesRes.error) throw new Error(entriesRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);

  return {
    event: eventRes.data,
    entries: entriesRes.data as unknown as EventEntryWithDriver[],
    sessions: sessionsRes.data as unknown as EventFullData['sessions'],
  };
}

// ============================================================
// Kart settings
// ============================================================

export async function updateKartSettings(
  eventId: string,
  maxKarts: number,
  availableKartNumbers: number[]
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .update({ max_karts: maxKarts, available_kart_numbers: availableKartNumbers })
    .eq('id', eventId);
  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
}

// ============================================================
// Event entries (participants)
// ============================================================

export async function addParticipantsToEvent(
  eventId: string,
  drivers: { driver_id: string; class: DriverClass; team_id: string | null }[]
): Promise<void> {
  const supabase = await createClient();

  const rows = drivers.map((d) => ({
    event_id: eventId,
    driver_id: d.driver_id,
    class: d.class,
    team_id: d.team_id,
    is_excluded_from_points: false,
    points_adjustment: 0,
    points_adjustment_note: null,
  }));

  const { error } = await supabase.from('event_entries').upsert(rows, {
    onConflict: 'event_id,driver_id',
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
}

export async function removeParticipantFromEvent(
  eventId: string,
  entryId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('event_entries')
    .delete()
    .eq('id', entryId);

  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
}

export async function toggleExcludeFromPoints(
  eventId: string,
  entryId: string,
  exclude: boolean
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('event_entries')
    .update({ is_excluded_from_points: exclude })
    .eq('id', entryId);

  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
  revalidatePath('/standings');
}

export async function updatePointsAdjustment(
  eventId: string,
  entryId: string,
  pointsAdjustment: number,
  note: string | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('event_entries')
    .update({ points_adjustment: pointsAdjustment, points_adjustment_note: note })
    .eq('id', entryId);

  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
  revalidatePath('/standings');
}

// ============================================================
// Sessions (qualification groups, heats, finals)
// ============================================================

export async function createSessions(
  eventId: string,
  type: SessionType,
  groups: {
    groupName: string;
    participants: { driverId: string; kartNumber: number | null }[];
  }[]
): Promise<void> {
  const supabase = await createClient();

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];

    // Create session
    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .insert({
        event_id: eventId,
        type,
        group_name: g.groupName,
        sort_order: i + 1,
      })
      .select()
      .single();

    if (sessErr) throw new Error(sessErr.message);

    // Create participants
    if (g.participants.length > 0) {
      const rows = g.participants.map((p, idx) => ({
        session_id: session.id,
        driver_id: p.driverId,
        kart_number: p.kartNumber,
        grid_position: idx + 1,
      }));

      const { error: partErr } = await supabase
        .from('session_participants')
        .insert(rows);

      if (partErr) throw new Error(partErr.message);
    }
  }

  revalidatePath(`/races/${eventId}`);
}

export async function clearSessionsByType(
  eventId: string,
  type: SessionType
): Promise<void> {
  const supabase = await createClient();

  // Get session IDs for this type
  const { data: sessions, error: fetchErr } = await supabase
    .from('sessions')
    .select('id')
    .eq('event_id', eventId)
    .eq('type', type);

  if (fetchErr) throw new Error(fetchErr.message);

  if (sessions && sessions.length > 0) {
    const ids = sessions.map((s) => s.id);

    // Delete results & participants (cascade should handle, but be explicit)
    await supabase.from('session_results').delete().in('session_id', ids);
    await supabase.from('session_participants').delete().in('session_id', ids);
    await supabase.from('sessions').delete().in('id', ids);
  }

  revalidatePath(`/races/${eventId}`);
}

export async function reassignQuali2Karts(
  eventId: string,
  availableKarts: number[]
): Promise<void> {
  const supabase = await createClient();
  const uniqueKarts = Array.from(new Set(availableKarts));

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, type, participants:session_participants(id, driver_id, kart_number)')
    .eq('event_id', eventId)
    .order('sort_order');

  if (error) throw new Error(error.message);
  if (!sessions || sessions.length === 0) return;

  const nonQ2Sessions = sessions.filter((s) => s.type !== 'quali_2');
  const previousKarts = buildPreviousKartsMap(
    nonQ2Sessions.map((s) => ({ participants: s.participants }))
  );
  const q2Sessions = sessions.filter((s) => s.type === 'quali_2');

  for (const session of q2Sessions) {
    const driverIds = session.participants.map((p) => p.driver_id);
    const kartMap = assignKarts(driverIds, uniqueKarts, previousKarts);

    for (const p of session.participants) {
      const newKart = kartMap.get(p.driver_id) ?? null;
      const { error: updErr } = await supabase
        .from('session_participants')
        .update({ kart_number: newKart })
        .eq('id', p.id);
      if (updErr) throw new Error(updErr.message);
    }
  }

  revalidatePath(`/races/${eventId}`);
}

// ============================================================
// Session results
// ============================================================

export async function saveSessionResults(
  eventId: string,
  sessionId: string,
  results: {
    driverId: string;
    position: number | null;
    totalTime: string | null;
    fastestLap: string | null;
    penaltyNote: string | null;
  }[]
): Promise<void> {
  const supabase = await createClient();

  // Delete existing results for this session
  await supabase.from('session_results').delete().eq('session_id', sessionId);

  if (results.length > 0) {
    const rows = results.map((r) => ({
      session_id: sessionId,
      driver_id: r.driverId,
      position: r.position,
      total_time: r.totalTime,
      fastest_lap: r.fastestLap,
      points: 0, // calculated later
      fastest_lap_bonus: 0,
      penalty_note: r.penaltyNote,
    }));

    const { error } = await supabase.from('session_results').insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/races/${eventId}`);
}

export async function deleteSessionResult(
  eventId: string,
  resultId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('session_results')
    .delete()
    .eq('id', resultId);

  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
}

// ============================================================
// Manual group overrides
// ============================================================

export async function moveParticipantBetweenSessions(
  eventId: string,
  participantId: string,
  targetSessionId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('session_participants')
    .update({ session_id: targetSessionId })
    .eq('id', participantId);

  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
}

export async function updateParticipantKart(
  eventId: string,
  participantId: string,
  kartNumber: number | null
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('session_participants')
    .update({ kart_number: kartNumber })
    .eq('id', participantId);

  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
}

/**
 * A kart physically broke and was swapped out. Replace `oldKart` with `newKart`
 * everywhere it is still going to be used — i.e. in every session of this event
 * that has NOT been raced yet (no results saved). Sessions that already have
 * results are left untouched. The just-edited participant is excluded since it
 * was already updated.
 *
 * Returns the number of additional participants whose kart was swapped.
 */
export async function replaceKartInUnracedSessions(
  eventId: string,
  oldKart: number,
  newKart: number,
  excludeParticipantId: string
): Promise<number> {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, results:session_results(id), participants:session_participants(id, kart_number)')
    .eq('event_id', eventId);

  if (error) throw new Error(error.message);
  if (!sessions) return 0;

  const idsToUpdate: string[] = [];
  for (const s of sessions) {
    // Skip sessions that have already been raced.
    if ((s.results?.length ?? 0) > 0) continue;
    for (const p of s.participants) {
      if (p.kart_number === oldKart && p.id !== excludeParticipantId) {
        idsToUpdate.push(p.id);
      }
    }
  }

  if (idsToUpdate.length > 0) {
    const { error: updErr } = await supabase
      .from('session_participants')
      .update({ kart_number: newKart })
      .in('id', idsToUpdate);
    if (updErr) throw new Error(updErr.message);
  }

  revalidatePath(`/races/${eventId}`);
  return idsToUpdate.length;
}

// ============================================================
// Update event status
// ============================================================

export async function updateEventStatus(
  eventId: string,
  status: Event['status']
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', eventId);

  if (error) throw new Error(error.message);
  revalidatePath(`/races/${eventId}`);
  revalidatePath('/races');
}
