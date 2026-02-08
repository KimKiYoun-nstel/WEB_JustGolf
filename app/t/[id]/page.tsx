"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/auth";
import { TOURNAMENT_FILES_BUCKET } from "../../../lib/storage";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

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

type TournamentFile = {
  id: number;
  file_type: "groups" | "notice" | "other";
  file_name: string;
  storage_path: string;
  is_public: boolean;
};

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const { user, loading } = useAuth();
  const [me, setMe] = useState<string>("");
  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [files, setFiles] = useState<TournamentFile[]>([]);
  const [nickname, setNickname] = useState("");
  const [profileNickname, setProfileNickname] = useState("");
  const [memo, setMemo] = useState("");
  const [msg, setMsg] = useState("");

  const friendlyError = (error: { code?: string; message: string }) => {
    if (error.code === "23505") return "이미 신청했습니다.";
    if (error.code === "42501") return "권한이 없어요. 로그인 상태를 확인해줘.";
    if (error.message.toLowerCase().includes("permission")) {
      return "권한이 없어요. 로그인 상태를 확인해줘.";
    }
    return error.message;
  };

  const refresh = async () => {
    setMsg("");
    const uid = user?.id ?? "";
    setMe(uid);

    if (uid) {
      const pRes = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", uid)
        .single();

      if (!pRes.error) {
        const nick = (pRes.data?.nickname ?? "").toString();
        setProfileNickname(nick);
        if (!nickname.trim()) setNickname(nick);
      }
    } else {
      setProfileNickname("");
    }

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

    if (rRes.error) setMsg(`신청 현황 조회 실패: ${friendlyError(rRes.error)}`);
    else setRegs((rRes.data ?? []) as Registration[]);

    const fRes = await supabase
      .from("tournament_files")
      .select("id,file_type,file_name,storage_path,is_public")
      .eq("tournament_id", tournamentId)
      .eq("is_public", true)
      .order("id", { ascending: true });

    if (fRes.error) setMsg(`파일 조회 실패: ${friendlyError(fRes.error)}`);
    else setFiles((fRes.data ?? []) as TournamentFile[]);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (loading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, loading, user?.id]);

  const apply = async () => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("신청하려면 로그인 필요! (/login)");
      return;
    }
    const nick = nickname.trim() || profileNickname.trim();
    if (!nick) {
      setMsg("닉네임을 입력해줘.");
      return;
    }

    const { error } = await supabase.from("registrations").insert({
      tournament_id: tournamentId,
      user_id: uid,
      nickname: nick,
      memo: memo.trim() || null,
      status: "applied",
    });

    if (error) setMsg(`신청 실패: ${friendlyError(error)}`);
    else {
      setMsg("신청 완료!");
      await refresh();
    }
  };

  const cancelMine = async () => {
    setMsg("");
    const uid = user?.id;
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

    if (error) setMsg(`취소 실패: ${friendlyError(error)}`);
    else {
      setMsg("취소 완료");
      await refresh();
    }
  };

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        {!t ? (
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-slate-200/70">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{t.title}</span>
                  <Badge variant="secondary" className="capitalize">
                    {t.status}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {t.event_date} · {t.course_name ?? "-"} · {t.location ?? "-"}
                </CardDescription>
              </CardHeader>
              {t.notes && (
                <CardContent>
                  <p className="text-sm text-slate-600">{t.notes}</p>
                </CardContent>
              )}
            </Card>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <Card className="border-slate-200/70">
                <CardHeader>
                  <CardTitle>참가 신청</CardTitle>
                  <CardDescription>
                    현황은 공개(A). 신청은 로그인 필요.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">닉네임</label>
                    <Input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                    />
                    {profileNickname && (
                      <p className="text-xs text-slate-500">
                        기본 닉네임: {profileNickname}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">메모(선택)</label>
                    <Input
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={apply}>신청</Button>
                    <Button onClick={cancelMine} variant="outline">
                      내 신청 취소
                    </Button>
                    <Button onClick={refresh} variant="ghost">
                      새로고침
                    </Button>
                  </div>

                  {msg && <p className="text-sm text-slate-600">{msg}</p>}
                </CardContent>
              </Card>

              <Card className="border-slate-200/70">
                <CardHeader>
                  <CardTitle>참가 현황(공개)</CardTitle>
                  <CardDescription>닉네임과 상태만 노출됩니다.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>닉네임</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regs.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{r.nickname}</span>
                              {me && r.user_id === me ? (
                                <Badge variant="outline">나</Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200/70">
              <CardHeader>
                <CardTitle>첨부파일</CardTitle>
                <CardDescription>조편성/안내 파일을 확인하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                {files.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    공개된 파일이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {files.map((file) => {
                      const { data } = supabase.storage
                        .from(TOURNAMENT_FILES_BUCKET)
                        .getPublicUrl(file.storage_path);
                      return (
                        <li
                          key={file.id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="text-sm">
                            <span className="font-medium">{file.file_name}</span>
                            <span className="text-slate-500">
                              {" "}
                              · {file.file_type}
                            </span>
                          </div>
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={data.publicUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              열기
                            </a>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
