-- Hobikardisari Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ============================================================
-- SEASONS
-- ============================================================
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DRIVERS
-- ============================================================
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE,
  weight NUMERIC(5,2),
  class TEXT CHECK (class IN ('Junior', 'Standard', 'Heavy')),
  is_licensed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TEAMS (2 core drivers + 1 optional substitute per season)
-- ============================================================
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  driver1_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
  driver2_id UUID NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
  substitute_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  substitute_used_on_event UUID,  -- references events(id), added as FK after events table
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_drivers_different CHECK (driver1_id != driver2_id),
  CONSTRAINT substitute_different CHECK (
    substitute_id IS NULL OR (substitute_id != driver1_id AND substitute_id != driver2_id)
  )
);

-- ============================================================
-- EVENTS (race rounds in a season)
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  venue TEXT,
  event_date DATE,
  max_karts INT NOT NULL DEFAULT 9,
  available_kart_numbers INT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'published')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now add the FK for substitute_used_on_event
ALTER TABLE teams
  ADD CONSTRAINT teams_substitute_event_fk
  FOREIGN KEY (substitute_used_on_event) REFERENCES events(id) ON DELETE SET NULL;

-- ============================================================
-- EVENT ENTRIES (drivers registered for a specific event)
-- ============================================================
CREATE TABLE event_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  class TEXT NOT NULL CHECK (class IN ('Junior', 'Standard', 'Heavy')),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_excluded_from_points BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, driver_id)
);

-- ============================================================
-- SESSIONS (quali_1, quali_2, heat, final — with group info)
-- ============================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('quali_1', 'quali_2', 'heat', 'final')),
  group_name TEXT NOT NULL,  -- e.g., 'A', 'B', 'C' or 'Final A', 'Final B'
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SESSION PARTICIPANTS (driver + kart assignment per session)
-- ============================================================
CREATE TABLE session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  kart_number INT,
  grid_position INT,
  UNIQUE (session_id, driver_id)
);

-- ============================================================
-- SESSION RESULTS (finishing data per driver per session)
-- ============================================================
CREATE TABLE session_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  position INT,
  total_time TEXT,         -- e.g., '1:23.456'
  fastest_lap TEXT,        -- e.g., '0:32.123'
  points INT NOT NULL DEFAULT 0,
  fastest_lap_bonus INT NOT NULL DEFAULT 0,
  penalty_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, driver_id)
);

-- ============================================================
-- INDEXES for common queries
-- ============================================================
CREATE INDEX idx_events_season ON events(season_id);
CREATE INDEX idx_event_entries_event ON event_entries(event_id);
CREATE INDEX idx_event_entries_driver ON event_entries(driver_id);
CREATE INDEX idx_sessions_event ON sessions(event_id);
CREATE INDEX idx_session_participants_session ON session_participants(session_id);
CREATE INDEX idx_session_results_session ON session_results(session_id);
CREATE INDEX idx_session_results_driver ON session_results(driver_id);
CREATE INDEX idx_drivers_class ON drivers(class);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Enable RLS on all tables
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view standings, results)
CREATE POLICY "Public read seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Public read drivers" ON drivers FOR SELECT USING (true);
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Public read event_entries" ON event_entries FOR SELECT USING (true);
CREATE POLICY "Public read sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Public read session_participants" ON session_participants FOR SELECT USING (true);
CREATE POLICY "Public read session_results" ON session_results FOR SELECT USING (true);

-- Authenticated users can write (admin operations)
CREATE POLICY "Auth insert seasons" ON seasons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update seasons" ON seasons FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete seasons" ON seasons FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert drivers" ON drivers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update drivers" ON drivers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete drivers" ON drivers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert teams" ON teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update teams" ON teams FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete teams" ON teams FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert events" ON events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update events" ON events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete events" ON events FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert event_entries" ON event_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update event_entries" ON event_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete event_entries" ON event_entries FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert sessions" ON sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update sessions" ON sessions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete sessions" ON sessions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert session_participants" ON session_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update session_participants" ON session_participants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete session_participants" ON session_participants FOR DELETE TO authenticated USING (true);

CREATE POLICY "Auth insert session_results" ON session_results FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update session_results" ON session_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete session_results" ON session_results FOR DELETE TO authenticated USING (true);

-- ============================================================
-- UPDATED_AT trigger for drivers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Create 2026 season
-- ============================================================
INSERT INTO seasons (name, year, is_active) VALUES ('Hooaeg 2026', 2026, true);
