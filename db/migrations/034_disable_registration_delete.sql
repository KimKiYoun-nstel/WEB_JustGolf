-- 034_disable_registration_delete.sql
-- Purpose: keep registration history by disallowing physical delete on registrations
-- Date: 2026-03-06
-- Run this script manually in Supabase SQL Editor.

-- Drop legacy DELETE policies for registrations
drop policy if exists "registrations_delete_own" on public.registrations;
drop policy if exists "Users can delete registrations" on public.registrations;
drop policy if exists "Users can delete own registration" on public.registrations;

-- Ensure API roles cannot issue DELETE on registrations
revoke delete on table public.registrations from authenticated;
revoke delete on table public.registrations from anon;
