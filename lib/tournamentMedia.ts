/**
 * 대회별 대표 미디어 설정
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  운영 서버 배포 시: 해당 대회 ID 키에 Cloudinary URL 입력           │
 * │  Cloudinary 대시보드에서 파일 업로드 후 URL 을 복사하세요.          │
 * │                                                                     │
 * │  업로드 권장 public_id 형식:                                        │
 * │    카드BG     → just-golf/results/{id}/card-bg                     │
 * │    단체사진   → just-golf/results/{id}/group-photo                 │
 * │    하이라이트 → just-golf/results/{id}/highlight  (video)          │
 * └─────────────────────────────────────────────────────────────────────┘
 */

export type TournamentMedia = {
  /** 상단 요약 카드 배경 이미지 URL (비워두면 기본 흰색 카드) */
  cardBgUrl?: string;
  /** 단체사진 URL — 결과 페이지 sticky 배경으로 표시 */
  groupPhotoUrl?: string;
  /** 하이라이트 영상 URL (mp4) — 버튼 클릭 시 팝업 재생 */
  highlightVideoUrl?: string;
};

export const TOURNAMENT_MEDIA: Record<number, TournamentMedia> = {
  // ── 개발 테스트 대회 (ID: 1) ─────────────────────────────────────
  // Cloudinary 업로드 후 URL 을 여기에 붙여넣으세요.
  1: {
    cardBgUrl: "https://res.cloudinary.com/dqoqvzlt5/image/upload/just-golf/results/1/card-bg",
    groupPhotoUrl: "https://res.cloudinary.com/dqoqvzlt5/image/upload/just-golf/results/1/group-photo",
    highlightVideoUrl: "https://res.cloudinary.com/dqoqvzlt5/video/upload/just-golf/results/1/highlight.mp4",
  },

  // ── 운영 서버 대회 ────────────────────────────────────────────────
  // 예) 2: { cardBgUrl: "https://res.cloudinary.com/...", ... },
};

export function getTournamentMedia(tournamentId: number): TournamentMedia {
  return TOURNAMENT_MEDIA[tournamentId] ?? {};
}
