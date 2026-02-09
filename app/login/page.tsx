"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    const redirectTo = searchParams.get("redirectTo");
    const rawTarget =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("/login")
        ? redirectTo
        : "";

    const redirectForUser = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      const target = rawTarget || (profile?.is_admin ? "/admin" : "/");
      router.replace(target);
    };

    redirectForUser();
  }, [authLoading, user?.id, router, searchParams]);

  const signUp = async () => {
    setMsg("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname },
      },
    });
    setLoading(false);
    if (error) setMsg(`회원가입 실패: ${error.message}`);
    else setMsg("회원가입 요청 완료! (메일 인증이 켜져 있으면 이메일 확인 필요)");
  };

  const signIn = async () => {
    setMsg("");
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setLoading(false);
      setMsg(`로그인 실패: ${error.message}`);
      return;
    }

    // 로그인 성공 후 이전 페이지 또는 관리자 여부에 따라 리다이렉트
    const redirectTo = searchParams.get("redirectTo");
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user?.id)
      .single();

    setLoading(false);
    
    const rawTarget = redirectTo && redirectTo.startsWith("/") ? redirectTo : "";
    const target = rawTarget || (profile?.is_admin ? "/admin" : "/");

    setMsg("로그인 성공! 이동 중...");
    router.replace(target);
    setTimeout(() => window.location.assign(target), 1200);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMsg("로그아웃 완료");
  };

  return (
    <main className="min-h-screen bg-slate-50/70 px-6 py-12">
      <Card className="mx-auto w-full max-w-md border-slate-200/70 shadow-lg shadow-slate-200/40">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">로그인 / 회원가입</CardTitle>
          <p className="text-sm text-slate-500">
            이메일 인증을 끈 상태라면 바로 로그인됩니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">이메일</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">비밀번호</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">닉네임(회원가입 시)</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
              disabled={loading}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={signIn} disabled={loading}>
              {loading ? "처리 중..." : "로그인"}
            </Button>
            <Button onClick={signUp} variant="secondary" disabled={loading}>
              {loading ? "처리 중..." : "회원가입"}
            </Button>
            <Button onClick={signOut} variant="outline" disabled={loading}>
              로그아웃
            </Button>
          </div>

          {msg && (
            <p
              className={`text-sm ${
                msg.includes("실패") ? "text-red-600" : "text-green-600"
              }`}
            >
              {msg}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50/70 px-6 py-12">
        <Card className="mx-auto w-full max-w-md border-slate-200/70 shadow-lg shadow-slate-200/40">
          <CardContent className="py-10">
            <p className="text-sm text-slate-500">로딩중...</p>
          </CardContent>
        </Card>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
