import { redirect } from "next/navigation";
import { createRequestSupabaseClient } from "@/lib/apiGuard";
import RestaurantsClient from "./RestaurantsClient";

export const dynamic = "force-dynamic";

export default async function RestaurantsPage() {
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <RestaurantsClient
      currentUserId={user.id}
      isAdmin={profile?.is_dalkkot_admin === true}
    />
  );
}
