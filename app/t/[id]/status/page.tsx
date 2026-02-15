"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../lib/supabaseClient";
import { useAuth } from "../../../../lib/auth";
import { formatRegistrationStatus } from "../../../../lib/statusLabels";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { useToast } from "../../../../components/ui/toast";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  status: string;
};

type MyRegistration = {
  id: number;
  nickname: string;
  status: string;
  approval_status: string;
  meal_option_id: number | null;
  memo: string | null;
  created_at: string;
};

type RegistrationExtras = {
  carpool_available: boolean;
  carpool_seats: number | null;
  transportation: string | null;
  departure_location: string | null;
  notes: string | null;
};

type MealOption = {
  id: number;
  menu_name: string;
};

type SideEventReg = {
  id: number;
  side_event_id: number;
  registration_id: number;
  participant_nickname: string;
  side_event_title: string;
  round_type: string;
  status: string;
  memo: string | null;
  meal_selected: boolean;
  lodging_selected: boolean;
};

type TournamentExtra = {
  id: number;
  activity_name: string;
  description: string | null;
};

export default function MyStatusPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const { user, loading } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [myReg, setMyReg] = useState<MyRegistration | null>(null);
  const [extras, setExtras] = useState<RegistrationExtras | null>(null);
  const [mealOption, setMealOption] = useState<MealOption | null>(null);
  const [sideEventRegs, setSideEventRegs] = useState<SideEventReg[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<TournamentExtra[]>([]);
  const [msg, setMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, loading, user]);

  useEffect(() => {
    if (!msg) return;

    const isError = /실패|오류|권한|필요|없습니다/.test(msg);
    toast({
      variant: isError ? "error" : "default",
      title: msg,
    });
    setMsg("");
  }, [msg, toast]);

  const fetchData = async () => {
    const supabase = createClient();
    if (!user) return;

    setIsLoading(true);
    setMsg("");

    // 1. 토너먼트 정보
    const tRes = await supabase
      .from("tournaments")
      .select("id,title,event_date,status")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${tRes.error.message}`);
      setIsLoading(false);
      return;
    }
    setT(tRes.data as Tournament);

    // 2. 내 신청 정보
    const regRes = await supabase
      .from("registrations")
      .select("id,nickname,status,approval_status,meal_option_id,memo,created_at")
      .eq("tournament_id", tournamentId)
      .eq("user_id", user.id)
      .single();

    if (regRes.error) {
      if (regRes.error.code === "PGRST116") {
        setMsg("아직 신청하지 않았습니다.");
      } else {
        setMsg(`신청 정보 조회 실패: ${regRes.error.message}`);
      }
      setIsLoading(false);
      return;
    }

    const reg = regRes.data as MyRegistration;
    setMyReg(reg);

    // 3. 추가 정보 (카풀 등)
    const extrasRes = await supabase
      .from("registration_extras")
      .select("carpool_available,carpool_seats,transportation,departure_location,notes")
      .eq("registration_id", reg.id)
      .single();

    if (!extrasRes.error && extrasRes.data) {
      setExtras(extrasRes.data as RegistrationExtras);
    }

    // 4. 식사 메뉴 정보
    if (reg.meal_option_id) {
      const mealRes = await supabase
        .from("tournament_meal_options")
        .select("id,menu_name")
        .eq("id", reg.meal_option_id)
        .single();

      if (!mealRes.error && mealRes.data) {
        setMealOption(mealRes.data as MealOption);
      }
    }

    // 5. 라운드 신청 현황 (본인 + 내가 등록한 제3자 포함)
    const myRegsRes = await supabase
      .from("registrations")
      .select("id,nickname,status")
      .eq("tournament_id", tournamentId)
      .eq("registering_user_id", user.id)
      .neq("status", "canceled");

    if (!myRegsRes.error && myRegsRes.data) {
      const myRegs = myRegsRes.data as Array<{
        id: number;
        nickname: string;
        status: string;
      }>;
      const regIdList = myRegs.map((r) => r.id);
      const regNameMap = new Map<number, string>(
        myRegs.map((r) => [r.id, r.nickname])
      );

      if (regIdList.length > 0) {
        const sideRes = await supabase
          .from("side_event_registrations")
          .select(
            "id,side_event_id,registration_id,status,memo,meal_selected,lodging_selected"
          )
          .in("registration_id", regIdList);

        if (!sideRes.error && sideRes.data) {
          const sideRegs = sideRes.data as Array<{
            id: number;
            side_event_id: number;
            registration_id: number;
            status: string;
            memo: string | null;
            meal_selected: boolean;
            lodging_selected: boolean;
          }>;

          const enrichedRegs: SideEventReg[] = [];
          for (const sr of sideRegs) {
            const seRes = await supabase
              .from("side_events")
              .select("id,tournament_id,title,round_type")
              .eq("id", sr.side_event_id)
              .single();

            if (
              !seRes.error &&
              seRes.data &&
              seRes.data.tournament_id === tournamentId
            ) {
              enrichedRegs.push({
                id: sr.id,
                side_event_id: sr.side_event_id,
                registration_id: sr.registration_id,
                participant_nickname:
                  regNameMap.get(sr.registration_id) ?? "알 수 없음",
                side_event_title: seRes.data.title,
                round_type: seRes.data.round_type,
                status: sr.status,
                memo: sr.memo,
                meal_selected: sr.meal_selected,
                lodging_selected: sr.lodging_selected,
              });
            }
          }
          setSideEventRegs(enrichedRegs);
        } else {
          setSideEventRegs([]);
        }
      } else {
        setSideEventRegs([]);
      }
    } else {
      setSideEventRegs([]);
    }

    // 6. 선택한 활동 조회
    const selectedRes = await supabase
      .from("registration_activity_selections")
      .select("extra_id")
      .eq("registration_id", reg.id)
      .eq("selected", true);

    if (!selectedRes.error && selectedRes.data) {
      const extraIds = selectedRes.data.map(
        (s: { extra_id: number }) => s.extra_id
      );
      
      if (extraIds.length > 0) {
        const extrasRes = await supabase
          .from("tournament_extras")
          .select("id,activity_name,description")
          .in("id", extraIds);

        if (!extrasRes.error && extrasRes.data) {
          setSelectedActivities(extrasRes.data as TournamentExtra[]);
        }
      }
    }

    setIsLoading(false);
  };

  if (loading || isLoading) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!t) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">대회를 찾을 수 없습니다</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!myReg) {
    return (
      <main className="min-h-screen bg-slate-50/70">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900">
              {t.title}
            </h1>
            <p className="text-sm text-slate-500">{t.event_date} · 내 참가 현황</p>
          </div>

          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-600">{msg || "아직 신청하지 않았습니다."}</p>
              <div className="mt-4">
                <Button asChild>
                  <Link href={`/t/${tournamentId}`}>신청하러 가기</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        {/* 헤더 */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">
            {t.title}
          </h1>
          <p className="text-sm text-slate-500">{t.event_date} · 내 참가 현황</p>
        </div>

        {/* 승인 상태 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>가입 승인 상태</CardTitle>
            <CardDescription>
              관리자의 승인 후 대회에 참가할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700">승인 상태:</span>
              {myReg.approval_status === "pending" && (
                <Badge variant="outline" className="bg-amber-50 text-amber-800">
                  승인 대기 중
                </Badge>
              )}
              {myReg.approval_status === "approved" && (
                <Badge className="bg-green-600">승인 완료</Badge>
              )}
              {myReg.approval_status === "rejected" && (
                <Badge variant="destructive">거절됨</Badge>
              )}
            </div>
            {myReg.approval_status === "pending" && (
              <p className="text-sm text-slate-600">
                관리자가 확인 중입니다. 잠시만 기다려주세요.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 참가 정보 */}
        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>본대회 참가 정보</CardTitle>
            <CardDescription>
              현재 신청 상태를 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-slate-700">닉네임</p>
                <p className="text-slate-900">{myReg.nickname}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">참가 상태</p>
                <Badge variant="secondary" className="capitalize">
                  {formatRegistrationStatus(myReg.status)}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">식사 선택</p>
                <p className="text-slate-900">
                  {mealOption ? mealOption.menu_name : "선택 안 함"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">신청일시</p>
                <p className="text-slate-900">
                  {new Date(myReg.created_at).toLocaleString("ko-KR")}
                </p>
              </div>
            </div>

            {myReg.memo && (
              <div>
                <p className="text-sm font-medium text-slate-700">메모</p>
                <p className="text-slate-900">{myReg.memo}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 추가 정보 (카풀 등) */}
        {extras && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>추가 정보</CardTitle>
              <CardDescription>
                카풀 및 이동 관련 정보입니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700">카풀 제공</p>
                <p className="text-slate-900">
                  {extras.carpool_available
                    ? `제공 가능 (${extras.carpool_seats}석)`
                    : "제공 안 함"}
                </p>
              </div>
              {extras.transportation && (
                <div>
                  <p className="text-sm font-medium text-slate-700">이동수단</p>
                  <p className="text-slate-900">{extras.transportation}</p>
                </div>
              )}
              {extras.departure_location && (
                <div>
                  <p className="text-sm font-medium text-slate-700">출발지</p>
                  <p className="text-slate-900">{extras.departure_location}</p>
                </div>
              )}
              {extras.notes && (
                <div>
                  <p className="text-sm font-medium text-slate-700">추가 비고</p>
                  <p className="text-slate-900">{extras.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 라운드 참가 현황 */}
        {sideEventRegs.length > 0 && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>라운드 참가 현황</CardTitle>
              <CardDescription>
                사전/사후 라운드 신청 상태입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sideEventRegs.map((sr) => (
                  <div
                    key={sr.id}
                    className="flex flex-col gap-2 border-b border-slate-100 pb-3 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {sr.round_type === "pre" ? "📍 사전" : "📍 사후"}{" "}
                          {sr.side_event_title}
                        </p>
                        <p className="text-xs text-slate-500">
                          참가자: {sr.participant_nickname}
                        </p>
                        {sr.memo && (
                          <p className="text-sm text-slate-600">{sr.memo}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {formatRegistrationStatus(sr.status)}
                      </Badge>
                    </div>
                    {(sr.meal_selected || sr.lodging_selected) && (
                      <div className="flex gap-2 text-xs text-slate-600">
                        {sr.meal_selected && (
                          <span className="rounded bg-blue-100 px-2 py-1">
                            식사 포함
                          </span>
                        )}
                        {sr.lodging_selected && (
                          <span className="rounded bg-green-100 px-2 py-1">
                            숙박 포함
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 참여 활동 */}
        {selectedActivities.length > 0 && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>참여 활동</CardTitle>
              <CardDescription>
                선택한 추가 활동입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-2 border-b border-slate-100 pb-2 last:border-0"
                  >
                    <span className="text-green-600">✓</span>
                    <div>
                      <p className="font-medium text-slate-900">
                        {activity.activity_name}
                      </p>
                      {activity.description && (
                        <p className="text-sm text-slate-600">
                          {activity.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/t/${tournamentId}`}>신청 정보 수정</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/`}>대회 목록</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
