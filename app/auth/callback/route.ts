import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type PendingCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

type KakaoTokenResponse = {
  token_type?: string;
  access_token?: string;
  id_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
};

const STATE_COOKIE = "kakao_oidc_state";

const KAKAO_ERROR_MESSAGE = "카카오 로그인 처리에 실패했습니다.";
const KAKAO_STATE_ERROR_MESSAGE = "카카오 로그인 요청 검증에 실패했습니다.";
const KAKAO_TOKEN_ERROR_MESSAGE = "카카오 로그인 토큰 교환에 실패했습니다.";

const buildRedirectUri = (request: NextRequest) => {
  return (
    process.env.KAKAO_OIDC_REDIRECT_URI ??
    `${request.nextUrl.origin}/auth/callback`
  );
};

const clearOidcCookies = (response: NextResponse) => {
  response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
};

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;

  const toLogin = (message: string) => {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("message", message);
    const response = NextResponse.redirect(loginUrl);
    clearOidcCookies(response);
    return response;
  };

  const toLoginWithDebug = (fallbackMessage: string, debugMessage?: string) => {
    const safeDebug = (debugMessage ?? "").replace(/\s+/g, " ").trim();
    if (process.env.NODE_ENV !== "production" && safeDebug) {
      return toLogin(`${fallbackMessage} (${safeDebug})`);
    }
    return toLogin(fallbackMessage);
  };

  if (!code || !state || !stateCookie || state !== stateCookie) {
    return toLogin(KAKAO_STATE_ERROR_MESSAGE);
  }

  const clientId = process.env.KAKAO_CLIENT_ID;
  const redirectUri = buildRedirectUri(request);

  if (!clientId) {
    return toLogin(KAKAO_ERROR_MESSAGE);
  }

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });

  if (process.env.KAKAO_CLIENT_SECRET) {
    tokenParams.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: tokenParams.toString(),
    cache: "no-store",
  });

  const tokenData = (await tokenResponse
    .json()
    .catch(() => ({}))) as KakaoTokenResponse;

  if (!tokenResponse.ok || !tokenData.id_token || !tokenData.access_token) {
    console.error("Kakao token exchange failed:", tokenData);
    return toLoginWithDebug(
      KAKAO_TOKEN_ERROR_MESSAGE,
      tokenData.error_description ?? tokenData.error
    );
  }

  const pendingCookies: PendingCookie[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options });
          });
        },
      },
    }
  );

  const signInPayload: {
    provider: "kakao";
    token: string;
    access_token: string;
  } = {
    provider: "kakao",
    token: tokenData.id_token,
    access_token: tokenData.access_token,
  };

  const { error: signInError } = await supabase.auth.signInWithIdToken(signInPayload);

  if (signInError) {
    console.error("Supabase signInWithIdToken failed:", signInError);
    return toLoginWithDebug(KAKAO_ERROR_MESSAGE, signInError.message);
  }

  const redirectResponse = NextResponse.redirect(new URL("/start", requestUrl.origin));
  pendingCookies.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  clearOidcCookies(redirectResponse);

  return redirectResponse;
}
