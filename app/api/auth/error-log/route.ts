import { NextRequest, NextResponse } from "next/server";
import { writeErrorLog } from "../../../../lib/server/errorLogger";

const ALLOWED_ACTIONS = new Set([
  "login_submit",
  "signup_submit",
  "kakao_login_submit",
  "kakao_callback",
]);

type BodyShape = {
  action?: unknown;
  message?: unknown;
  errorCode?: unknown;
  email?: unknown;
  authUserId?: unknown;
  path?: unknown;
  details?: unknown;
};

const safeString = (value: unknown, maxLength = 500) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const safeObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as BodyShape | null;
    if (!body) {
      return NextResponse.json(
        { error: "요청 본문이 필요합니다." },
        { status: 400 }
      );
    }

    const action = safeString(body.action, 100);
    const message = safeString(body.message, 1000);

    if (!action || !ALLOWED_ACTIONS.has(action)) {
      return NextResponse.json(
        { error: "허용되지 않은 action 입니다." },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "message는 필수입니다." },
        { status: 400 }
      );
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
    const userAgent = request.headers.get("user-agent");

    await writeErrorLog({
      category: "auth",
      action,
      message,
      errorCode: safeString(body.errorCode, 100),
      email: safeString(body.email, 254),
      authUserId: safeString(body.authUserId, 64),
      path: safeString(body.path, 300) ?? request.nextUrl.pathname,
      ip,
      userAgent,
      details: safeObject(body.details),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error log API failed:", error);
    return NextResponse.json(
      { error: "에러 로그 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
