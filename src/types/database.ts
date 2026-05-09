// Auto-generated types matching supabase/schema.sql
// Update this file when the schema changes

export type DriverClass = 'Junior' | 'Standard' | 'Heavy';

export type SessionType = 'quali_1' | 'quali_2' | 'heat' | 'final';

export type EventStatus = 'draft' | 'in_progress' | 'completed' | 'published';

// ============================================================
// Database row types
// ============================================================

export interface Season {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
  created_at: string;
}

export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  weight: number | null;
  class: DriverClass | null;
  is_licensed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  season_id: string;
  driver1_id: string;
  driver2_id: string;
  substitute_id: string | null;
  substitute_used_on_event: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  season_id: string;
  name: string;
  venue: string | null;
  event_date: string | null;
  max_karts: number;
  available_kart_numbers: number[];
  status: EventStatus;
  sort_order: number;
  created_at: string;
}

export interface EventEntry {
  id: string;
  event_id: string;
  driver_id: string;
  class: DriverClass;
  team_id: string | null;
  is_excluded_from_points: boolean;
  points_adjustment: number;
  points_adjustment_note: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  event_id: string;
  type: SessionType;
  group_name: string;
  sort_order: number;
  created_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  driver_id: string;
  kart_number: number | null;
  grid_position: number | null;
}

export interface SessionResult {
  id: string;
  session_id: string;
  driver_id: string;
  position: number | null;
  total_time: string | null;
  fastest_lap: string | null;
  points: number;
  fastest_lap_bonus: number;
  penalty_note: string | null;
  created_at: string;
}

// ============================================================
// Insert types (omit auto-generated fields)
// ============================================================

export type DriverInsert = Omit<Driver, 'id' | 'created_at' | 'updated_at'>;
export type TeamInsert = Omit<Team, 'id' | 'created_at'>;
export type EventInsert = Omit<Event, 'id' | 'created_at'>;
export type EventEntryInsert = Omit<EventEntry, 'id' | 'created_at'>;
export type SessionInsert = Omit<Session, 'id' | 'created_at'>;
export type SessionParticipantInsert = Omit<SessionParticipant, 'id'>;
export type SessionResultInsert = Omit<SessionResult, 'id' | 'created_at'>;

// ============================================================
// Joined / view types for UI
// ============================================================

export interface DriverWithFullName extends Driver {
  full_name: string; // computed: first_name + last_name
}

export interface EventEntryWithDriver extends EventEntry {
  driver: Driver;
}

export interface SessionResultWithDriver extends SessionResult {
  driver: Driver;
}

export interface StandingRow {
  driver_id: string;
  driver_name: string;
  driver_class: DriverClass;
  points_by_event: Record<string, number>;
  total_points: number;
}

export interface TeamStandingRow {
  team_id: string;
  team_name: string;
  total_points: number;
  points_by_event: Record<string, number>;
}
