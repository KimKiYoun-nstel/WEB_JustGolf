import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

const STATE_COOKIE = "kakao_oidc_state";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes

const buildRedirectUri = (request: NextRequest) => {
  return (
    process.env.KAKAO_OIDC_REDIRECT_URI ??
    `${request.nextUrl.origin}/auth/callback`
  );
};

const generateToken = () => randomBytes(24).toString("base64url");

export async function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_CLIENT_ID;
  const redirectUri = buildRedirectUri(request);

  if (!clientId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("message", "카카오 로그인 설정이 필요합니다.");
    return NextResponse.redirect(loginUrl);
  }

  const state = generateToken();

  const authorizeUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
