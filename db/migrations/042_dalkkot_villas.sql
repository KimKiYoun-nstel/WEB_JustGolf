-- 달콧 별장 시스템 Phase 2: 별장 정보 및 CMS 콘텐츠 테이블
-- 실행 환경: Supabase SQL Editor
-- 의존성: 041_dalkkot_profiles.sql 실행 후 진행

-- 1. 별장 정보 테이블
CREATE TABLE IF NOT EXISTS public.dalkkot_villas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL DEFAULT '달콧',
  address       TEXT,
  naver_map_url TEXT,
  kakao_map_url TEXT,
  -- 관리자 편집 가능 콘텐츠 (Markdown)
  intro_md      TEXT,
  rules_md      TEXT,
  faq_md        TEXT,
  -- 공과금 단가
  gas_unit_price     INTEGER DEFAULT 5200,  -- 원/m³
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_dalkkot_villas_updated_at
  BEFORE UPDATE ON public.dalkkot_villas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. 초기 달콧 데이터 삽입
INSERT INTO public.dalkkot_villas
  (name, address, intro_md, rules_md, faq_md)
VALUES (
  '달콧',
  '제주특별자치도 제주시 조천읍 조함해안로 17-7',

  E'## 달콧 별장에 오신 것을 환영합니다\n\n제주 조천읍 해안가에 위치한 달콧 별장입니다.\n동호회 지인 전용으로 운영되는 공간입니다.\n\n**공과금은 사용한 만큼 후불, 셀프청소**',

  E'## 이용 수칙\n\n- 퇴실할 때 보일러 켜진 상태로 놓아주시고 퇴실 카톡 부탁드립니다\n- 대문, 현관은 항상 닫힌 상태로 유지해주세요\n- 제주는 바람이 많이 불어 위험할 수 있습니다\n- 화장실에 물티슈 사용불가 (옆집 배관 막힘 위험)\n- 쓰레기는 밖에 모아두었다가 버려주세요\n- 음식물쓰레기는 티머니 카드로 태그하고 버릴 수 있습니다\n- 퇴실할 때 술 외의 모든 음식물은 처리 부탁드립니다\n- 안거리 보일러는 20도 난방에 맞춰 놓고 퇴실 바랍니다\n- 밖거리 전기보일러는 꺼주세요\n- 숙소점검 왔다고 하면 동호회 지인이 빌려준 것이라고 말씀해주세요\n- 창고 안 세탁기의 멀티탭은 항상 켜놔 주세요 (대문 앱 제어용)\n- 커피는 일리 캡슐만 사용 가능합니다 (다른 캡슐 호환 안됨)',

  E'## FAQ\n\n**Q. 주차는 어디에 하나요?**\n골목으로 진입하여 녹색 위치에 주차. 좋은 자리는 주민들께 양보해주세요.\n\n**Q. 와이파이 정보는?**\n관리자에게 별도 문의해주세요.\n\n**Q. 커피머신 캡슐은?**\n일리(illy) 다크로스트 캡슐 전용. 캡슐 모양 확인 필수 (호환 안됨).'
);

-- 3. RLS
ALTER TABLE public.dalkkot_villas ENABLE ROW LEVEL SECURITY;

-- 승인된 사용자 조회
CREATE POLICY "dalkkot_villas_select_approved"
  ON public.dalkkot_villas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_approved = true
    )
  );

-- 달콧 관리자 편집
CREATE POLICY "dalkkot_villas_update_admin"
  ON public.dalkkot_villas FOR UPDATE
  USING (public.is_dalkkot_admin());
