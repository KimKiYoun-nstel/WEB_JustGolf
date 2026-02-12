import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { appendState, serializeStateCookie } from "../../../../../lib/kakaoOidcState";
import { writeErrorLog } from "../../../../../lib/server/errorLogger";
import { createRequestSupabaseClient } from "../../../../../lib/apiGuard";

const STATE_COOKIE = "kakao_oidc_state";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes
const secure = process.env.NODE_ENV === "production";

const buildRedirectUri = (request: NextRequest) => {
  return (
    process.env.KAKAO_OIDC_REDIRECT_URI ??
    `${request.nextUrl.origin}/auth/callback`
  );
};

const generateToken = (prefix: "si" | "lk" = "lk") =>
  `${prefix}_${randomBytes(24).toString("base64url")}`;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_CLIENT_ID;
  const redirectUri = buildRedirectUri(request);
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");

  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("message", "카카오 연동은 로그인 후 진행해주세요.");
    return NextResponse.redirect(loginUrl);
  }

  const hasKakaoIdentity =
    user.app_metadata?.provider === "kakao" ||
    (user.identities ?? []).some((identity) => identity.provider === "kakao");

  if (hasKakaoIdentity) {
    const profileUrl = new URL("/profile", request.url);
    profileUrl.searchParams.set("message", "이미 카카오 계정이 연동되어 있습니다.");
    return NextResponse.redirect(profileUrl);
  }

  if (!clientId) {
    await writeErrorLog({
      category: "auth",
      action: "kakao_login_submit",
      message: "카카오 연동 설정 누락: KAKAO_CLIENT_ID가 없습니다.",
      authUserId: user.id,
      path: request.nextUrl.pathname,
      ip,
      userAgent,
    });

    const profileUrl = new URL("/profile", request.url);
    profileUrl.searchParams.set("message", "카카오 로그인 설정이 필요합니다.");
    return NextResponse.redirect(profileUrl);
  }

  const state = generateToken("lk");
  const existingCookieValue = request.cookies.get(STATE_COOKIE)?.value;
  const states = appendState(existingCookieValue, state);
  const serializedStates = serializeStateCookie(states);

  const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(STATE_COOKIE, serializedStates, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
