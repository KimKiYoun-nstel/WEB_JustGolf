"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

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
    <main style={{ padding: 24, maxWidth: 520 }}>
      <h1>로그인 / 회원가입</h1>

      <label>이메일</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: 12 }}
      />

      <label>비밀번호</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: 12 }}
      />

      <label>닉네임(회원가입 시)</label>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={signIn}>로그인</button>
        <button onClick={signUp}>회원가입</button>
        <button onClick={signOut}>로그아웃</button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
