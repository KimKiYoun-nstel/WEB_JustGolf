"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { getUserFriendlyError } from "../../lib/errorHandler";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";

type EmailCheckResult = {
  exists: boolean;
  profileExists: boolean;
};

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState<boolean | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      const onboardingCompleted = user.user_metadata?.onboarding_completed === true;
      router.push(onboardingCompleted ? "/start" : "/auth/onboarding");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    const urlMessage = searchParams.get("message");
    if (urlMessage) {
      setMsg(urlMessage);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadApprovalSetting = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "approval_required")
        .single();

      if (error) {
        setApprovalRequired(true);
        return;
      }

      setApprovalRequired(data?.value ?? true);
    };

    loadApprovalSetting();
  }, [supabase]);

  useEffect(() => {
    if (!msg) return;
    if (msg.includes("요청 중") || msg.includes("처리 중")) return;

    const isSuccess =
      msg.includes("성공") || msg.includes("완료") || msg.includes("로그인할 수 있습니다");
    const isError =
      msg.includes("실패") ||
      msg.includes("오류") ||
      msg.includes("필요") ||
      msg.includes("없습니다") ||
      msg.includes("중복") ||
      msg.includes("확인");

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const logAuthFailure = async (payload: {
    action: "login_submit" | "signup_submit" | "kakao_login_submit";
    message: string;
    errorCode?: string | null;
    details?: Record<string, unknown>;
  }) => {
    try {
      await fetch("/api/auth/error-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: payload.action,
          message: payload.message,
          errorCode: payload.errorCode ?? null,
          email: email.trim().toLowerCase() || null,
          path: window.location.pathname,
          details: payload.details ?? {},
        }),
      });
    } catch {
      // 로깅 실패는 사용자 흐름을 막지 않음
    }
  };

  const syncAutoApproval = async () => {
    try {
      await fetch("/api/auth/sync-approval", { method: "POST" });
    } catch {
      // 동기화 실패는 로그인/회원가입 흐름을 막지 않음
    }
  };

  const checkEmailExists = async (emailToCheck: string): Promise<EmailCheckResult | null> => {
    if (!emailToCheck) return null;

    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToCheck }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) return null;

      return {
        exists: Boolean(data?.exists),
        profileExists: Boolean(data?.profileExists),
      };
    } catch {
      return null;
    }
  };

  const getEmailConflictMessage = (check: EmailCheckResult) => {
    if (check.exists) {
      return "이미 이메일로 가입된 계정입니다. 로그인 후 프로필에서 카카오 계정 연동을 진행해주세요.";
    }

    if (check.profileExists) {
      return "이미 다른 계정에서 사용 중인 이메일입니다. 기존 계정으로 로그인해주세요.";
    }

    return null;
  };

  const signUp = async () => {
    setMsg("");
    setLoading(true);

    try {
      setMsg("회원가입 요청 중...");
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail) {
        setMsg("이메일을 입력해주세요.");
        setLoading(false);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setMsg("이메일 형식을 확인해주세요.");
        setLoading(false);
        return;
      }

      const nick = nickname.trim();
      if (!nick) {
        setMsg("닉네임을 입력해주세요.");
        await logAuthFailure({
          action: "signup_submit",
          message: "회원가입 실패: 닉네임 누락",
          errorCode: "missing_nickname",
        });
        setLoading(false);
        return;
      }

      const { data: available, error: checkError } = await supabase.rpc(
        "is_nickname_available",
        { p_nickname: nick, p_user_id: null }
      );

      if (checkError) {
        setMsg(`닉네임 중복 확인 실패: ${checkError.message}`);
        await logAuthFailure({
          action: "signup_submit",
          message: "회원가입 실패: 닉네임 중복 확인 오류",
          errorCode: checkError.code ?? null,
          details: { errorMessage: checkError.message },
        });
        setLoading(false);
        return;
      }

      if (!available) {
        setMsg("이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해주세요.");
        await logAuthFailure({
          action: "signup_submit",
          message: "회원가입 실패: 닉네임 중복",
          errorCode: "nickname_conflict",
          details: { nickname: nick },
        });
        setLoading(false);
        return;
      }

      const emailCheck = await checkEmailExists(normalizedEmail);
      if (emailCheck) {
        const emailConflictMessage = getEmailConflictMessage(emailCheck);
        if (emailConflictMessage) {
          setMsg(`회원가입 실패: ${emailConflictMessage}`);
          await logAuthFailure({
            action: "signup_submit",
            message: "회원가입 실패: 이메일 충돌",
            errorCode: emailCheck.exists ? "email_exists" : "profile_email_exists",
            details: {
              existsInAuth: emailCheck.exists,
              existsInProfile: emailCheck.profileExists,
            },
          });
          setLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            nickname: nick,
            onboarding_completed: false,
          },
        },
      });

      if (error) {
        const errorMsg = getUserFriendlyError(error, "signUp");
        setMsg(`회원가입 실패: ${errorMsg}`);
        await logAuthFailure({
          action: "signup_submit",
          message: "회원가입 실패: Supabase signUp 오류",
          errorCode: error.code ?? null,
          details: { errorMessage: error.message },
        });
        setLoading(false);
        return;
      }

      if (!data?.user?.id) {
        setMsg("회원가입 실패: 사용자 정보를 찾을 수 없습니다.");
        await logAuthFailure({
          action: "signup_submit",
          message: "회원가입 실패: 사용자 ID 없음",
          errorCode: "missing_user_id",
        });
        setLoading(false);
        return;
      }

      await syncAutoApproval();

      let profileCheck: { is_approved?: boolean } | null = null;
      let lastError: { code?: string; message?: string } | null = null;
      const maxRetries = 5;
      const retryDelayMs = 500;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }

        const pRes = await supabase
          .from("profiles")
          .select("id, nickname, is_approved")
          .eq("id", data.user.id)
          .single();

        if (!pRes.error && pRes.data) {
          profileCheck = pRes.data;
          break;
        }

        lastError = pRes.error;
      }

      const approvalRequiredValue = approvalRequired ?? true;

      if (!profileCheck) {
        await logAuthFailure({
          action: "signup_submit",
          message: "회원가입 실패: profiles 동기화 지연",
          errorCode: lastError?.code ?? "profile_sync_delayed",
          details: { lastErrorMessage: lastError?.message ?? null },
        });
        setMsg(
          approvalRequiredValue
            ? "회원가입 완료되었습니다. 관리자 승인 후 로그인해주세요."
            : "회원가입 완료되었습니다. 바로 로그인할 수 있습니다."
        );
        setLoading(false);
        return;
      }

      if (!approvalRequiredValue && profileCheck.is_approved === false) {
        await supabase
          .from("profiles")
          .update({ is_approved: true })
          .eq("id", data.user.id);
      }

      setMsg(
        `회원가입 완료! ${
          approvalRequiredValue
            ? profileCheck.is_approved
              ? "로그인할 수 있습니다."
              : "관리자 승인 후 로그인할 수 있습니다."
            : "로그인할 수 있습니다."
        }`
      );
      setLoading(false);
    } catch (err) {
      const errorMsg = getUserFriendlyError(err, "signUp");
      setMsg(`회원가입 실패: ${errorMsg}`);
      await logAuthFailure({
        action: "signup_submit",
        message: "회원가입 실패: 예외 발생",
        details: { errorMessage: String(err) },
      });
      setLoading(false);
    }
  };

  const signInWithKakao = async () => {
    setMsg("");
    setLoading(true);

    try {
      window.location.href = "/api/auth/kakao/start";
    } catch (err) {
      setMsg(`카카오 로그인 실패: ${getUserFriendlyError(err, "signIn")}`);
      await logAuthFailure({
        action: "kakao_login_submit",
        message: "카카오 로그인 시작 실패",
        details: { errorMessage: String(err) },
      });
      setLoading(false);
    }
  };

  const signIn = async () => {
    setMsg("");
    setLoading(true);

    try {
      setMsg("로그인 요청 중...");

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const rawMessage = error.message ?? "";

        if (rawMessage.includes("Invalid login credentials")) {
          const emailCheck = await checkEmailExists(email.trim().toLowerCase());

          if (emailCheck?.exists === true) {
            setMsg("로그인 실패: 비밀번호가 틀렸습니다.");
          } else if (emailCheck?.exists === false) {
            if (emailCheck.profileExists) {
              setMsg(
                "로그인 실패: 이메일 로그인 계정이 없습니다. 카카오 가입 계정이면 카카오 로그인을 이용해주세요."
              );
            } else {
              setMsg("로그인 실패: 존재하지 않는 계정입니다.");
            }
          } else {
            setMsg(`로그인 실패: ${getUserFriendlyError(error, "signIn")}`);
          }
        } else if (rawMessage.toLowerCase().includes("email not confirmed")) {
          setMsg("로그인 실패: 이메일 인증이 필요합니다.");
        } else {
          setMsg(`로그인 실패: ${getUserFriendlyError(error, "signIn")}`);
        }

        await logAuthFailure({
          action: "login_submit",
          message: "로그인 실패: Supabase signInWithPassword 오류",
          errorCode: error.code ?? null,
          details: {
            errorMessage: error.message,
            normalizedReason: rawMessage.includes("Invalid login credentials")
              ? "invalid_credentials"
              : rawMessage.toLowerCase().includes("email not confirmed")
                ? "email_not_confirmed"
                : "other",
          },
        });

        setLoading(false);
        return;
      }

      if (!data?.user?.id) {
        setMsg("로그인 실패: 사용자 정보를 찾을 수 없습니다.");
        await logAuthFailure({
          action: "login_submit",
          message: "로그인 실패: 사용자 ID 없음",
          errorCode: "missing_user_id",
        });
        setLoading(false);
        return;
      }

      await syncAutoApproval();

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      setMsg("로그인 성공! 이동 중...");
      const onboardingCompleted = data.user.user_metadata?.onboarding_completed === true;
      setTimeout(() => {
        router.push(onboardingCompleted ? "/start" : "/auth/onboarding");
      }, 300);
    } catch (err) {
      const errorMsg = getUserFriendlyError(err, "signIn");
      setMsg(`로그인 실패: ${errorMsg}`);
      await logAuthFailure({
        action: "login_submit",
        message: "로그인 실패: 예외 발생",
        details: { errorMessage: String(err) },
      });
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F9FAFB] px-6 py-12">
      <div className="mx-auto w-full max-w-md rounded-[30px] border border-slate-200/70 bg-white p-8 shadow-sm md:p-10">
        <div className="mb-8 flex items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-slate-900">Just Golf</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">로그인 / 회원가입</h1>
          <p className="text-sm text-slate-500">
            기존 계정으로 로그인하거나 새 계정을 등록하세요.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">이메일</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              disabled={loading}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">비밀번호</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">닉네임 (회원가입 시)</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
              disabled={loading}
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
              disabled={loading}
            />
            <label htmlFor="rememberMe" className="text-sm text-slate-600">
              로그인 정보 기억하기
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={signIn}
              disabled={loading}
              className="h-12 rounded-2xl bg-green-600 font-bold hover:bg-green-700"
            >
              {loading ? "처리 중..." : "로그인"}
            </Button>
            <Button
              onClick={signUp}
              variant="secondary"
              disabled={loading}
              className="h-12 rounded-2xl font-bold"
            >
              {loading ? "처리 중..." : "회원가입"}
            </Button>
          </div>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">또는</span>
            </div>
          </div>

          <Button
            onClick={signInWithKakao}
            disabled={loading}
            className="h-12 w-full rounded-2xl bg-[#FEE500] font-bold text-slate-900 hover:bg-[#f4dd00]"
          >
            {loading ? "처리 중..." : "카카오로 시작하기"}
          </Button>

          <p className="text-xs leading-relaxed text-slate-500">
            이메일 계정과 카카오 계정을 함께 사용하려면 로그인 후 프로필에서 계정 연동 기능을 사용하세요.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F9FAFB] px-6 py-12">
          <div className="mx-auto w-full max-w-md rounded-[30px] border border-slate-200/70 bg-white p-10 shadow-sm">
            <p className="text-sm text-slate-500">로딩 중...</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

