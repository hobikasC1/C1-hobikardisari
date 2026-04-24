-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  dob date,
  weight numeric,
  class text CHECK (class = ANY (ARRAY['Junior'::text, 'Standard'::text, 'Heavy'::text])),
  is_licensed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT drivers_pkey PRIMARY KEY (id)
);
CREATE TABLE public.event_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  class text NOT NULL CHECK (class = ANY (ARRAY['Junior'::text, 'Standard'::text, 'Heavy'::text])),
  team_id uuid,
  is_excluded_from_points boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_entries_pkey PRIMARY KEY (id),
  CONSTRAINT event_entries_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_entries_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id),
  CONSTRAINT event_entries_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL,
  name text NOT NULL,
  venue text,
  event_date date,
  max_karts integer NOT NULL DEFAULT 9,
  available_kart_numbers ARRAY NOT NULL DEFAULT '{}'::integer[],
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'completed'::text, 'published'::text])),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id)
);
CREATE TABLE public.seasons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT seasons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.session_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  kart_number integer,
  grid_position integer,
  CONSTRAINT session_participants_pkey PRIMARY KEY (id),
  CONSTRAINT session_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT session_participants_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id)
);
CREATE TABLE public.session_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  position integer,
  total_time text,
  fastest_lap text,
  points integer NOT NULL DEFAULT 0,
  fastest_lap_bonus integer NOT NULL DEFAULT 0,
  penalty_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_results_pkey PRIMARY KEY (id),
  CONSTRAINT session_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id),
  CONSTRAINT session_results_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id)
);
CREATE TABLE public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['quali_1'::text, 'quali_2'::text, 'heat'::text, 'final'::text])),
  group_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  season_id uuid NOT NULL,
  driver1_id uuid NOT NULL,
  driver2_id uuid NOT NULL,
  substitute_id uuid,
  substitute_used_on_event uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id),
  CONSTRAINT teams_substitute_id_fkey FOREIGN KEY (substitute_id) REFERENCES public.drivers(id),
  CONSTRAINT teams_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id),
  CONSTRAINT teams_driver1_id_fkey FOREIGN KEY (driver1_id) REFERENCES public.drivers(id),
  CONSTRAINT teams_driver2_id_fkey FOREIGN KEY (driver2_id) REFERENCES public.drivers(id),
  CONSTRAINT teams_substitute_event_fk FOREIGN KEY (substitute_used_on_event) REFERENCES public.events(id)
);