import { NextRequest, NextResponse } from "next/server";
import { createRequestSupabaseClient, createServiceRoleSupabaseClient, requireApiUser } from "@/lib/apiGuard";

// 캘린더 색상 팔레트 (달콧 8색)
const CALENDAR_COLORS = [
  "#4CAF50", "#2196F3", "#FF9800", "#9C27B0",
  "#E91E63", "#00BCD4", "#FF5722", "#607D8B",
];

/**
 * GET /api/jeju/reservations?year=2026&month=3
 * 월별 예약 목록 조회 (공개 필드만)
 */
export async function GET(request: NextRequest) {
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { supabase } = result;

  const { searchParams } = request.nextUrl;
  const year  = Number(searchParams.get("year")  ?? new Date().getFullYear());
  const month = Number(searchParams.get("month") ?? new Date().getMonth() + 1);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "잘못된 날짜 파라미터" }, { status: 400 });
  }

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to   = new Date(year, month, 0).toISOString().slice(0, 10); // 마지막 날

  const { data, error } = await supabase
    .from("dalkkot_reservations")
    .select("id, nickname, check_in, check_out, color, status, visit_status, user_id, guests, notes")
    .lte("check_in", to)
    .gte("check_out", from)
    .not("status", "in", '("rejected","cancelled")')
    .order("check_in");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * POST /api/jeju/reservations
 * 예약 신청
 */
export async function POST(request: NextRequest) {
  const result = await requireApiUser({ requireApproved: true });
  if ("error" in result) return result.error;
  const { user } = result;
  const supabase = await createRequestSupabaseClient();

  const body = await request.json();
  const { villa_id, check_in, check_out, real_name, phone, guests, notes, color: preferredColor } = body;

  // 입력 검증
  if (!villa_id || !check_in || !check_out || !real_name || !phone) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다." }, { status: 400 });
  }
  if (new Date(check_out) <= new Date(check_in)) {
    return NextResponse.json({ error: "퇴실일은 입실일 이후여야 합니다." }, { status: 400 });
  }

  // 닉네임 조회
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  if (!profile?.nickname) {
    return NextResponse.json({ error: "프로필 닉네임이 없습니다." }, { status: 400 });
  }

  // 해당 월에 이미 사용된 색상 조회 → 자동 배정
  const month = new Date(check_in).getMonth() + 1;
  const year  = new Date(check_in).getFullYear();
  const monthFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthTo   = new Date(year, month, 0).toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("dalkkot_reservations")
    .select("color")
    .lte("check_in", monthTo)
    .gte("check_out", monthFrom)
    .not("status", "in", '("rejected","cancelled")');

  const usedColors = (existing ?? []).map((r) => r.color);
  const autoColor = CALENDAR_COLORS.find((c) => !usedColors.includes(c)) ?? CALENDAR_COLORS[usedColors.length % CALENDAR_COLORS.length];
  // 유저가 지정한 색상이 팔레트에 있으면 우선 사용, 없으면 자동 배정
  const color = (preferredColor && CALENDAR_COLORS.includes(preferredColor)) ? preferredColor : autoColor;

  // Service Role로 삽입 (real_name, phone 등 민감 필드 포함)
  const adminSupabase = createServiceRoleSupabaseClient();
  const { data, error } = await adminSupabase
    .from("dalkkot_reservations")
    .insert({
      villa_id,
      user_id: user.id,
      nickname: profile.nickname,
      check_in,
      check_out,
      real_name,
      phone,
      guests: guests ?? 1,
      notes: notes ?? null,
      color,
      status: "pending",
    })
    .select("id, nickname, check_in, check_out, color, status")
    .single();

  if (error) {
    if (error.code === "23P01") {
      return NextResponse.json({ error: "해당 날짜는 이미 예약되어 있습니다." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
