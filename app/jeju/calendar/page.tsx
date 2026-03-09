import { redirect } from "next/navigation";
import { createRequestSupabaseClient } from "@/lib/apiGuard";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 활성 빌라 ID 조회 (캘린더 예약 신청에 필요)
  const { data: villa } = await supabase
    .from("dalkkot_villas")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  const villaId = villa?.id ?? "";

  return <CalendarClient currentUserId={user.id} villaId={villaId} />;
}
