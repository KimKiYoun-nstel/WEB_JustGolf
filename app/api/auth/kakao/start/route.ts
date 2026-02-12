import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { appendState, serializeStateCookie } from "../../../../../lib/kakaoOidcState";
import { writeErrorLog } from "../../../../../lib/server/errorLogger";

const STATE_COOKIE = "kakao_oidc_state";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes
const secure = process.env.NODE_ENV === "production";

const buildRedirectUri = (request: NextRequest) => {
  return (
    process.env.KAKAO_OIDC_REDIRECT_URI ??
    `${request.nextUrl.origin}/auth/callback`
  );
};

const generateToken = () => randomBytes(24).toString("base64url");

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_CLIENT_ID;
  const redirectUri = buildRedirectUri(request);
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");

  if (!clientId) {
    await writeErrorLog({
      category: "auth",
      action: "kakao_login_submit",
      message: "??? ??? ?? ??: KAKAO_CLIENT_ID? ????.",
      path: request.nextUrl.pathname,
      ip,
      userAgent,
    });

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("message", "??? ??? ??? ?????.");
    return NextResponse.redirect(loginUrl);
  }

  const state = generateToken();
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
