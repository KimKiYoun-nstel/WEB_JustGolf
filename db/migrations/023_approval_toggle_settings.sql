-- App settings: approval required toggle
-- Migration: 2026-02-11

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Default: approval required ON
INSERT INTO public.app_settings (key, value)
VALUES ('approval_required', true)
ON CONFLICT (key) DO NOTHING;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_approval_required()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_settings WHERE key = 'approval_required'),
    true
  );
$$;

REVOKE ALL ON FUNCTION public.is_approval_required() FROM public;
GRANT EXECUTE ON FUNCTION public.is_approval_required() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approval_required() TO anon;

-- Update is_approved_user to honor toggle
CREATE OR REPLACE FUNCTION public.is_approved_user(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    NOT public.is_approval_required()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = uid AND p.is_approved = true
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_user(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO authenticated;

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_select_public" ON public.app_settings;
CREATE POLICY "app_settings_select_public"
ON public.app_settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "app_settings_write_admin" ON public.app_settings;
CREATE POLICY "app_settings_write_admin"
ON public.app_settings
FOR INSERT
WITH CHECK (public.is_admin_secure(auth.uid()));

DROP POLICY IF EXISTS "app_settings_update_admin" ON public.app_settings;
CREATE POLICY "app_settings_update_admin"
ON public.app_settings
FOR UPDATE
USING (public.is_admin_secure(auth.uid()))
WITH CHECK (public.is_admin_secure(auth.uid()));
