/**
 * 전역 에러 처리 및 재시도 로직
 */

export type RetryPolicy = {
  maxRetries: number;
  delayMs: number;
  backoffFactor?: number;
};

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  delayMs: 500,
  backoffFactor: 1.5,
};

/**
 * 네트워크 재시도 가능 여부 판단
 */
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.message?.includes("Network") || error?.message?.includes("timeout")) {
    return true;
  }

  // Supabase specific errors
  if (error?.status >= 500 || error?.status === 429) {
    return true;
  }

  // Connection errors
  if (error?.code === "CONN_ERROR" || error?.code === "SOCKET_ERROR") {
    return true;
  }

  return false;
}

/**
 * 비동기 함수에 재시도 로직 적용
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): Promise<T> {
  let lastError: Error | null = null;
  let delay = policy.delayMs;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === policy.maxRetries || !isRetryableError(error)) {
        break;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      if (policy.backoffFactor) {
        delay = Math.min(delay * policy.backoffFactor, 10000); // Max 10s
      }
    }
  }

  throw lastError;
}

/**
 * Supabase 에러 메시지 포맷팅
 */
export function formatSupabaseError(error: any): string {
  if (!error) return "알 수 없는 오류";

  // 에러 메시지 우선순위
  const message = error?.message || error?.error_description || String(error);

  // 일반 사용자 친화적 메시지로 변환
  if (message.includes("Invalid")) {
    return "입력값이 올바르지 않습니다";
  }
  if (message.includes("duplicate") || message.includes("unique")) {
    return "이미 존재하는 데이터입니다";
  }
  if (message.includes("not found")) {
    return "요청한 데이터를 찾을 수 없습니다";
  }
  if (message.includes("permission") || message.includes("denied")) {
    return "권한이 없습니다";
  }
  if (message.includes("Network") || message.includes("timeout")) {
    return "네트워크 연결을 확인해주세요";
  }

  // 그 외는 원본 메시지
  return message;
}

/**
 * 에러 로깅 (개발 환경에서만)
 */
export function logError(context: string, error: any): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}]`, error);
  }
}

/**
 * 사용자 친화적 에러 메시지 생성
 */
export function getUserFriendlyError(error: any, context?: string): string {
  const message = formatSupabaseError(error);
  if (context) {
    logError(context, error);
  }
  return message;
}
