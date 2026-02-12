"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [originalNickname, setOriginalNickname] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authProvider, setAuthProvider] = useState("email");
  const [msg, setMsg] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const loadProfile = async () => {
    if (!user) return;

    // 이메일은 auth에서 가져옴
    setEmail(user.email ?? "");
    setAuthProvider(user.app_metadata?.provider ?? "email");

    // 닉네임은 profiles 테이블에서 가져옴
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .single();

    if (error) {
      setMsg(`프로필 조회 실패: ${error.message}`);
    } else if (data) {
      setNickname(data.nickname ?? "");
      setOriginalNickname(data.nickname ?? "");
    }

    setIsLoadingData(false);
  };

  const updateNickname = async () => {
    setMsg("");

    if (!user) {
      setMsg("로그인이 필요합니다");
      return;
    }

    const nick = nickname.trim();
    if (!nick) {
      setMsg("닉네임을 입력해주세요");
      return;
    }

    if (nick === originalNickname) {
      setMsg("현재 닉네임과 동일합니다.");
      return;
    }

    const supabase = createClient();
    const { data: available, error: checkError } = await supabase.rpc(
      "is_nickname_available",
      { p_nickname: nick, p_user_id: user.id }
    );

    if (checkError) {
      setMsg(`닉네임 중복 확인 실패: ${checkError.message}`);
      return;
    }

    if (!available) {
      setMsg("이미 사용 중인 닉네임입니다.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ nickname: nick })
      .eq("id", user.id);

    if (error) {
      setMsg(`닉네임 변경 실패: ${error.message}`);
    } else {
      setMsg("닉네임이 변경되었습니다");
      setOriginalNickname(nick);
    }
  };

  const updatePassword = async () => {
    setMsg("");

    if (!user) {
      setMsg("로그인이 필요합니다");
      return;
    }

    if (!newPassword.trim()) {
      setMsg("새 비밀번호를 입력해주세요");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMsg("비밀번호가 일치하지 않습니다");
      return;
    }

    if (newPassword.length < 6) {
      setMsg("비밀번호는 최소 6자 이상이어야 합니다");
      return;
    }

    // Supabase Auth로 비밀번호 변경
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMsg(`비밀번호 변경 실패: ${error.message}`);
    } else {
      setMsg("비밀번호가 변경되었습니다");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  if (loading || isLoadingData) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!user) {
    return null; // 리다이렉트 중...
  }

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
        {/* 헤더 */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">
            내 프로필
          </h1>
          <p className="text-sm text-slate-500">
            {authProvider === "kakao"
              ? "카카오 계정으로 로그인 중입니다. 닉네임을 관리할 수 있습니다."
              : "이메일 계정으로 로그인 중입니다. 닉네임과 비밀번호를 변경할 수 있습니다."}
          </p>
        </div>

        {/* 메시지 */}
        {msg && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        {/* 이메일 (읽기 전용) */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>이메일</CardTitle>
            <CardDescription>변경할 수 없습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input value={email} disabled />
          </CardContent>
        </Card>

        {/* 닉네임 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>닉네임</CardTitle>
            <CardDescription>
              대회 참가 시 표시되는 이름입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
            />
            <Button onClick={updateNickname}>닉네임 변경</Button>
          </CardContent>
        </Card>

        {authProvider === "email" ? (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>비밀번호 변경</CardTitle>
              <CardDescription>
                새 비밀번호는 최소 6자 이상이어야 합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">새 비밀번호</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">비밀번호 확인</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 확인"
                />
              </div>

              <Button onClick={updatePassword}>비밀번호 변경</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>비밀번호 변경</CardTitle>
              <CardDescription>
                카카오 로그인 사용자는 카카오 계정에서 비밀번호를 관리합니다.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* 돌아가기 */}
        <div className="flex gap-2">
          <Button
            onClick={() => router.back()}
            variant="outline"
          >
            돌아가기
          </Button>
          <Button onClick={() => router.push("/")} variant="secondary">
            홈으로
          </Button>
        </div>
      </div>
    </main>
  );
}
