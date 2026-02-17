"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import { createClient } from "../../lib/supabaseClient";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";

type AdminProfile = {
  is_admin: boolean;
  nickname: string | null;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }

    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin,nickname")
        .eq("id", user.id)
        .single();

      if (error) {
        setError(error.message);
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      const profile = data as AdminProfile;
      setNickname(profile.nickname ?? "");
      setIsAdmin(Boolean(profile.is_admin));
      setChecking(false);
    })();
  }, [loading, user?.id]);

  useEffect(() => {
    if (!error) return;

    toast({
      variant: "error",
      title: "관리자 권한 확인 실패",
      description: error,
      duration: 1800,
    });
    setError("");
  }, [error, toast]);

  if (loading || checking) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-4 md:px-6 lg:px-8 py-10">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-500">관리자 권한 확인 중...</p>
        </Card>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-4 md:px-6 lg:px-8 py-10">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-600">
            관리자 페이지는 로그인 후 이용 가능해요.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/login">로그인으로 이동</Link>
          </Button>
        </Card>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-4 md:px-6 lg:px-8 py-10">
        <Card className="mx-auto max-w-3xl border-slate-200/70 p-6">
          <p className="text-sm text-slate-600">관리자 권한이 없습니다.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/start">홈으로 이동</Link>
          </Button>
        </Card>
      </main>
    );
  }

  // 간소화된 AdminLayout: 권한 체크만 수행, 레이아웃은 children에게 위임
  return (
    <div className="min-h-screen bg-slate-50/70">
      {children}
    </div>
  );
}
