"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabaseClient";
import { TOURNAMENT_FILES_BUCKET } from "../../../../../lib/storage";
import { useAuth } from "../../../../../lib/auth";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../components/ui/table";

type TournamentFile = {
  id: number;
  tournament_id: number;
  file_type: "groups" | "notice" | "other";
  file_name: string;
  storage_path: string;
  is_public: boolean;
  created_at: string;
};

export default function AdminFilesPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const { user } = useAuth();

  const [rows, setRows] = useState<TournamentFile[]>([]);
  const [msg, setMsg] = useState("");
  const [fileType, setFileType] = useState<TournamentFile["file_type"]>(
    "groups"
  );
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    setMsg("");
    const { data, error } = await supabase
      .from("tournament_files")
      .select(
        "id,tournament_id,file_type,file_name,storage_path,is_public,created_at"
      )
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });

    if (error) setMsg(`조회 실패: ${error.message}`);
    else setRows((data ?? []) as TournamentFile[]);
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    load();
  }, [tournamentId]);

  const upload = async () => {
    setMsg("");
    if (!file) {
      setMsg("업로드할 파일을 선택해줘.");
      return;
    }

    const safeName = `${Date.now()}_${file.name}`;
    const storagePath = `${tournamentId}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(TOURNAMENT_FILES_BUCKET)
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      setMsg(`파일 업로드 실패: ${uploadError.message}`);
      return;
    }

    const { error: insertError } = await supabase
      .from("tournament_files")
      .insert({
        tournament_id: tournamentId,
        file_type: fileType,
        file_name: file.name,
        storage_path: storagePath,
        is_public: true,
        uploaded_by: user?.id ?? null,
      });

    if (insertError) {
      setMsg(`파일 기록 실패: ${insertError.message}`);
      return;
    }

    setFile(null);
    setMsg("업로드 완료");
    await load();
  };

  const publicUrl = (path: string) => {
    const { data } = supabase.storage
      .from(TOURNAMENT_FILES_BUCKET)
      .getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <main>
      <Card className="border-slate-200/70">
        <CardHeader>
          <CardTitle>파일 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">파일 타입</label>
              <select
                value={fileType}
                onChange={(e) =>
                  setFileType(e.target.value as TournamentFile["file_type"])
                }
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="groups">groups</option>
                <option value="notice">notice</option>
                <option value="other">other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">파일 선택</label>
              <Input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Button onClick={upload}>업로드</Button>
          </div>

          {msg && <p className="text-sm text-slate-600">{msg}</p>}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">업로드된 파일</h3>
              <Button onClick={load} variant="ghost">
                새로고침
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>파일명</TableHead>
                  <TableHead>타입</TableHead>
                  <TableHead>열기</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.file_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.file_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={publicUrl(row.storage_path)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          열기
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
