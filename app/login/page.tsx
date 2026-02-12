"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { withRetry, getUserFriendlyError } from "../../lib/errorHandler";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState<boolean | null>(null);
  const supabase = createClient();

  // 이미 로그인하면 자동으로 /start로 리다이렉트
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/start");
    }
  }, [user, authLoading, router]);

  // 저장된 이메일 불러오기
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    // URL에서 메시지 읽기 (예: middleware에서 리다이렉트할 때)
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

  const signUp = async () => {
    setMsg("");
    setLoading(true);
    
    try {
      setMsg("회원가입 요청 중...");

      const nick = nickname.trim();
      if (!nick) {
        setMsg("닉네임을 입력해주세요.");
        setLoading(false);
        return;
      }

      const { data: available, error: checkError } = await supabase.rpc(
        "is_nickname_available",
        { p_nickname: nick, p_user_id: null }
      );

      if (checkError) {
        setMsg(`닉네임 중복 확인 실패: ${checkError.message}`);
        setLoading(false);
        return;
      }

      if (!available) {
        setMsg("이미 사용 중인 닉네임입니다.");
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nickname: nick },
        },
      });

      if (error) {
        const errorMsg = getUserFriendlyError(error, "signUp");
        setMsg(`회원가입 실패: ${errorMsg}`);
        setLoading(false);
        return;
      }

      if (!data?.user?.id) {
        setMsg("회원가입 실패: 사용자 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      // Trigger가 profile을 자동 생성 - 재시도 로직으로 생성 대기
      let profileCheck = null;
      let lastError = null;
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
        // 5회 재시도 후에도 실패했으면 생성 대기 중일 가능성
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
            ? (profileCheck.is_approved ? "로그인할 수 있습니다." : "관리자 승인 후 로그인할 수 있습니다.")
            : "로그인할 수 있습니다."
        }`
      );
      setLoading(false);
    } catch (err) {
      const errorMsg = getUserFriendlyError(err, "signUp");
      setMsg(`회원가입 실패: ${errorMsg}`);
      setLoading(false);
    }
  };

  const checkEmailExists = async (emailToCheck: string) => {
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
        const rawMessage = error?.message ?? "";

        if (rawMessage.includes("Invalid login credentials")) {
          const emailCheck = await checkEmailExists(email.trim());

          if (emailCheck?.exists === true) {
            setMsg("로그인 실패: 비밀번호가 틀렸습니다.");
          } else if (emailCheck?.exists === false) {
            if (emailCheck.profileExists) {
              setMsg(
                "로그인 실패: 계정 상태에 문제가 있습니다. 관리자에게 문의해주세요."
              );
            } else {
              setMsg("로그인 실패: 존재하지 않는 계정입니다.");
            }
          } else {
            const errorMsg = getUserFriendlyError(error, "signIn");
            setMsg(`로그인 실패: ${errorMsg}`);
          }
        } else if (rawMessage.toLowerCase().includes("email not confirmed")) {
          setMsg("로그인 실패: 이메일 인증이 필요합니다.");
        } else {
          const errorMsg = getUserFriendlyError(error, "signIn");
          setMsg(`로그인 실패: ${errorMsg}`);
        }

        setLoading(false);
        return;
      }

      if (!data?.user?.id) {
        setMsg("로그인 실패: 사용자 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      // 로그인 정보 기억하기
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      // 로그인 성공 - 클라이언트 사이드 네비게이션
      setMsg("로그인 성공! 이동 중...");
      setTimeout(() => {
        router.push("/start");
      }, 300);
    } catch (err) {
      const errorMsg = getUserFriendlyError(err, "signIn");
      setMsg(`로그인 실패: ${errorMsg}`);
      setLoading(false);
    }
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

          <div className="flex flex-wrap gap-2">
            <Button onClick={signIn} disabled={loading}>
              {loading ? "처리 중..." : "로그인"}
            </Button>
            <Button onClick={signUp} variant="secondary" disabled={loading}>
              {loading ? "처리 중..." : "회원가입"}
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
