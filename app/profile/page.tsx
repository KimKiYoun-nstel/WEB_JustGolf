"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useToast } from "../../components/ui/toast";

function ProfileContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [nickname, setNickname] = useState("");
  const [originalNickname, setOriginalNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [originalFullName, setOriginalFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authProvider, setAuthProvider] = useState("email");
  const [hasKakaoLinked, setHasKakaoLinked] = useState(false);
  const [msg, setMsg] = useState("");
  const { toast } = useToast();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isLinkingKakao, setIsLinkingKakao] = useState(false);

  useEffect(() => {
    const queryMessage = searchParams.get("message");
    if (queryMessage) {
      setMsg(queryMessage);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!msg) return;

    const isSuccess = /저장되었습니다|변경되었습니다|완료되었습니다/.test(msg);
    const isError = /실패|필요|입력|일치하지|없습니다|중복/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const loadProfile = async () => {
    if (!user) return;

    setEmail(user.email ?? "");
    const provider = user.app_metadata?.provider ?? "email";
    setAuthProvider(provider);

    const linkedKakao =
      provider === "kakao" ||
      (user.identities ?? []).some((identity) => identity.provider === "kakao");
    setHasKakaoLinked(linkedKakao);

    const metadataPhone = (user.user_metadata?.phone as string | undefined) ?? "";
    setPhone(metadataPhone);
    setOriginalPhone(metadataPhone);

    const { data, error } = await supabase
      .from("profiles")
      .select("nickname, full_name")
      .eq("id", user.id)
      .single();

    if (error) {
      setMsg(`프로필 조회 실패: ${error.message}`);
    } else if (data) {
      const nextNickname = data.nickname ?? "";
      const nextFullName = data.full_name ?? "";
      setNickname(nextNickname);
      setOriginalNickname(nextNickname);
      setFullName(nextFullName);
      setOriginalFullName(nextFullName);
    }

    setIsLoadingData(false);
  };

  const updateProfileInfo = async () => {
    setMsg("");

    if (!user) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    const nextFullName = fullName.trim();
    const nextPhone = phone.trim();

    if (nextFullName === originalFullName && nextPhone === originalPhone) {
      setMsg("변경된 내용이 없습니다.");
      return;
    }

    setIsSavingProfile(true);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: nextFullName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      setMsg(`프로필 정보 저장 실패: ${profileError.message}`);
      setIsSavingProfile(false);
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        full_name: nextFullName || null,
        phone: nextPhone || null,
      },
    });

    if (metadataError) {
      setMsg(`사용자 메타데이터 저장 실패: ${metadataError.message}`);
      setIsSavingProfile(false);
      return;
    }

    setOriginalFullName(nextFullName);
    setOriginalPhone(nextPhone);
    setMsg("이름과 전화번호가 저장되었습니다.");
    setIsSavingProfile(false);
  };

  const updateNickname = async () => {
    setMsg("");

    if (!user) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    const nick = nickname.trim();
    if (!nick) {
      setMsg("닉네임을 입력해주세요.");
      return;
    }

    if (nick === originalNickname) {
      setMsg("현재 닉네임과 동일합니다.");
      return;
    }

    setIsSavingNickname(true);

    const { data: available, error: checkError } = await supabase.rpc(
      "is_nickname_available",
      { p_nickname: nick, p_user_id: user.id }
    );

    if (checkError) {
      setMsg(`닉네임 중복 확인 실패: ${checkError.message}`);
      setIsSavingNickname(false);
      return;
    }

    if (!available) {
      setMsg("이미 사용 중인 닉네임입니다.");
      setIsSavingNickname(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ nickname: nick, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      setMsg(`닉네임 변경 실패: ${error.message}`);
      setIsSavingNickname(false);
      return;
    }

    setOriginalNickname(nick);
    setMsg("닉네임이 변경되었습니다.");
    setIsSavingNickname(false);
  };

  const updatePassword = async () => {
    setMsg("");

    if (!user) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    if (!newPassword.trim()) {
      setMsg("새 비밀번호를 입력해주세요.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMsg("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 6) {
      setMsg("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setIsSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMsg(`비밀번호 변경 실패: ${error.message}`);
      setIsSavingPassword(false);
      return;
    }

    setMsg("비밀번호가 변경되었습니다.");
    setNewPassword("");
    setConfirmPassword("");
    setIsSavingPassword(false);
  };

  const startKakaoLink = () => {
    if (hasKakaoLinked) {
      setMsg("이미 카카오 계정이 연동되어 있습니다.");
      return;
    }

    setIsLinkingKakao(true);
    window.location.href = "/api/auth/kakao/link-start";
  };

  if (loading || isLoadingData) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩 중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">내 프로필</h1>
          <p className="text-sm text-slate-500">
            {authProvider === "kakao"
              ? "카카오 계정으로 로그인 중입니다. 프로필 정보를 수정할 수 있습니다."
              : "이메일 계정으로 로그인 중입니다. 프로필 정보를 수정할 수 있습니다."}
          </p>
        </div>

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>이메일</CardTitle>
            <CardDescription>
              로그인 계정 이메일은 이 화면에서 변경할 수 없습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input value={email || "카카오에서 제공하지 않음"} disabled />
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
            <CardDescription>이름과 전화번호를 수정할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">이름</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="이름을 입력하세요"
                disabled={isSavingProfile}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">전화번호</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                disabled={isSavingProfile}
              />
            </div>
            <Button onClick={updateProfileInfo} disabled={isSavingProfile}>
              {isSavingProfile ? "저장 중..." : "기본 정보 저장"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>닉네임</CardTitle>
            <CardDescription>서비스에 표시되는 이름입니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              disabled={isSavingNickname}
            />
            <Button onClick={updateNickname} disabled={isSavingNickname}>
              {isSavingNickname ? "변경 중..." : "닉네임 변경"}
            </Button>
          </CardContent>
        </Card>

        {authProvider === "email" && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>카카오 계정 연동</CardTitle>
              <CardDescription>
                동일 계정으로 카카오 로그인을 사용하려면 연동을 진행하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                연동 상태: {hasKakaoLinked ? "연동됨" : "미연동"}
              </p>
              <Button
                onClick={startKakaoLink}
                disabled={isLinkingKakao || hasKakaoLinked}
                className="bg-yellow-400 text-slate-900 hover:bg-yellow-300"
              >
                {hasKakaoLinked
                  ? "카카오 계정 연동 완료"
                  : isLinkingKakao
                    ? "카카오로 이동 중..."
                    : "카카오 계정 연동하기"}
              </Button>
            </CardContent>
          </Card>
        )}

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
                  disabled={isSavingPassword}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">비밀번호 확인</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 확인"
                  disabled={isSavingPassword}
                />
              </div>

              <Button onClick={updatePassword} disabled={isSavingPassword}>
                {isSavingPassword ? "변경 중..." : "비밀번호 변경"}
              </Button>
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

        <div className="flex gap-2">
          <Button onClick={() => router.back()} variant="outline">
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

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50/70">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
            <Card>
              <CardContent className="py-10">
                <p className="text-sm text-slate-500">로딩 중...</p>
              </CardContent>
            </Card>
          </div>
        </main>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
