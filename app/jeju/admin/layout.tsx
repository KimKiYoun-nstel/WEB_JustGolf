import { redirect } from "next/navigation";
import { createRequestSupabaseClient } from "@/lib/apiGuard";
import AdminSubNav from "./_components/AdminSubNav";

export default async function DalkkotAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/jeju/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_dalkkot_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_dalkkot_admin) {
    redirect("/jeju");
  }

  return (
    <>
      <AdminSubNav />
      {children}
    </>
  );
}
