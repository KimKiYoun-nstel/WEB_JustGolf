import { createRequestSupabaseClient } from "@/lib/apiGuard";
import DashboardClient from "./_components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function JejuPage() {
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 이번 달 예약 통계 (서버에서 초기값 계산)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const { data: thisMonthReservations } = await supabase
    .from("dalkkot_reservations")
    .select("id, status, guests")
    .gte("check_in", firstDay)
    .lte("check_in", lastDay)
    .not("status", "in", '("rejected","cancelled")');

  // villa_id 가져오기 (첫 번째 별장)
  const { data: villas } = await supabase.from("dalkkot_villas").select("id").limit(1);
  const villaId = villas?.[0]?.id ?? "";

  const total = thisMonthReservations?.length ?? 0;
  const confirmed = thisMonthReservations?.filter((r) => r.status === "confirmed").length ?? 0;
  const pending = thisMonthReservations?.filter((r) => ["pending", "waiting_deposit"].includes(r.status)).length ?? 0;
  const guests = thisMonthReservations?.reduce((s, r) => s + (r.guests ?? 0), 0) ?? 0;

  return (
    <DashboardClient
      stats={{ total, confirmed, pending, guests }}
      villaId={villaId}
      currentUserId={user?.id ?? ""}
    />
  );
}
