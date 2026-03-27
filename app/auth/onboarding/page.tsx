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

function isPlaceholderNickname(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized.startsWith("user-") || normalized.startsWith("pending-");
}

function isPhoneColumnUnavailable(message: string | undefined) {
  const normalized = (message ?? "").toLowerCase();

  if (/column .*phone|phone.*does not exist/i.test(normalized)) {
    return true;
  }

  return (
    normalized.includes("could not find") &&
    normalized.includes("phone") &&
    normalized.includes("schema cache")
  );
}

type ProfileShape = {
  id: string;
  nickname: string | null;
  full_name: string | null;
  phone?: string | null;
  email: string | null;
  is_approved: boolean | null;
};

type ProfileWithoutPhoneShape = Omit<ProfileShape, "phone">;

type ValidatedOnboardingInput = {
  nickname: string;
  fullName: string;
  phone: string;
  normalizedEmail: string;
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
  const [isNicknameGuideOpen, setIsNicknameGuideOpen] = useState(false);
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
      const metadataPhone = (user.user_metadata?.phone as string | undefined) ?? "";
      setPhone(metadataPhone);

      const profileWithPhoneQuery = await supabase
        .from("profiles")
        .select("id, nickname, full_name, phone, email, is_approved")
        .eq("id", user.id)
        .maybeSingle<ProfileShape>();
      let profile = profileWithPhoneQuery.data;

      if (
        profileWithPhoneQuery.error &&
        isPhoneColumnUnavailable(profileWithPhoneQuery.error.message)
      ) {
        const fallbackProfileQuery = await supabase
          .from("profiles")
          .select("id, nickname, full_name, email, is_approved")
          .eq("id", user.id)
          .maybeSingle<ProfileWithoutPhoneShape>();

        profile = fallbackProfileQuery.data
          ? { ...fallbackProfileQuery.data, phone: null }
          : null;
      }

      const profileEmail = profile?.email ?? "";
      const authEmail = user.email ?? "";
      setEmail(profileEmail || authEmail);

      const metadataNickname =
        (user.user_metadata?.nickname as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        "";

      if (profile) {
        if (profile.nickname && !isPlaceholderNickname(profile.nickname)) {
          setNickname(profile.nickname);
        } else {
          setNickname(metadataNickname);
        }
        setFullName(profile.full_name ?? "");
        setPhone((profile.phone ?? metadataPhone).trim());
      } else {
        setNickname(metadataNickname);
        setFullName((user.user_metadata?.full_name as string | undefined) ?? "");
        setPhone(metadataPhone);
      }

      setLoading(false);
    };

    void loadOnboardingData();
  }, [router, supabase]);

  useEffect(() => {
    if (!msg) return;

    const isSuccess = /완료|성공/.test(msg);
    const isError = /실패|오류|필수|없습니다|중복/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const getValidatedOnboardingInput = (): ValidatedOnboardingInput | null => {
    setMsg("");

    const nextNickname = nickname.trim();
    const nextFullName = fullName.trim();
    const nextPhone = phone.trim();
    const nextEmail = email.trim();
    const normalizedEmail = nextEmail.toLowerCase();

    if (!nextNickname) {
      setMsg("닉네임은 필수입니다.");
      return null;
    }

    if (isPlaceholderNickname(nextNickname)) {
      setMsg("닉네임은 user-/pending- 로 시작할 수 없습니다.");
      return null;
    }

    if (!nextEmail) {
      setMsg("이메일을 입력해주세요.");
      return null;
    }

    if (!nextFullName) {
      setMsg("이름은 필수입니다.");
      return null;
    }

    if (!nextPhone) {
      setMsg("전화번호는 필수입니다.");
      return null;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setMsg("이메일 형식을 확인해주세요.");
      return null;
    }

    return {
      nickname: nextNickname,
      fullName: nextFullName,
      phone: nextPhone,
      normalizedEmail,
    };
  };

  const submitOnboarding = async ({
    nickname: nextNickname,
    fullName: nextFullName,
    phone: nextPhone,
    normalizedEmail,
  }: ValidatedOnboardingInput) => {
    setMsg("");
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
            "이미 이메일 로그인에 사용 중인 이메일입니다. 기존 계정으로 로그인한 뒤 프로필에서 카카오 계정 연결을 진행해주세요."
          );
        } else if (profileEmailInUse) {
          setMsg(
            "이미 다른 계정의 프로필 이메일로 등록된 주소입니다. 같은 사용자라면 기존 계정으로 로그인해주세요."
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
          "이미 사용 중인 닉네임입니다. 이메일이 달라도 닉네임은 중복 사용이 불가능합니다."
        );
        setSaving(false);
        return;
      }

      const profileUpdatePayload = {
        nickname: nextNickname,
        full_name: nextFullName,
        phone: nextPhone,
        email: normalizedEmail,
        updated_at: new Date().toISOString(),
      };

      const profileUpdateQuery = supabase
        .from("profiles")
        .update(profileUpdatePayload)
        .eq("id", user.id)
        .select("id, is_approved")
        .maybeSingle<{ id: string; is_approved: boolean | null }>();

      let { data: profile, error: profileError } = await profileUpdateQuery;

      if (profileError && isPhoneColumnUnavailable(profileError.message)) {
        const retry = await supabase
          .from("profiles")
          .update({
            nickname: nextNickname,
            full_name: nextFullName,
            email: normalizedEmail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .select("id, is_approved")
          .maybeSingle<{ id: string; is_approved: boolean | null }>();
        profile = retry.data;
        profileError = retry.error;
      }

      if (profileError) {
        setMsg(`프로필 업데이트 실패: ${profileError.message}`);
        setSaving(false);
        return;
      }

      const currentMetadata = user.user_metadata ?? {};
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          nickname: nextNickname,
          display_name: nextNickname,
          full_name: nextFullName,
          phone: nextPhone,
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

  const completeOnboarding = () => {
    const validated = getValidatedOnboardingInput();
    if (!validated) return;

    setIsNicknameGuideOpen(true);
  };

  const confirmNicknameGuide = async () => {
    const validated = getValidatedOnboardingInput();
    if (!validated) {
      setIsNicknameGuideOpen(false);
      return;
    }

    setIsNicknameGuideOpen(false);
    await submitOnboarding(validated);
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
            최초 로그인 후 설정 단계입니다. 카톡방 닉네임과 동일한 닉네임으로
            설정해주세요. 닉네임, 이름, 전화번호, 이메일은 모두 필수입니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              이메일{canEditEmail ? " *" : ""}
            </label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              disabled={!canEditEmail || saving}
            />
            {canEditEmail ? (
              <p className="text-xs text-slate-500">
                카카오에서 이메일을 제공하지 않아 직접 입력이 필요합니다. 기존
                계정과 연결하려면 기존 계정의 이메일을 입력하지 말고, 기존 계정으로
                로그인한 뒤 프로필에서 카카오 연동을 진행해주세요.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">닉네임 *</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력해주세요"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">이름 *</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="이름을 입력해주세요"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">전화번호 *</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              disabled={saving}
            />
          </div>

          <Button
            onClick={completeOnboarding}
            disabled={saving || isNicknameGuideOpen}
            className="w-full"
          >
            {saving ? "처리 중..." : "저장하고 시작하기"}
          </Button>
        </CardContent>
      </Card>

      {isNicknameGuideOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nickname-guide-title"
        >
          <Card className="w-full max-w-md border-slate-200 shadow-2xl">
            <CardHeader className="space-y-3">
              <CardTitle id="nickname-guide-title">닉네임 확인</CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                닉네임은 필수며, 카톡방 닉네임과 동일한 닉네임을 사용해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                현재 입력한 닉네임으로 온보딩 결과가 저장됩니다. 카톡방에서 사용하는
                닉네임과 다시 한 번 일치하는지 확인한 뒤 저장해주세요.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNicknameGuideOpen(false)}
                >
                  취소
                </Button>
                <Button type="button" onClick={confirmNicknameGuide}>
                  확인 후 저장
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </main>
  );
}
