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

  // 미승인 사용자는 로그인으로 리다이렉트 (승인 대기 상태)
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_approved")
    .eq("id", user.id)
    .single();

  if (profile?.is_approved === false) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("msg", "unapproved");
    return new Response(null, {
      status: 307,
      headers: {
        Location: loginUrl.toString(),
      },
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
