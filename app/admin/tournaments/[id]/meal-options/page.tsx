"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
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
  const [msg, setMsg] = useState("");

  // 새 메뉴 추가용 상태
  const [newMenuName, setNewMenuName] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const checkAdminAndLoad = async () => {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      await loadOptions();
    };

    checkAdminAndLoad();
  }, [tournamentId, user?.id, authLoading]);

  const loadOptions = async () => {
    const supabase = createClient();
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_meal_options")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("display_order", { ascending: true });

    if (error) {
      setMsg(`불러오기 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    setOptions(data || []);
    setLoading(false);
  };

  const addOption = async () => {
    if (!newMenuName.trim()) {
      setMsg("메뉴명을 입력하세요");
      return;
    }

    const supabase = createClient();
    setMsg("");
    const maxOrder = options.length > 0 ? Math.max(...options.map((o) => o.display_order)) : 0;

    const { error } = await supabase.from("tournament_meal_options").insert({
      tournament_id: tournamentId,
      menu_name: newMenuName.trim(),
      display_order: maxOrder + 1,
      is_active: true,
    });

    if (error) {
      setMsg(`추가 실패: ${error.message}`);
      return;
    }

    setMsg("메뉴 옵션이 추가되었습니다");
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
      setMsg(`상태 변경 실패: ${error.message}`);
      return;
    }

    setMsg("상태가 변경되었습니다");
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

    // 순서 교환
    const { error } = await supabase.from("tournament_meal_options").upsert([
      { id: current.id, display_order: target.display_order },
      { id: target.id, display_order: current.display_order },
    ]);

    if (error) {
      setMsg(`순서 변경 실패: ${error.message}`);
      return;
    }

    await loadOptions();
  };

  const deleteOption = async (id: number) => {
    if (!confirm("정말 삭제하시겠습니까? (비활성화를 권장합니다)")) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("tournament_meal_options")
      .delete()
      .eq("id", id);

    if (error) {
      setMsg(`삭제 실패: ${error.message}`);
      return;
    }

    setMsg("삭제되었습니다");
    await loadOptions();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Card className="border-slate-200/70">
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Card className="border-red-200 bg-red-50">
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
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">식사 메뉴 옵션 관리</h1>
          <Button asChild variant="outline">
            <Link href={`/admin/tournaments/${tournamentId}/edit`}>대회 정보로</Link>
          </Button>
        </div>

        {/* 새 메뉴 추가 */}
        <Card className="mb-6 border-slate-200/70">
          <CardHeader>
            <CardTitle>새 메뉴 옵션 추가</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="메뉴명 (예: 한식 - 불고기)"
                value={newMenuName}
                onChange={(e) => setNewMenuName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addOption();
                }}
              />
              <Button onClick={addOption}>추가</Button>
            </div>
            <p className="text-sm text-slate-500">
              💡 참가자가 신청 시 이 메뉴 목록에서 선택합니다.
            </p>
          </CardContent>
        </Card>

        {/* 메뉴 옵션 목록 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>등록된 메뉴 옵션 ({options.length}개)</CardTitle>
          </CardHeader>
          <CardContent>
            {options.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-8">
                등록된 메뉴 옵션이 없습니다. 위에서 추가하세요.
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
                      <TableCell>{opt.menu_name}</TableCell>
                      <TableCell>
                        <Badge variant={opt.is_active ? "default" : "secondary"}>
                          {opt.is_active ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveOrder(opt.id, "up")}
                            disabled={idx === 0}
                          >
                            ↑
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveOrder(opt.id, "down")}
                            disabled={idx === options.length - 1}
                          >
                            ↓
                          </Button>
                          <Button
                            size="sm"
                            variant={opt.is_active ? "secondary" : "default"}
                            onClick={() => toggleActive(opt.id, opt.is_active)}
                          >
                            {opt.is_active ? "비활성화" : "활성화"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteOption(opt.id)}
                          >
                            삭제
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {msg && (
              <p className="mt-4 text-sm text-slate-600 text-center">{msg}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
