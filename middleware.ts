import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, supabase } = await updateSession(request);
  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url, 307);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  };

  // 로그인/인증 보조 페이지는 항상 접근 가능
  if (
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname.startsWith("/auth")
  ) {
    return response;
  }

  // 세션 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 비로그인 사용자는 로그인으로 리다이렉트
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return redirectWithCookies(loginUrl);
  }

  // 승인 해제된 사용자는 자동승인 ON/OFF와 무관하게 온보딩을 다시 거치도록 강제
  // (관리자 승인 해제 시 신규 가입 후 최초 로그인과 동일한 흐름 적용)
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved,is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.is_admin === true;

  if (!isAdmin && profile?.is_approved === false) {
    const onboardingUrl = new URL("/auth/onboarding", request.url);
    return redirectWithCookies(onboardingUrl);
  }

  const onboardingCompleted = user.user_metadata?.onboarding_completed === true;
  if (!onboardingCompleted) {
    const onboardingUrl = new URL("/auth/onboarding", request.url);
    return redirectWithCookies(onboardingUrl);
  }

  // /start 등 보호된 페이지 접근 시 승인 상태 확인 (RPC 함수 사용)
  if (!isAdmin && (request.nextUrl.pathname.startsWith("/start") || 
      request.nextUrl.pathname.startsWith("/admin") ||
      request.nextUrl.pathname.startsWith("/tournaments"))) {
    const { data: isApproved, error } = await supabase.rpc("is_approved_user", { uid: user.id });

    if (error || !isApproved) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("message", "관리자 승인 대기 중입니다.");
      return redirectWithCookies(loginUrl);
    }
  }

  // 로그인된 사용자는 모두 접근 가능
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|api(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
