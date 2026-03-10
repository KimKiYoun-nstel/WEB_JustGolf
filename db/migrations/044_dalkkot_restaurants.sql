-- 달콧 별장 시스템 Phase 4: 맛집 + 소셜 기능 (좋아요/댓글)
-- 실행 환경: Supabase SQL Editor
-- 의존성: 043_dalkkot_reservations.sql 실행 후 진행

-- 1. 맛집 카테고리 타입
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dalkkot_restaurant_category') THEN
    CREATE TYPE dalkkot_restaurant_category AS ENUM (
      '식당', '카페', '베이커리', '술집', '편의점', '기타'
    );
  END IF;
END$$;

-- 2. 맛집 테이블
CREATE TABLE IF NOT EXISTS public.dalkkot_restaurants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    dalkkot_restaurant_category NOT NULL DEFAULT '식당',
  address     TEXT,
  description TEXT,          -- 추천 메뉴, 한 줄 소개 등 (Markdown 지원)
  map_url     TEXT,          -- 카카오맵/네이버지도 링크
  -- 편집 이력 (누가 추가/수정했는지 표시)
  added_by    UUID NOT NULL REFERENCES auth.users(id),
  updated_by  UUID REFERENCES auth.users(id),
  -- 좋아요 수 캐싱
  like_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dalkkot_restaurants_updated_at
  BEFORE UPDATE ON public.dalkkot_restaurants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. 좋아요 테이블 (유저당 식당당 1회)
CREATE TABLE IF NOT EXISTS public.dalkkot_restaurant_likes (
  restaurant_id UUID NOT NULL REFERENCES public.dalkkot_restaurants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (restaurant_id, user_id)
);

-- 4. 댓글 테이블
CREATE TABLE IF NOT EXISTS public.dalkkot_restaurant_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.dalkkot_restaurants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL CHECK (length(content) >= 1 AND length(content) <= 500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dalkkot_comments_updated_at
  BEFORE UPDATE ON public.dalkkot_restaurant_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. 좋아요 수 동기화 트리거
CREATE OR REPLACE FUNCTION public.sync_dalkkot_like_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.dalkkot_restaurants
  SET like_count = (
    SELECT COUNT(*) FROM public.dalkkot_restaurant_likes
    WHERE restaurant_id = COALESCE(NEW.restaurant_id, OLD.restaurant_id)
  )
  WHERE id = COALESCE(NEW.restaurant_id, OLD.restaurant_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_dalkkot_like_count
  AFTER INSERT OR DELETE ON public.dalkkot_restaurant_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_dalkkot_like_count();

-- 6. 인덱스
CREATE INDEX idx_dalkkot_restaurants_category
  ON public.dalkkot_restaurants(category);
CREATE INDEX idx_dalkkot_restaurant_likes_user
  ON public.dalkkot_restaurant_likes(user_id);
CREATE INDEX idx_dalkkot_comments_restaurant
  ON public.dalkkot_restaurant_comments(restaurant_id, created_at DESC);

-- 7. RLS

-- 맛집 테이블
ALTER TABLE public.dalkkot_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dalkkot_restaurants_select_approved"
  ON public.dalkkot_restaurants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

CREATE POLICY "dalkkot_restaurants_insert_approved"
  ON public.dalkkot_restaurants FOR INSERT
  WITH CHECK (
    auth.uid() = added_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

-- 본인이 등록한 항목 또는 달콧 관리자만 편집
CREATE POLICY "dalkkot_restaurants_update_own_or_admin"
  ON public.dalkkot_restaurants FOR UPDATE
  USING (auth.uid() = added_by OR public.is_dalkkot_admin());

-- 본인이 등록한 항목 또는 달콧 관리자만 삭제
CREATE POLICY "dalkkot_restaurants_delete_own_or_admin"
  ON public.dalkkot_restaurants FOR DELETE
  USING (auth.uid() = added_by OR public.is_dalkkot_admin());

-- 좋아요 테이블
ALTER TABLE public.dalkkot_restaurant_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dalkkot_likes_select_approved"
  ON public.dalkkot_restaurant_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

CREATE POLICY "dalkkot_likes_insert_own"
  ON public.dalkkot_restaurant_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dalkkot_likes_delete_own"
  ON public.dalkkot_restaurant_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 댓글 테이블
ALTER TABLE public.dalkkot_restaurant_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dalkkot_comments_select_approved"
  ON public.dalkkot_restaurant_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

CREATE POLICY "dalkkot_comments_insert_own"
  ON public.dalkkot_restaurant_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dalkkot_comments_update_own"
  ON public.dalkkot_restaurant_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인 댓글 또는 달콧 관리자 삭제
CREATE POLICY "dalkkot_comments_delete_own_or_admin"
  ON public.dalkkot_restaurant_comments FOR DELETE
  USING (auth.uid() = user_id OR public.is_dalkkot_admin());
