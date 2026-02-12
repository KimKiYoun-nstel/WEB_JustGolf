import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import {
  consumeState,
  parseStateCookie,
  serializeStateCookie,
} from "../../../lib/kakaoOidcState";
import { createServiceRoleSupabaseClient } from "../../../lib/apiGuard";
import { writeErrorLog } from "../../../lib/server/errorLogger";

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
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes
const secure = process.env.NODE_ENV === "production";

const LINK_STATE_PREFIX = "lk_";

const KAKAO_ERROR_MESSAGE = "카카오 로그인 처리에 실패했습니다.";
const KAKAO_STATE_ERROR_MESSAGE = "카카오 로그인 요청 검증에 실패했습니다.";
const KAKAO_TOKEN_ERROR_MESSAGE = "카카오 로그인 토큰 교환에 실패했습니다.";

const buildRedirectUri = (request: NextRequest) => {
  return (
    process.env.KAKAO_OIDC_REDIRECT_URI ??
    `${request.nextUrl.origin}/auth/callback`
  );
};

const setStateCookie = (response: NextResponse, states: string[]) => {
  if (states.length === 0) {
    response.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return;
  }

  response.cookies.set(STATE_COOKIE, serializeStateCookie(states), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
};

const buildLoginRedirect = (
  request: NextRequest,
  message: string,
  statesToKeep: string[] = []
) => {
  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("message", message);

  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Cache-Control", "no-store");
  setStateCookie(response, statesToKeep);
  return response;
};

const buildProfileRedirect = (
  request: NextRequest,
  message: string,
  statesToKeep: string[] = []
) => {
  const profileUrl = new URL("/profile", request.nextUrl.origin);
  profileUrl.searchParams.set("message", message);

  const response = NextResponse.redirect(profileUrl);
  response.headers.set("Cache-Control", "no-store");
  setStateCookie(response, statesToKeep);
  return response;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const rawStateCookie = request.cookies.get(STATE_COOKIE)?.value;
  const knownStates = parseStateCookie(rawStateCookie);
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");
  const isLinkIntent = Boolean(state && state.startsWith(LINK_STATE_PREFIX));

  const stateResult = state
    ? consumeState(rawStateCookie, state)
    : { matched: false, remainingStates: knownStates };

  if (!code || !state || !stateResult.matched) {
    await writeErrorLog({
      category: "auth",
      action: "kakao_callback",
      message: "카카오 callback state/code 검증 실패",
      errorCode: "state_mismatch",
      path: request.nextUrl.pathname,
      ip,
      userAgent,
      details: {
        hasCode: Boolean(code),
        hasState: Boolean(state),
        stateMatched: stateResult.matched,
        knownStateCount: knownStates.length,
      },
    });

    return buildLoginRedirect(
      request,
      KAKAO_STATE_ERROR_MESSAGE,
      stateResult.remainingStates
    );
  }

  const clientId = process.env.KAKAO_CLIENT_ID;
  if (!clientId) {
    await writeErrorLog({
      category: "auth",
      action: "kakao_callback",
      message: "카카오 callback 처리 실패: KAKAO_CLIENT_ID 누락",
      errorCode: "missing_client_id",
      path: request.nextUrl.pathname,
      ip,
      userAgent,
      details: { isLinkIntent },
    });

    if (isLinkIntent) {
      return buildProfileRedirect(
        request,
        "카카오 로그인 설정이 필요합니다.",
        stateResult.remainingStates
      );
    }

    return buildLoginRedirect(
      request,
      KAKAO_ERROR_MESSAGE,
      stateResult.remainingStates
    );
  }

  const redirectUri = buildRedirectUri(request);
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
    await writeErrorLog({
      category: "auth",
      action: "kakao_callback",
      message: "카카오 토큰 교환 실패",
      errorCode: tokenData.error ?? `http_${tokenResponse.status}`,
      path: request.nextUrl.pathname,
      ip,
      userAgent,
      details: {
        isLinkIntent,
        httpStatus: tokenResponse.status,
        kakaoError: tokenData.error ?? null,
        kakaoErrorDescription: tokenData.error_description ?? null,
      },
    });

    if (isLinkIntent) {
      return buildProfileRedirect(
        request,
        KAKAO_TOKEN_ERROR_MESSAGE,
        stateResult.remainingStates
      );
    }

    return buildLoginRedirect(
      request,
      KAKAO_TOKEN_ERROR_MESSAGE,
      stateResult.remainingStates
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

  const applyPendingCookies = (response: NextResponse) => {
    response.headers.set("Cache-Control", "no-store");
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    setStateCookie(response, stateResult.remainingStates);
    return response;
  };

  if (isLinkIntent) {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return applyPendingCookies(
        buildLoginRedirect(
          request,
          "카카오 연동은 로그인 후 진행해주세요.",
          stateResult.remainingStates
        )
      );
    }

    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "kakao",
      token: tokenData.id_token,
      access_token: tokenData.access_token,
    });

    if (linkError) {
      await writeErrorLog({
        category: "auth",
        action: "kakao_callback",
        message: "카카오 계정 연동 실패",
        errorCode: linkError.code ?? null,
        authUserId: currentUser.id,
        path: request.nextUrl.pathname,
        ip,
        userAgent,
        details: { message: linkError.message },
      });

      const lowerMessage = linkError.message.toLowerCase();
      const linkFailMessage =
        lowerMessage.includes("already")
          ? "이미 다른 계정에 연동된 카카오 계정입니다."
          : "카카오 계정 연동에 실패했습니다.";

      return applyPendingCookies(
        buildProfileRedirect(
          request,
          linkFailMessage,
          stateResult.remainingStates
        )
      );
    }

    return applyPendingCookies(
      buildProfileRedirect(
        request,
        "카카오 계정 연동이 완료되었습니다.",
        stateResult.remainingStates
      )
    );
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithIdToken({
    provider: "kakao",
    token: tokenData.id_token,
    access_token: tokenData.access_token,
  });

  if (signInError) {
    await writeErrorLog({
      category: "auth",
      action: "kakao_callback",
      message: "Supabase signInWithIdToken 실패",
      errorCode: signInError.code ?? null,
      path: request.nextUrl.pathname,
      ip,
      userAgent,
      details: { message: signInError.message },
    });

    return applyPendingCookies(
      buildLoginRedirect(request, KAKAO_ERROR_MESSAGE, stateResult.remainingStates)
    );
  }

  const signedInUserId = signInData.user?.id ?? null;
  if (signedInUserId) {
    const supabaseAdmin = createServiceRoleSupabaseClient();
    const { data: setting } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "approval_required")
      .maybeSingle<{ value: boolean }>();

    if (setting?.value === false) {
      await supabaseAdmin
        .from("profiles")
        .update({ is_approved: true, updated_at: new Date().toISOString() })
        .eq("id", signedInUserId)
        .eq("is_approved", false);
    }
  }

  const redirectResponse = NextResponse.redirect(new URL("/start", requestUrl.origin));
  return applyPendingCookies(redirectResponse);
}
