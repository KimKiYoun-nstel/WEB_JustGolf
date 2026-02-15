"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "../../../../components/ui/table";
import { useToast } from "../../../../components/ui/toast";

type ProfileDetail = {
  id: string;
  nickname: string | null;
  email: string | null;
  full_name: string | null;
  is_admin: boolean;
  is_approved: boolean;
  created_at: string | null;
  updated_at: string | null;
  phone?: string | null;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = useMemo(() => {
    const id = params?.id;
    return Array.isArray(id) ? id[0] : id;
  }, [params]);
  const [detail, setDetail] = useState<ProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const loadDetail = async () => {
      setLoading(true);
      setMsg("");

      const response = await fetch(`/api/admin/users/${userId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMsg(data?.error ?? response.statusText);
        setDetail(null);
        setLoading(false);
        return;
      }

      setDetail(data as ProfileDetail);
      setLoading(false);
    };

    loadDetail();
  }, [userId]);

  useEffect(() => {
    if (!msg) return;

    toast({ variant: "error", title: msg });
    setMsg("");
  }, [msg, toast]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩 중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-6 text-red-700">
              <p>회원 정보를 불러오지 못했습니다.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin/users">회원 관리로 돌아가기</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const rows = [
    { label: "이메일", value: detail.email ?? "-" },
    { label: "닉네임", value: detail.nickname ?? "-" },
    { label: "이름", value: detail.full_name ?? "-" },
    { label: "전화번호", value: detail.phone ?? "-" },
    { label: "권한", value: detail.is_admin ? "관리자" : "일반" },
    { label: "승인 상태", value: detail.is_approved ? "승인됨" : "승인 대기" },
    {
      label: "가입일",
      value: detail.created_at
        ? new Date(detail.created_at).toLocaleString("ko-KR")
        : "-",
    },
    {
      label: "최근 수정",
      value: detail.updated_at
        ? new Date(detail.updated_at).toLocaleString("ko-KR")
        : "-",
    },
    { label: "사용자 ID", value: detail.id },
  ];

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-10">
        <Card className="border-slate-200/70">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>회원 정보 상세</CardTitle>
              <p className="text-sm text-slate-500">
                기본 정보 및 계정 상태를 확인합니다.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/users">회원 관리로 돌아가기</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="w-40 font-medium text-slate-700">
                      {row.label}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {row.value}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
