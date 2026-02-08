"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState<string>("");

  const signUp = async () => {
    setMsg("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname }, // schema.sql의 handle_new_user 트리거가 profiles에 넣어줌
      },
    });
    if (error) setMsg(`회원가입 실패: ${error.message}`);
    else setMsg("회원가입 요청 완료! (메일 인증이 켜져 있으면 이메일 확인 필요)");
  };

  const signIn = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(`로그인 실패: ${error.message}`);
    else setMsg("로그인 성공!");
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
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">비밀번호</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">닉네임(회원가입 시)</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={signIn}>로그인</Button>
            <Button onClick={signUp} variant="secondary">
              회원가입
            </Button>
            <Button onClick={signOut} variant="outline">
              로그아웃
            </Button>
          </div>

          {msg && <p className="text-sm text-slate-600">{msg}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
