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
