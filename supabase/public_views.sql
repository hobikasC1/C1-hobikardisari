-- ============================================================
-- PUBLIC VIEWS FOR WORDPRESS INTEGRATION
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- These views are read-only and safe to expose via the anon key.
-- ============================================================


-- ============================================================
-- 1. Season calendar
-- ============================================================
CREATE OR REPLACE VIEW public_calendar AS
SELECT
  e.sort_order    AS event_order,
  e.name          AS event_name,
  e.venue,
  e.event_date,
  e.status
FROM events e
JOIN seasons s ON s.id = e.season_id
WHERE s.is_active = true
ORDER BY e.sort_order;


-- ============================================================
-- 2. Driver standings (one row per driver × event)
--    WordPress pivots these into the standings table.
-- ============================================================
CREATE OR REPLACE VIEW public_driver_standings AS
WITH event_driver_points AS (
  SELECT
    d.id                                      AS driver_id,
    d.first_name || ' ' || d.last_name        AS driver_name,
    ee.class,
    e.id                                      AS event_id,
    e.name                                    AS event_name,
    e.sort_order                              AS event_order,
    COALESCE(SUM(sr.points + sr.fastest_lap_bonus), 0) AS event_points
  FROM session_results  sr
  JOIN sessions         s   ON s.id  = sr.session_id
  JOIN events           e   ON e.id  = s.event_id
  JOIN seasons          sea ON sea.id = e.season_id
  JOIN event_entries    ee  ON ee.event_id = e.id AND ee.driver_id = sr.driver_id
  JOIN drivers          d   ON d.id  = sr.driver_id
  WHERE sea.is_active                = true
    AND e.status                     = 'published'
    AND ee.is_excluded_from_points   = false
  GROUP BY
    d.id, d.first_name, d.last_name,
    ee.class,
    e.id, e.name, e.sort_order
),
with_totals AS (
  SELECT
    edp.*,
    SUM(edp.event_points) OVER (PARTITION BY edp.driver_id, edp.class) AS total_points
  FROM event_driver_points edp
)
SELECT
  driver_id,
  driver_name,
  class,
  event_id,
  event_name,
  event_order,
  event_points,
  total_points,
  RANK() OVER (
    PARTITION BY class
    ORDER BY total_points DESC
  ) AS class_rank
FROM with_totals
ORDER BY class, class_rank, event_order;


-- ============================================================
-- 3. Team standings (one row per team × event)
--    Top 2 scorers from each team per event count.
-- ============================================================
CREATE OR REPLACE VIEW public_team_standings AS
WITH event_driver_points AS (
  SELECT
    d.id                                               AS driver_id,
    ee.class,
    e.id                                               AS event_id,
    e.name                                             AS event_name,
    e.sort_order                                       AS event_order,
    COALESCE(SUM(sr.points + sr.fastest_lap_bonus), 0) AS event_points
  FROM session_results  sr
  JOIN sessions         s   ON s.id  = sr.session_id
  JOIN events           e   ON e.id  = s.event_id
  JOIN seasons          sea ON sea.id = e.season_id
  JOIN event_entries    ee  ON ee.event_id = e.id AND ee.driver_id = sr.driver_id
  JOIN drivers          d   ON d.id  = sr.driver_id
  WHERE sea.is_active                = true
    AND e.status                     = 'published'
    AND ee.is_excluded_from_points   = false
  GROUP BY d.id, ee.class, e.id, e.name, e.sort_order
),
team_member_event_points AS (
  SELECT
    t.id                    AS team_id,
    t.name                  AS team_name,
    edp.event_id,
    edp.event_name,
    edp.event_order,
    edp.event_points,
    ROW_NUMBER() OVER (
      PARTITION BY t.id, edp.event_id
      ORDER BY edp.event_points DESC
    ) AS member_rank
  FROM teams t
  JOIN seasons sea ON sea.id = t.season_id AND sea.is_active = true
  JOIN event_driver_points edp
    ON edp.driver_id IN (t.driver1_id, t.driver2_id, t.substitute_id)
),
team_totals AS (
  SELECT
    team_id,
    team_name,
    event_id,
    event_name,
    event_order,
    SUM(event_points) AS event_points
  FROM team_member_event_points
  WHERE member_rank <= 2
  GROUP BY team_id, team_name, event_id, event_name, event_order
),
team_with_totals AS (
  SELECT
    *,
    SUM(event_points) OVER (PARTITION BY team_id) AS total_points
  FROM team_totals
)
SELECT
  team_id,
  team_name,
  event_id,
  event_name,
  event_order,
  event_points,
  total_points,
  RANK() OVER (ORDER BY total_points DESC) AS team_rank
FROM team_with_totals
ORDER BY team_rank, event_order;


-- ============================================================
-- 4. Latest published event — final results only
-- ============================================================
CREATE OR REPLACE VIEW public_latest_results AS
WITH latest_event AS (
  SELECT e.id
  FROM events e
  JOIN seasons s ON s.id = e.season_id
  WHERE s.is_active = true AND e.status = 'published'
  ORDER BY e.sort_order DESC
  LIMIT 1
)
SELECT
  e.name                                          AS event_name,
  e.event_date,
  s.group_name,
  s.sort_order                                    AS session_order,
  sr.position,
  d.first_name || ' ' || d.last_name             AS driver_name,
  ee.class,
  sr.total_time,
  sr.fastest_lap,
  sr.penalty_note
FROM session_results  sr
JOIN sessions         s   ON s.id  = sr.session_id
JOIN events           e   ON e.id  = s.event_id
JOIN event_entries    ee  ON ee.event_id = e.id AND ee.driver_id = sr.driver_id
JOIN drivers          d   ON d.id  = sr.driver_id
WHERE s.type   = 'final'
  AND e.id     = (SELECT id FROM latest_event)
ORDER BY s.sort_order, sr.position;


-- ============================================================
-- GRANT read-only access to the anon role
-- (PostgREST / Supabase REST API uses this role for public calls)
-- ============================================================
GRANT SELECT ON public_calendar         TO anon;
GRANT SELECT ON public_driver_standings TO anon;
GRANT SELECT ON public_team_standings   TO anon;
GRANT SELECT ON public_latest_results   TO anon;
