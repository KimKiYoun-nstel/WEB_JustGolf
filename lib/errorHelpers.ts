/**
 * 에러 메시지 변환 유틸
 * 모든 페이지에서 공통으로 사용하는 Supabase 에러 → 한글 메시지
 */

export interface SupabaseError {
  code?: string;
  message: string;
}

export const friendlyError = (error: SupabaseError): string => {
  if (!error) return "알 수 없는 에러가 발생했습니다.";

  // 에러 코드 기반 처리
  if (error.code === "23505") {
    return "이미 등록된 정보입니다.";
  }
  if (error.code === "42501") {
    return "권한이 없습니다.";
  }
  if (error.code === "PGRST116") {
    return "요청한 데이터를 찾을 수 없습니다.";
  }

  // 메시지 기반 처리
  if (error.message.toLowerCase().includes("permission")) {
    return "권한이 없습니다.";
  }
  if (error.message.toLowerCase().includes("not found")) {
    return "찾을 수 없습니다.";
  }
  if (error.message.toLowerCase().includes("unique")) {
    return "중복된 항목입니다.";
  }

  // 기본값
  return error.message || "에러가 발생했습니다.";
};

export const friendlyErrorApproval = (error: SupabaseError): string => {
  if (error.code === "23505") return "이미 처리된 신청입니다.";
  if (error.code === "42501") return "승인 권한이 없습니다.";
  return friendlyError(error);
};

export const friendlyErrorTournament = (error: SupabaseError): string => {
  if (error.code === "42501") return "대회 관리자만 접근할 수 있습니다.";
  return friendlyError(error);
};
