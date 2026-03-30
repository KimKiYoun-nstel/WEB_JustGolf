"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { useAuth } from "../../../../../lib/auth";
import { getTournamentAdminAccess } from "../../../../../lib/tournamentAdminAccess";
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
import { useToast } from "../../../../../components/ui/toast";

type MealOption = {
  id: number;
  tournament_id: number;
  menu_name: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export default function AdminMealOptionsPage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [options, setOptions] = useState<MealOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newMenuName, setNewMenuName] = useState("");
  const { toast } = useToast();

  const loadOptions = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);

    const { data, error } = await supabase
      .from("tournament_meal_options")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("display_order", { ascending: true });

    if (error) {
      toast({
        variant: "error",
        title: "목록 조회 실패",
        description: error.message,
      });
      setLoading(false);
      return;
    }

    setOptions(data ?? []);
    setLoading(false);
  }, [tournamentId, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const checkAccessAndLoad = async () => {
      const supabase = createClient();
      const access = await getTournamentAdminAccess(supabase, user.id, tournamentId);
      if (!access.canManageTournament) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      await loadOptions();
    };

    void checkAccessAndLoad();
  }, [tournamentId, user?.id, authLoading, loadOptions]);

  const addOption = async () => {
    if (!newMenuName.trim()) {
      toast({ variant: "error", title: "메뉴명을 입력하세요." });
      return;
    }

    const supabase = createClient();
    const maxOrder = options.length > 0 ? Math.max(...options.map((o) => o.display_order)) : 0;

    const { error } = await supabase.from("tournament_meal_options").insert({
      tournament_id: tournamentId,
      menu_name: newMenuName.trim(),
      display_order: maxOrder + 1,
      is_active: true,
    });

    if (error) {
      toast({
        variant: "error",
        title: "메뉴 옵션 추가 실패",
        description: error.message,
      });
      return;
    }

    toast({ variant: "success", title: "메뉴 옵션이 추가되었습니다." });
    setNewMenuName("");
    await loadOptions();
  };

  const toggleActive = async (id: number, currentActive: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("tournament_meal_options")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (error) {
      toast({
        variant: "error",
        title: "상태 변경 실패",
        description: error.message,
      });
      return;
    }

    toast({ variant: "success", title: "상태가 변경되었습니다." });
    await loadOptions();
  };

  const moveOrder = async (id: number, direction: "up" | "down") => {
    const supabase = createClient();
    const idx = options.findIndex((o) => o.id === id);
    if (idx === -1) return;

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= options.length) return;

    const current = options[idx];
    const target = options[targetIdx];

    const { error } = await supabase.from("tournament_meal_options").upsert([
      { id: current.id, display_order: target.display_order },
      { id: target.id, display_order: current.display_order },
    ]);

    if (error) {
      toast({
        variant: "error",
        title: "순서 변경 실패",
        description: error.message,
      });
      return;
    }

    await loadOptions();
  };

  const deleteOption = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("tournament_meal_options")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "error",
        title: "삭제 실패",
        description: error.message,
      });
      return;
    }

    toast({ variant: "success", title: "삭제되었습니다." });
    await loadOptions();
  };

  const startEdit = (opt: MealOption) => {
    setEditingId(opt.id);
    setEditingName(opt.menu_name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async (id: number) => {
    const name = editingName.trim();
    if (!name) {
      toast({ variant: "error", title: "메뉴명을 입력하세요." });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from("tournament_meal_options")
      .update({ menu_name: name })
      .eq("id", id);

    if (error) {
      toast({
        variant: "error",
        title: "메뉴 수정 실패",
        description: error.message,
      });
      return;
    }

    toast({ variant: "success", title: "메뉴명이 수정되었습니다." });
    cancelEdit();
    await loadOptions();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
          <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩 중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
          <Card className="rounded-2xl border-red-200 bg-red-50">
            <CardContent className="py-6 text-red-700">
              <p>관리자만 접근할 수 있습니다.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/admin">관리자 대시보드로</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-800">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">식사 메뉴 옵션 관리</h1>
          <Button asChild variant="outline">
            <Link href={`/admin/tournaments/${tournamentId}/edit`}>대회 정보로</Link>
          </Button>
        </div>

        <Card className="mb-6 rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>신규 메뉴 옵션 추가</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="메뉴명 (예: 중식 - 불고기)"
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
                className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addOption();
                }}
              />
              <Button onClick={() => void addOption()}>추가</Button>
            </div>
            <p className="text-sm text-slate-500">
              참가자 신청 시 선택 가능한 메뉴 목록을 설정합니다.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>등록된 메뉴 옵션 ({options.length}개)</CardTitle>
          </CardHeader>
          <CardContent>
            {options.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                등록된 메뉴 옵션이 없습니다. 위에서 추가해 주세요.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">순서</TableHead>
                    <TableHead>메뉴명</TableHead>
                    <TableHead className="w-24">상태</TableHead>
                    <TableHead className="w-48 text-center">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {options.map((opt, idx) => (
                    <TableRow key={opt.id}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>
                        {editingId === opt.id ? (
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="메뉴명"
                          />
                        ) : (
                          opt.menu_name
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={opt.is_active ? "default" : "secondary"}>
                          {opt.is_active ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          {editingId === opt.id ? (
                            <>
                              <Button size="sm" onClick={() => void saveEdit(opt.id)}>
                                저장
                              </Button>
                              <Button size="sm" variant="outline" onClick={cancelEdit}>
                                취소
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void moveOrder(opt.id, "up")}
                                disabled={idx === 0}
                              >
                                위
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void moveOrder(opt.id, "down")}
                                disabled={idx === options.length - 1}
                              >
                                아래
                              </Button>
                              <Button
                                size="sm"
                                variant={opt.is_active ? "secondary" : "default"}
                                onClick={() => void toggleActive(opt.id, opt.is_active)}
                              >
                                {opt.is_active ? "비활성화" : "활성화"}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => startEdit(opt)}>
                                수정
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void deleteOption(opt.id)}
                              >
                                삭제
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
