-- Prize supports: allow owners to update/delete their entries
-- Migration: 2026-02-11

ALTER TABLE public.tournament_prize_supports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update their own prize supports" ON public.tournament_prize_supports;
CREATE POLICY "Users can update their own prize supports"
ON public.tournament_prize_supports
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own prize supports" ON public.tournament_prize_supports;
CREATE POLICY "Users can delete their own prize supports"
ON public.tournament_prize_supports
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
