"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabaseClient";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../components/ui/toast";

const APPROVAL_WAITING_MESSAGE = "관리자 승인 대기 중입니다.";

type ProfileShape = {
  id: string;
  nickname: string | null;
  full_name: string | null;
  email: string | null;
  is_approved: boolean | null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [canEditEmail, setCanEditEmail] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const navigateWithFallback = (target: string) => {
    router.replace(target);
    router.refresh();

    window.setTimeout(() => {
      window.location.replace(target);
    }, 350);
  };

  useEffect(() => {
    const loadOnboardingData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCanEditEmail(!user.email);
      setPhone((user.user_metadata?.phone as string | undefined) ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, nickname, full_name, email, is_approved")
        .eq("id", user.id)
        .maybeSingle<ProfileShape>();

      const profileEmail = profile?.email ?? "";
      const authEmail = user.email ?? "";
      setEmail(profileEmail || authEmail);

      const metadataNickname =
        (user.user_metadata?.nickname as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        "";

      if (profile) {
        if (profile.nickname && !profile.nickname.startsWith("user-")) {
          setNickname(profile.nickname);
        } else {
          setNickname(metadataNickname);
        }
        setFullName(profile.full_name ?? "");
      } else {
        setNickname(metadataNickname);
        setFullName((user.user_metadata?.full_name as string | undefined) ?? "");
      }

      setLoading(false);
    };

    void loadOnboardingData();
  }, [router, supabase]);

  useEffect(() => {
    if (!msg) return;

    const isSuccess = /완료|성공/.test(msg);
    const isError = /실패|오류|필요|없습니다|중복/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const completeOnboarding = async () => {
    setMsg("");

    const nextNickname = nickname.trim();
    const nextFullName = fullName.trim();
    const nextPhone = phone.trim();
    const nextEmail = email.trim();
    const normalizedEmail = nextEmail.toLowerCase();

    if (!nextNickname) {
      setMsg("닉네임은 필수입니다.");
      return;
    }

    if (!nextEmail) {
      setMsg("이메일을 입력해주세요.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setMsg("이메일 형식을 확인해주세요.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMsg("로그인 세션을 확인할 수 없습니다. 다시 로그인해주세요.");
        setSaving(false);
        return;
      }

      const emailAvailabilityResponse = await fetch(
        "/api/auth/check-email-availability",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        }
      );

      const emailAvailabilityPayload = await emailAvailabilityResponse
        .json()
        .catch(() => null);

      if (!emailAvailabilityResponse.ok) {
        const errorMessage =
          emailAvailabilityPayload?.error ??
          "이메일 중복 확인 중 오류가 발생했습니다.";
        setMsg(errorMessage);
        setSaving(false);
        return;
      }

      if (!emailAvailabilityPayload?.available) {
        const authEmailInUse = Boolean(emailAvailabilityPayload?.authEmailInUse);
        const profileEmailInUse = Boolean(
          emailAvailabilityPayload?.profileEmailInUse
        );

        if (authEmailInUse) {
          setMsg(
            "이미 이메일 로그인에 사용 중인 이메일입니다. 기존 계정으로 로그인 후 프로필에서 카카오 계정 연동을 진행해주세요."
          );
        } else if (profileEmailInUse) {
          setMsg(
            "이미 다른 계정의 온보딩 이메일로 등록된 주소입니다. 같은 사용자라면 기존 계정으로 로그인해주세요."
          );
        } else {
          setMsg("이미 사용 중인 이메일입니다.");
        }
        setSaving(false);
        return;
      }

      const { data: available, error: checkError } = await supabase.rpc(
        "is_nickname_available",
        { p_nickname: nextNickname, p_user_id: user.id }
      );

      if (checkError) {
        setMsg(`닉네임 중복 확인 실패: ${checkError.message}`);
        setSaving(false);
        return;
      }

      if (!available) {
        setMsg(
          "이미 사용 중인 닉네임입니다. 이메일이 달라도 닉네임은 중복 사용할 수 없습니다."
        );
        setSaving(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .update({
          nickname: nextNickname,
          full_name: nextFullName || null,
          email: normalizedEmail,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("id, is_approved")
        .maybeSingle<{ id: string; is_approved: boolean | null }>();

      if (profileError) {
        setMsg(`프로필 업데이트 실패: ${profileError.message}`);
        setSaving(false);
        return;
      }

      const currentMetadata = user.user_metadata ?? {};
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          phone: nextPhone || null,
          contact_email: normalizedEmail,
          onboarding_completed: true,
        },
      });

      if (metadataError) {
        setMsg(`온보딩 저장 실패: ${metadataError.message}`);
        setSaving(false);
        return;
      }

      let approvalRequired = true;
      const { data: approvalSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "approval_required")
        .maybeSingle<{ value: boolean }>();

      if (typeof approvalSetting?.value === "boolean") {
        approvalRequired = approvalSetting.value;
      }

      if (!approvalRequired && !profile?.is_approved) {
        const { error: autoApproveError } = await supabase
          .from("profiles")
          .update({ is_approved: true, updated_at: new Date().toISOString() })
          .eq("id", user.id);

        if (autoApproveError) {
          setMsg(`자동 승인 처리 실패: ${autoApproveError.message}`);
          setSaving(false);
          return;
        }
      }

      if (approvalRequired && !profile?.is_approved) {
        navigateWithFallback(
          `/login?message=${encodeURIComponent(APPROVAL_WAITING_MESSAGE)}`
        );
        return;
      }

      navigateWithFallback("/start");
    } catch (error) {
      setMsg(
        `온보딩 처리 중 오류가 발생했습니다: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70 px-6 py-12">
        <Card className="mx-auto w-full max-w-md border-slate-200/70">
          <CardContent className="py-10">
            <p className="text-sm text-slate-500">로딩 중...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70 px-6 py-12">
      <Card className="mx-auto w-full max-w-md border-slate-200/70 shadow-lg shadow-slate-200/40">
        <CardHeader>
          <CardTitle>온보딩</CardTitle>
          <CardDescription>
            최초 로그인 설정입니다. 닉네임/이메일은 필수이며 이름/전화번호는
            선택입니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              이메일 {canEditEmail ? "*" : ""}
            </label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              disabled={!canEditEmail || saving}
            />
            {canEditEmail && (
              <p className="text-xs text-slate-500">
                카카오에서 이메일을 제공하지 않아 직접 입력이 필요합니다. 기존
                계정과 연결하려면 기존 계정의 이메일을 입력하지 말고, 기존 계정으로
                로그인 후 프로필의 카카오 연동을 이용하세요.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">닉네임 *</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">이름 (선택)</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="이름을 입력하세요"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">전화번호 (선택)</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              disabled={saving}
            />
          </div>

          <Button onClick={completeOnboarding} disabled={saving} className="w-full">
            {saving ? "처리 중..." : "저장하고 시작하기"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
