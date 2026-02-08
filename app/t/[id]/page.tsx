"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  notes: string | null;
  status: string;
};

type Registration = {
  id: number;
  user_id: string;
  nickname: string;
  status: "applied" | "confirmed" | "waitlisted" | "canceled";
  memo: string | null;
};

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [me, setMe] = useState<string>("");
  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [nickname, setNickname] = useState("");
  const [memo, setMemo] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    setMsg("");
    const userRes = await supabase.auth.getUser();
    const uid = userRes.data.user?.id ?? "";
    setMe(uid);

    const tRes = await supabase
      .from("tournaments")
      .select("id,title,event_date,course_name,location,notes,status")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${tRes.error.message}`);
      return;
    }
    setT(tRes.data as Tournament);

    const rRes = await supabase
      .from("registrations")
      .select("id,user_id,nickname,status,memo")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: true });

    if (rRes.error) setMsg(`신청 현황 조회 실패: ${rRes.error.message}`);
    else setRegs((rRes.data ?? []) as Registration[]);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const apply = async () => {
    setMsg("");
    const userRes = await supabase.auth.getUser();
    const uid = userRes.data.user?.id;
    if (!uid) {
      setMsg("신청하려면 로그인 필요! (/login)");
      return;
    }
    if (!nickname.trim()) {
      setMsg("닉네임을 입력해줘.");
      return;
    }

    const { error } = await supabase.from("registrations").insert({
      tournament_id: tournamentId,
      user_id: uid,
      nickname: nickname.trim(),
      memo: memo.trim() || null,
      status: "applied",
    });

    if (error) setMsg(`신청 실패: ${error.message}`);
    else {
      setMsg("신청 완료!");
      await refresh();
    }
  };

  const cancelMine = async () => {
    setMsg("");
    const userRes = await supabase.auth.getUser();
    const uid = userRes.data.user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    const mine = regs.find((r) => r.user_id === uid);
    if (!mine) {
      setMsg("내 신청 내역이 없어.");
      return;
    }

    const { error } = await supabase
      .from("registrations")
      .update({ status: "canceled" })
      .eq("id", mine.id);

    if (error) setMsg(`취소 실패: ${error.message}`);
    else {
      setMsg("취소 완료");
      await refresh();
    }
  };

  return (
    <main style={{ padding: 24 }}>
      {!t ? (
        <p>로딩중...</p>
      ) : (
        <>
          <h1>{t.title}</h1>
          <p>
            {t.event_date} / {t.course_name ?? "-"} / {t.location ?? "-"} /{" "}
            {t.status}
          </p>
          {t.notes && <p>{t.notes}</p>}

          <hr style={{ margin: "16px 0" }} />

          <h2>참가 신청</h2>
          <p style={{ opacity: 0.8 }}>
            현황은 공개(A). 신청은 로그인 필요.
          </p>

          <div style={{ maxWidth: 520 }}>
            <label>닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              style={{ display: "block", width: "100%", marginBottom: 8 }}
            />

            <label>메모(선택)</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              style={{ display: "block", width: "100%", marginBottom: 8 }}
            />

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={apply}>신청</button>
              <button onClick={cancelMine}>내 신청 취소</button>
              <button onClick={refresh}>새로고침</button>
            </div>
          </div>

          {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

          <hr style={{ margin: "16px 0" }} />

          <h2>참가 현황(공개)</h2>
          <ul>
            {regs.map((r) => (
              <li key={r.id}>
                {r.nickname} / {r.status}
                {me && r.user_id === me ? " (나)" : ""}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
