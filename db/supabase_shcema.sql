-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  entity_type text NOT NULL,
  entity_id bigint NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.feedbacks (
  id integer NOT NULL DEFAULT nextval('feedbacks_id_seq'::regclass),
  user_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general'::text,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  nickname text,
  CONSTRAINT feedbacks_pkey PRIMARY KEY (id),
  CONSTRAINT feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.manager_permissions (
  id bigint NOT NULL DEFAULT nextval('manager_permissions_id_seq'::regclass),
  user_id uuid NOT NULL,
  tournament_id bigint NOT NULL,
  can_manage_side_events boolean DEFAULT false,
  granted_at timestamp without time zone DEFAULT now(),
  granted_by uuid NOT NULL,
  revoked_at timestamp without time zone,
  revoked_by uuid,
  CONSTRAINT manager_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT manager_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT manager_permissions_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT manager_permissions_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id),
  CONSTRAINT manager_permissions_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nickname text NOT NULL,
  full_name text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_approved boolean NOT NULL DEFAULT false,
  email text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.registration_activity_selections (
  id bigint NOT NULL DEFAULT nextval('registration_activity_selections_id_seq'::regclass),
  registration_id bigint NOT NULL,
  extra_id bigint NOT NULL,
  selected boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT registration_activity_selections_pkey PRIMARY KEY (id),
  CONSTRAINT registration_activity_selections_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT registration_activity_selections_extra_id_fkey FOREIGN KEY (extra_id) REFERENCES public.tournament_extras(id)
);
CREATE TABLE public.registration_extras (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  registration_id bigint NOT NULL UNIQUE,
  carpool_available boolean DEFAULT false,
  carpool_seats integer,
  transportation text,
  departure_location text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT registration_extras_pkey PRIMARY KEY (id),
  CONSTRAINT registration_extras_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.registrations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tournament_id bigint NOT NULL,
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  status text NOT NULL DEFAULT 'applied'::text CHECK (status = ANY (ARRAY['applied'::text, 'waitlisted'::text, 'approved'::text, 'canceled'::text, 'undecided'::text])),
  memo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  meal_option_id bigint,
  approval_status character varying DEFAULT 'approved'::character varying CHECK (approval_status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[])),
  approved_at timestamp without time zone DEFAULT now(),
  approved_by uuid,
  relation text,
  CONSTRAINT registrations_pkey PRIMARY KEY (id),
  CONSTRAINT registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT registrations_meal_option_id_fkey FOREIGN KEY (meal_option_id) REFERENCES public.tournament_meal_options(id),
  CONSTRAINT registrations_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id)
);
CREATE TABLE public.side_event_registrations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  side_event_id bigint NOT NULL,
  user_id uuid NOT NULL,
  nickname text NOT NULL,
  status text NOT NULL DEFAULT 'applied'::text CHECK (status = ANY (ARRAY['applied'::text, 'confirmed'::text, 'waitlisted'::text, 'canceled'::text])),
  memo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  meal_selected boolean DEFAULT false,
  lodging_selected boolean DEFAULT false,
  CONSTRAINT side_event_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT side_event_registrations_side_event_id_fkey FOREIGN KEY (side_event_id) REFERENCES public.side_events(id),
  CONSTRAINT side_event_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.side_events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tournament_id bigint NOT NULL,
  round_type text NOT NULL CHECK (round_type = ANY (ARRAY['pre'::text, 'post'::text])),
  title text NOT NULL,
  tee_time text,
  location text,
  notes text,
  open_at timestamp with time zone,
  close_at timestamp with time zone,
  max_participants integer,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'done'::text])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  meal_option_id bigint,
  lodging_available boolean DEFAULT false,
  lodging_required boolean DEFAULT false,
  CONSTRAINT side_events_pkey PRIMARY KEY (id),
  CONSTRAINT side_events_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT side_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT side_events_meal_option_id_fkey FOREIGN KEY (meal_option_id) REFERENCES public.tournament_meal_options(id)
);
CREATE TABLE public.tournament_extras (
  id bigint NOT NULL DEFAULT nextval('tournament_extras_id_seq'::regclass),
  tournament_id bigint NOT NULL,
  activity_name character varying NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT tournament_extras_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_extras_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_files (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tournament_id bigint NOT NULL,
  file_type text NOT NULL DEFAULT 'other'::text CHECK (file_type = ANY (ARRAY['groups'::text, 'notice'::text, 'other'::text])),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  uploaded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournament_files_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id),
  CONSTRAINT tournament_files_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_group_members (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  group_id bigint NOT NULL,
  registration_id bigint NOT NULL UNIQUE,
  position integer NOT NULL CHECK ("position" >= 1 AND "position" <= 4),
  role text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournament_group_members_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.tournament_groups(id),
  CONSTRAINT tournament_group_members_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.tournament_groups (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tournament_id bigint NOT NULL,
  group_no integer NOT NULL,
  tee_time text,
  is_published boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournament_groups_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_groups_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_meal_options (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tournament_id bigint NOT NULL,
  menu_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournament_meal_options_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_meal_options_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id)
);
CREATE TABLE public.tournament_prize_supports (
  id integer NOT NULL DEFAULT nextval('tournament_prize_supports_id_seq'::regclass),
  tournament_id integer NOT NULL,
  user_id uuid NOT NULL,
  item_name text NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  supporter_nickname text,
  CONSTRAINT tournament_prize_supports_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_prize_supports_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id),
  CONSTRAINT tournament_prize_supports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tournaments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title text NOT NULL,
  course_name text,
  location text,
  event_date date NOT NULL,
  tee_time text,
  notes text,
  open_at timestamp with time zone,
  close_at timestamp with time zone,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'done'::text])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tournaments_pkey PRIMARY KEY (id),
  CONSTRAINT tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);