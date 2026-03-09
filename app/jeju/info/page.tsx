import { createRequestSupabaseClient } from "@/lib/apiGuard";
import VillaInfoClient from "./VillaInfoClient";

export const dynamic = "force-dynamic";

export default async function InfoPage() {
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: villa } = await supabase
    .from("dalkkot_villas")
    .select("id, intro_md, rules_md, faq_md")
    .eq("is_active", true)
    .maybeSingle();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_dalkkot_admin")
      .eq("id", user.id)
      .maybeSingle();
    isAdmin = profile?.is_dalkkot_admin === true;
  }

  if (!villa) {
    return (
      <div className="py-12 text-center text-sm text-dalkkot-wood-mid">
        빌라 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <VillaInfoClient
      villa={villa}
      isAdmin={isAdmin}
    />
  );
}
