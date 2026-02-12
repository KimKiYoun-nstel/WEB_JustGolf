import { type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, supabase } = await updateSession(request);

  // 로그인 페이지는 항상 접근 가능
  if (request.nextUrl.pathname === "/login") {
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
    return new Response(null, {
      status: 307,
      headers: {
        Location: loginUrl.toString(),
      },
    });
  }

  // /start 등 보호된 페이지 접근 시 승인 상태 확인 (RPC 함수 사용)
  if (request.nextUrl.pathname.startsWith("/start") || 
      request.nextUrl.pathname.startsWith("/admin") ||
      request.nextUrl.pathname.startsWith("/tournaments")) {
    const { data: isApproved, error } = await supabase.rpc("is_approved_user", { uid: user.id });

    if (error || !isApproved) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("message", "관리자 승인 대기 중입니다.");
      return new Response(null, {
        status: 307,
        headers: {
          Location: loginUrl.toString(),
        },
      });
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
