-- Migration: 008_fix_profiles_rls.sql
-- Purpose: Fix infinite recursion in profiles RLS policies
-- Date: 2026-02-09
--
-- Run this script manually in Supabase SQL Editor.

-- =========================================
-- Remove recursive admin policy
-- =========================================
drop policy if exists "Admins can view all profiles" on public.profiles;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id);

-- Notes
-- - Admin-wide profiles read can be reintroduced later using a SECURITY DEFINER
--   function to avoid recursion.
