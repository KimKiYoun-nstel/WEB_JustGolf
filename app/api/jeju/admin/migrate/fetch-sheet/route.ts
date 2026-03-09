import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, createServiceRoleSupabaseClient } from "@/lib/apiGuard";

/**
 * POST /api/jeju/admin/migrate/fetch-sheet
 * 달콧 관리자 전용: 공개 구글 시트 URL → CSV 텍스트 반환
 * body: { url: string }
 *
 * SSRF 방지: Google Sheets URL만 허용
 */
export async function POST(request: NextRequest) {
  const authResult = await requireApiUser({ requireApproved: true });
  if ("error" in authResult) return authResult.error;
  const { user, supabase } = authResult;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_dalkkot_admin) {
    return NextResponse.json({ error: "달콧 관리자 권한 필요" }, { status: 403 });
  }

  const body = await request.json();
  const { url, gid } = body as { url?: string; gid?: string };

  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "url 필수" }, { status: 400 });
  }

  // SSRF 방지: Google Sheets URL만 허용
  const trimmedUrl = url.trim();
  if (!trimmedUrl.startsWith("https://docs.google.com/spreadsheets/")) {
    return NextResponse.json(
      { error: "Google Sheets URL(docs.google.com/spreadsheets)만 허용됩니다." },
      { status: 400 }
    );
  }

  // CSV export URL으로 변환
  const exportUrl = toExportUrl(trimmedUrl, gid);

  let csv: string;
  try {
    const resp = await fetch(exportUrl, { redirect: "follow" });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `시트를 가져오지 못했습니다 (${resp.status}). 시트가 '링크가 있는 모든 사용자' 공개 설정인지 확인하세요.` },
        { status: 400 }
      );
    }
    csv = await resp.text();
  } catch {
    return NextResponse.json(
      { error: "시트 요청 중 네트워크 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ csv });
}

/**
 * Google Sheets 편집/공유 URL → CSV export URL 변환
 * 예) https://docs.google.com/spreadsheets/d/ID/edit?gid=GID#gid=GID
 *  → https://docs.google.com/spreadsheets/d/ID/export?format=csv&gid=GID
 */
function toExportUrl(url: string, overrideGid?: string): string {
  const idMatch = url.match(/\/spreadsheets\/d\/([^/?#]+)/);
  if (!idMatch) return url;
  const id = idMatch[1];

  // gid는 URL 파라미터 또는 해시에서 추출, 없으면 첫 번째 시트(0)
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = overrideGid ?? (gidMatch ? gidMatch[1] : "0");

  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}
