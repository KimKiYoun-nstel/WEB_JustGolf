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
  const [fullName, setFullName] = useState("");
  const [originalFullName, setOriginalFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authProvider, setAuthProvider] = useState("email");
  const [msg, setMsg] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

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
    setAuthProvider(user.app_metadata?.provider ?? "email");

    const metadataPhone = (user.user_metadata?.phone as string | undefined) ?? "";
    setPhone(metadataPhone);
    setOriginalPhone(metadataPhone);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("nickname, full_name")
      .eq("id", user.id)
      .single();

    if (error) {
      setMsg(`??? ?? ??: ${error.message}`);
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
      setMsg("???? ?????.");
      return;
    }

    const nextFullName = fullName.trim();
    const nextPhone = phone.trim();

    if (nextFullName === originalFullName && nextPhone === originalPhone) {
      setMsg("??? ??? ????.");
      return;
    }

    setIsSavingProfile(true);

    const supabase = createClient();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: nextFullName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      setMsg(`??? ?? ?? ??: ${profileError.message}`);
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
      setMsg(`??? ????? ?? ??: ${metadataError.message}`);
      setIsSavingProfile(false);
      return;
    }

    setOriginalFullName(nextFullName);
    setOriginalPhone(nextPhone);
    setMsg("??? ????? ???????.");
    setIsSavingProfile(false);
  };

  const updateNickname = async () => {
    setMsg("");

    if (!user) {
      setMsg("???? ?????.");
      return;
    }

    const nick = nickname.trim();
    if (!nick) {
      setMsg("???? ??????.");
      return;
    }

    if (nick === originalNickname) {
      setMsg("?? ???? ?????.");
      return;
    }

    setIsSavingNickname(true);

    const supabase = createClient();
    const { data: available, error: checkError } = await supabase.rpc(
      "is_nickname_available",
      { p_nickname: nick, p_user_id: user.id }
    );

    if (checkError) {
      setMsg(`??? ?? ?? ??: ${checkError.message}`);
      setIsSavingNickname(false);
      return;
    }

    if (!available) {
      setMsg("?? ?? ?? ??????.");
      setIsSavingNickname(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ nickname: nick, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) {
      setMsg(`??? ?? ??: ${error.message}`);
      setIsSavingNickname(false);
      return;
    }

    setOriginalNickname(nick);
    setMsg("???? ???????.");
    setIsSavingNickname(false);
  };

  const updatePassword = async () => {
    setMsg("");

    if (!user) {
      setMsg("???? ?????.");
      return;
    }

    if (!newPassword.trim()) {
      setMsg("? ????? ??????.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMsg("????? ???? ????.");
      return;
    }

    if (newPassword.length < 6) {
      setMsg("????? ?? 6? ????? ???.");
      return;
    }

    setIsSavingPassword(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMsg(`???? ?? ??: ${error.message}`);
      setIsSavingPassword(false);
      return;
    }

    setMsg("????? ???????.");
    setNewPassword("");
    setConfirmPassword("");
    setIsSavingPassword(false);
  };

  if (loading || isLoadingData) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">?? ?...</p>
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
          <h1 className="text-3xl font-semibold text-slate-900">? ???</h1>
          <p className="text-sm text-slate-500">
            {authProvider === "kakao"
              ? "??? ???? ??? ????. ??? ??? ??? ? ????."
              : "??? ???? ??? ????. ??? ??? ??? ? ????."}
          </p>
        </div>

        {msg && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>???</CardTitle>
            <CardDescription>??? ?? ???? ? ???? ??? ? ????.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input value={email || "????? ???? ??"} disabled />
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>?? ??</CardTitle>
            <CardDescription>??? ????? ??? ? ????.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">??</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="??? ?????"
                disabled={isSavingProfile}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">????</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                disabled={isSavingProfile}
              />
            </div>
            <Button onClick={updateProfileInfo} disabled={isSavingProfile}>
              {isSavingProfile ? "?? ?..." : "?? ?? ??"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>???</CardTitle>
            <CardDescription>????? ???? ?????.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="???? ?????"
              disabled={isSavingNickname}
            />
            <Button onClick={updateNickname} disabled={isSavingNickname}>
              {isSavingNickname ? "?? ?..." : "??? ??"}
            </Button>
          </CardContent>
        </Card>

        {authProvider === "email" ? (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>???? ??</CardTitle>
              <CardDescription>
                ? ????? ?? 6? ????? ???.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">? ????</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="? ????"
                  disabled={isSavingPassword}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">???? ??</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="???? ??"
                  disabled={isSavingPassword}
                />
              </div>

              <Button onClick={updatePassword} disabled={isSavingPassword}>
                {isSavingPassword ? "?? ?..." : "???? ??"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>???? ??</CardTitle>
              <CardDescription>
                ??? ??? ???? ??? ???? ????? ?????.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="flex gap-2">
          <Button onClick={() => router.back()} variant="outline">
            ????
          </Button>
          <Button onClick={() => router.push("/")} variant="secondary">
            ???
          </Button>
        </div>
      </div>
    </main>
  );
}
