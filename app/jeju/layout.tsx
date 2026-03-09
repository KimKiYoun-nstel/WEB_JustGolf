import type { Metadata } from "next";
import "./dalkkot.css";
import DalkkotHeader from "./_components/DalkkotHeader";
import { createRequestSupabaseClient } from "@/lib/apiGuard";

export const metadata: Metadata = {
  title: "달콧 별장 예약",
  description: "제주 달콧 별장 예약 관리 시스템",
};

export default async function JejuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 달콧 관리자 여부 확인 (헤더 관리 탭 표시용)
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isDalkkotAdmin = false;
  let userNickname: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_dalkkot_admin, nickname")
      .eq("id", user.id)
      .maybeSingle();
    isDalkkotAdmin = profile?.is_dalkkot_admin === true;
    userNickname = profile?.nickname ?? null;
  }

  return (
    <div className="dalkkot-body min-h-screen">
      <DalkkotHeader isDalkkotAdmin={isDalkkotAdmin} userNickname={userNickname} />
      <main className="mx-auto max-w-[1400px] px-6 pb-20 sm:pb-10">
        {children}
      </main>
    </div>
  );
}
