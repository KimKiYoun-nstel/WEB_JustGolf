-- Nickname uniqueness enforcement
-- Migration: 2026-02-11

-- 1) Profiles nickname must be unique (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_unique_lower
ON public.profiles (lower(nickname));

-- 2) Registrations nickname must be unique per tournament (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS registrations_tournament_nickname_unique_lower
ON public.registrations (tournament_id, lower(nickname));

-- 3) Helper RPC for nickname availability (optionally exclude user id)
CREATE OR REPLACE FUNCTION public.is_nickname_available(p_nickname text, p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(p.nickname) = lower(p_nickname)
      AND (p_user_id IS NULL OR p.id <> p_user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_nickname_available(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_nickname_available(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_nickname_available(text, uuid) TO anon;
