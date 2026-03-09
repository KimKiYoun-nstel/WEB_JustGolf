import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // 관리자 검증은 app/jeju/admin/layout.tsx에서 처리됨
  return <AdminClient />;
}
