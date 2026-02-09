"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  status: "applied" | "confirmed" | "waitlisted" | "canceled" | "undecided";
  memo: string | null;
  meal_option_id: number | null;
  relation: string | null;
};

type TournamentFile = {
  id: number;
  file_type: "groups" | "notice" | "other";
  file_name: string;
  storage_path: string;
  is_public: boolean;
};

type SideEvent = {
  id: number;
  round_type: "pre" | "post";
  title: string;
  tee_time: string | null;
  location: string | null;
  notes: string | null;
  max_participants: number | null;
  status: string;
  meal_option_id: number | null;
  lodging_available: boolean;
  lodging_required: boolean;
};

type SideEventRegistration = {
  id: number;
  user_id: string;
  nickname: string;
  status: "applied" | "confirmed" | "waitlisted" | "canceled";
  memo: string | null;
  meal_selected: boolean | null;
  lodging_selected: boolean | null;
};

type MealOption = {
  id: number;
  menu_name: string;
  is_active: boolean;
  display_order: number;
};

type RegistrationExtras = {
  carpool_available: boolean | null;
  carpool_seats: number | null;
  transportation: string | null;
  departure_location: string | null;
  notes: string | null;
};

type CarpoolPublic = {
  registration_id: number;
  nickname: string;
  carpool_available: boolean;
  carpool_seats: number | null;
};

type TournamentExtra = {
  id: number;
  activity_name: string;
  description: string | null;
  display_order: number;
};

type PrizeSupport = {
  id: number;
  supporter_id: string;
  supporter_name: string | null;
  item_name: string;
  note: string | null;
  created_at: string;
};

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const router = useRouter();

  const { user, loading } = useAuth();
  const [me, setMe] = useState<string>("");
  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [files, setFiles] = useState<TournamentFile[]>([]);
  const [sideEvents, setSideEvents] = useState<SideEvent[]>([]);
  const [sideEventRegs, setSideEventRegs] = useState<
    Map<number, SideEventRegistration[]>
  >(new Map());
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [tournamentExtras, setTournamentExtras] = useState<TournamentExtra[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<number[]>([]);
  const [nickname, setNickname] = useState("");
  const [relation, setRelation] = useState("본인");
  const [profileNickname, setProfileNickname] = useState("");
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [memo, setMemo] = useState("");
  const [mainStatus, setMainStatus] = useState<Registration["status"]>("applied");
  const [mainRegId, setMainRegId] = useState<number | null>(null);
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null);
  const [carpoolAvailable, setCarpoolAvailable] = useState<boolean | null>(null);
  const [carpoolSeats, setCarpoolSeats] = useState<number | null>(null);
  const [transportation, setTransportation] = useState("");
  const [departureLocation, setDepartureLocation] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [carpoolPublic, setCarpoolPublic] = useState<CarpoolPublic[]>([]);
  const [sideEventMealSelections, setSideEventMealSelections] = useState<Map<number, boolean | null>>(new Map());
  const [sideEventLodgingSelections, setSideEventLodgingSelections] = useState<Map<number, boolean | null>>(new Map());
  const [extraName, setExtraName] = useState("");
  const [extraRelation, setExtraRelation] = useState("");
  const [extraStatus, setExtraStatus] = useState<Registration["status"]>("applied");
  const [extraMemo, setExtraMemo] = useState("");
  const [prizes, setPrizes] = useState<PrizeSupport[]>([]);
  const [prizeItem, setPrizeItem] = useState("");
  const [prizeNote, setPrizeNote] = useState("");
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
        .select("nickname,is_approved")
        .eq("id", uid)
        .single();

      if (!pRes.error) {
        const nick = (pRes.data?.nickname ?? "").toString();
        setProfileNickname(nick);
        setIsApproved(pRes.data?.is_approved ?? null);
        // 프로필 닉네임을 사용 (registration의 nickname 무시)
      }
    } else {
      setProfileNickname("");
      setIsApproved(null);
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

    let mainRegIdForExtras: number | null = null;

    const rRes = await supabase
      .from("registrations")
      .select("id,user_id,nickname,status,memo,meal_option_id,relation")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: true });

    if (rRes.error) {
      setMsg(`신청 현황 조회 실패: ${friendlyError(rRes.error)}`);
    } else {
      const regList = (rRes.data ?? []) as Registration[];
      const myRegs = uid ? regList.filter((r) => r.user_id === uid) : [];
      const activeMyRegs = myRegs.filter((r) => r.status !== "canceled");
      const preferredMain =
        activeMyRegs.find((r) => (r.relation ?? "").trim() === "본인") ??
        activeMyRegs[0] ??
        myRegs.find((r) => (r.relation ?? "").trim() === "본인") ??
        myRegs[0];

      mainRegIdForExtras = preferredMain?.id ?? null;

      setMainRegId(preferredMain?.id ?? null);
      setMainStatus(preferredMain?.status ?? "applied");
      setRelation(preferredMain?.relation ?? "본인");

      if (preferredMain) {
        // 본인 신청 정보 로드
        setMemo(preferredMain.memo ?? "");
        setSelectedMealId(preferredMain.meal_option_id ?? null);

        const extraRes = await supabase
          .from("registration_extras")
          .select(
            "carpool_available,carpool_seats,transportation,departure_location,notes"
          )
          .eq("registration_id", preferredMain.id)
          .single();

        if (!extraRes.error && extraRes.data) {
          const extras = extraRes.data as RegistrationExtras;
          setCarpoolAvailable(extras.carpool_available ?? null);
          setCarpoolSeats(extras.carpool_seats ?? null);
          setTransportation(extras.transportation ?? "");
          setDepartureLocation(extras.departure_location ?? "");
          setExtraNotes(extras.notes ?? "");
        } else {
          setCarpoolAvailable(null);
          setCarpoolSeats(null);
          setTransportation("");
          setDepartureLocation("");
          setExtraNotes("");
        }
      } else {
        setMemo("");
        setSelectedMealId(null);
        setCarpoolAvailable(null);
        setCarpoolSeats(null);
        setTransportation("");
        setDepartureLocation("");
        setExtraNotes("");
      }

      setRegs(regList);
    }

    const fRes = await supabase
      .from("tournament_files")
      .select("id,file_type,file_name,storage_path,is_public")
      .eq("tournament_id", tournamentId)
      .eq("is_public", true)
      .order("id", { ascending: true });

    if (fRes.error) setMsg(`파일 조회 실패: ${friendlyError(fRes.error)}`);
    else setFiles((fRes.data ?? []) as TournamentFile[]);

    // Load side events for this tournament
    const seRes = await supabase
      .from("side_events")
      .select("id,round_type,title,tee_time,location,notes,max_participants,status,meal_option_id,lodging_available,lodging_required")
      .eq("tournament_id", tournamentId)
      .order("round_type,id", { ascending: true });

    if (seRes.error)
      setMsg(`라운드 조회 실패: ${friendlyError(seRes.error)}`);
    else {
      setSideEvents((seRes.data ?? []) as SideEvent[]);

      // Load registrations for each side event
      const seRegMap = new Map<number, SideEventRegistration[]>();
      for (const se of (seRes.data ?? []) as SideEvent[]) {
        const serRes = await supabase
          .from("side_event_registrations")
          .select("id,user_id,nickname,status,memo,meal_selected,lodging_selected")
          .eq("side_event_id", se.id)
          .order("id", { ascending: true });

        if (!serRes.error) {
          seRegMap.set(se.id, (serRes.data ?? []) as SideEventRegistration[]);
        }
      }
      setSideEventRegs(seRegMap);
    }

    // Load meal options for this tournament
    const mealRes = await supabase
      .from("tournament_meal_options")
      .select("id,menu_name,is_active,display_order")
      .eq("tournament_id", tournamentId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!mealRes.error) {
      setMealOptions((mealRes.data ?? []) as MealOption[]);
    }

    const carpoolRes = await supabase.rpc("get_carpool_public", {
      p_tournament_id: tournamentId,
    });

    if (!carpoolRes.error) {
      setCarpoolPublic((carpoolRes.data ?? []) as CarpoolPublic[]);
    } else {
      setCarpoolPublic([]);
    }

    const prizeRes = await supabase
      .from("tournament_prize_supports")
      .select("id,user_id,item_name,note,created_at,profiles(nickname)")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (!prizeRes.error) {
      const mapped = (prizeRes.data ?? []).map((row: any) => ({
        id: row.id,
        supporter_id: row.user_id,
        supporter_name: row.profiles?.nickname ?? null,
        item_name: row.item_name,
        note: row.note ?? null,
        created_at: row.created_at,
      }));
      setPrizes(mapped as PrizeSupport[]);
    } else {
      setPrizes([]);
    }

    // Load tournament extras (활동)
    const extrasRes = await supabase
      .from("tournament_extras")
      .select("id,activity_name,description,display_order")
      .eq("tournament_id", tournamentId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (!extrasRes.error) {
      setTournamentExtras((extrasRes.data ?? []) as TournamentExtra[]);
    }

    // Load user's selected extras
    if (uid && mainRegIdForExtras) {
      const selectedRes = await supabase
        .from("registration_activity_selections")
        .select("extra_id")
        .eq("registration_id", mainRegIdForExtras)
        .eq("selected", true);

      if (!selectedRes.error && selectedRes.data) {
        setSelectedExtras(selectedRes.data.map((s: any) => s.extra_id));
      } else {
        setSelectedExtras([]);
      }
    } else {
      setSelectedExtras([]);
    }
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
    if (isApproved === false) {
      setMsg("관리자 승인 대기 상태입니다. 승인 후 신청할 수 있어요.");
      return;
    }
    const nick = profileNickname.trim();
    if (!nick) {
      setMsg("프로필 닉네임이 설정되지 않았습니다. 프로필 페이지에서 설정해주세요.");
      return;
    }

    let registrationId: number | undefined;
    const existingMain =
      (mainRegId ? regs.find((r) => r.id === mainRegId) : undefined) ??
      regs.find(
        (r) => r.user_id === uid && (r.relation ?? "").trim() === "본인"
      ) ??
      regs.find((r) => r.user_id === uid);

    if (existingMain) {
      const nextStatus =
        existingMain.status === "canceled" ? mainStatus : mainStatus;
      const { data, error } = await supabase
        .from("registrations")
        .update({
          nickname: nick,
          memo: memo.trim() || null,
          meal_option_id: selectedMealId,
          relation: "본인",
          status: nextStatus,
        })
        .eq("id", existingMain.id)
        .select("id")
        .single();

      if (error) {
        setMsg(`수정 실패: ${friendlyError(error)}`);
        return;
      }

      registrationId = data?.id;
      setMsg(
        existingMain.status === "canceled"
          ? "재신청 완료!"
          : "신청 정보가 수정되었습니다!"
      );
    } else {
      // 신청이 없거나 canceled면 INSERT
      const { data, error } = await supabase
        .from("registrations")
        .insert({
          tournament_id: tournamentId,
          user_id: uid,
          nickname: nick,
          memo: memo.trim() || null,
          meal_option_id: selectedMealId,
          relation: "본인",
          status: mainStatus,
        })
        .select("id")
        .single();

      if (error) {
        setMsg(`신청 실패: ${friendlyError(error)}`);
        return;
      }

      registrationId = data?.id;
      setMsg("신청 완료!");
    }

    // 추가 정보(카풀 등) 저장
    if (registrationId) {
      const saved = await upsertExtras(registrationId);
      if (!saved) return;

      const activitySaved = await upsertActivitySelections(registrationId);
      if (!activitySaved) return;
    }

    await refresh();
  };

  const cancelMine = async () => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    const mine = mainRegId ? regs.find((r) => r.id === mainRegId) : undefined;
    if (!mine) {
      setMsg("대표 참가자 신청 내역이 없어.");
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

  const addParticipant = async () => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("추가 참가자를 등록하려면 로그인 필요");
      return;
    }
    if (isApproved === false) {
      setMsg("관리자 승인 대기 상태입니다. 승인 후 신청할 수 있어요.");
      return;
    }

    const name = extraName.trim();
    if (!name) {
      setMsg("추가 참가자 이름을 입력해줘.");
      return;
    }

    const rel = extraRelation.trim() || null;
    const status = extraStatus === "canceled" ? "applied" : extraStatus;

    const { error } = await supabase
      .from("registrations")
      .insert({
        tournament_id: tournamentId,
        user_id: uid,
        nickname: name,
        relation: rel,
        memo: extraMemo.trim() || null,
        status,
      });

    if (error) {
      setMsg(`추가 참가자 등록 실패: ${friendlyError(error)}`);
      return;
    }

    setExtraName("");
    setExtraRelation("");
    setExtraStatus("applied");
    setExtraMemo("");
    setMsg("추가 참가자가 등록되었습니다.");
    await refresh();
  };

  const cancelParticipant = async (registrationId: number) => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    const target = regs.find((r) => r.id === registrationId && r.user_id === uid);
    if (!target) {
      setMsg("참가자 정보를 찾을 수 없습니다.");
      return;
    }

    const { error } = await supabase
      .from("registrations")
      .update({ status: "canceled" })
      .eq("id", target.id);

    if (error) {
      setMsg(`취소 실패: ${friendlyError(error)}`);
    } else {
      setMsg("참가 취소 완료");
      await refresh();
    }
  };

  const addPrizeSupport = async () => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("경품 지원을 등록하려면 로그인 필요");
      return;
    }

    const item = prizeItem.trim();
    if (!item) {
      setMsg("지원할 경품 내용을 입력해줘.");
      return;
    }

    const { error } = await supabase
      .from("tournament_prize_supports")
      .insert({
        tournament_id: tournamentId,
        user_id: uid,
        item_name: item,
        note: prizeNote.trim() || null,
      });

    if (error) {
      setMsg(`경품 지원 등록 실패: ${friendlyError(error)}`);
      return;
    }

    setPrizeItem("");
    setPrizeNote("");
    setMsg("경품 지원이 등록되었습니다.");
    await refresh();
  };

  const upsertExtras = async (registrationId: number) => {
    const { error } = await supabase.from("registration_extras").upsert(
      {
        registration_id: registrationId,
        carpool_available: carpoolAvailable,
        carpool_seats: carpoolAvailable === true ? carpoolSeats : null,
        transportation: transportation.trim() || null,
        departure_location: departureLocation.trim() || null,
        notes: extraNotes.trim() || null,
      },
      { onConflict: "registration_id" }
    );

    if (error) {
      setMsg(`추가정보 저장 실패: ${friendlyError(error)}`);
      return false;
    }

    return true;
  };

  const upsertActivitySelections = async (registrationId: number) => {
    // 기존 선택 모두 삭제
    await supabase
      .from("registration_activity_selections")
      .delete()
      .eq("registration_id", registrationId);

    // 새 선택 추가
    if (selectedExtras.length > 0) {
      const insertData = selectedExtras.map((extraId) => ({
        registration_id: registrationId,
        extra_id: extraId,
        selected: true,
      }));

      const { error } = await supabase
        .from("registration_activity_selections")
        .insert(insertData);

      if (error) {
        setMsg(`활동 선택 저장 실패: ${friendlyError(error)}`);
        return false;
      }
    }

    return true;
  };

  const saveExtras = async () => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    const mine = mainRegId ? regs.find((r) => r.id === mainRegId) : undefined;
    if (!mine || mine.status === "canceled") {
      setMsg("대표 참가자 신청이 필요합니다.");
      return;
    }

    // 식사 메뉴와 메모 업데이트
    const { error: regError } = await supabase
      .from("registrations")
      .update({
        meal_option_id: selectedMealId,
        memo: memo.trim() || null,
      })
      .eq("id", mine.id);

    if (regError) {
      setMsg(`정보 저장 실패: ${friendlyError(regError)}`);
      return;
    }

    // 추가 정보(카풀) 업데이트
    const saved = await upsertExtras(mine.id);
    if (!saved) return;

    // 활동 선택 업데이트
    const activitySaved = await upsertActivitySelections(mine.id);
    if (!activitySaved) return;

    setMsg("정보가 저장되었습니다");
    await refresh();
  };

  const applySideEvent = async (sideEventId: number) => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("신청하려면 로그인 필요! (/login)");
      return;
    }
    if (isApproved === false) {
      setMsg("관리자 승인 대기 상태입니다. 승인 후 신청할 수 있어요.");
      return;
    }
    const nick = nickname.trim() || profileNickname.trim();
    if (!nick) {
      setMsg("닉네임을 입력해줘.");
      return;
    }

    const mealSelected = sideEventMealSelections.get(sideEventId) ?? null;
    const lodgingSelected = sideEventLodgingSelections.get(sideEventId) ?? null;

    const existing = (sideEventRegs.get(sideEventId) ?? []).find(
      (r) => r.user_id === uid
    );

    if (existing) {
      const { error } = await supabase
        .from("side_event_registrations")
        .update({
          nickname: nick,
          memo: memo.trim() || null,
          status: "applied",
          meal_selected: mealSelected,
          lodging_selected: lodgingSelected,
        })
        .eq("id", existing.id);

      if (error) {
        setMsg(`라운드 신청 실패: ${friendlyError(error)}`);
        return;
      }

      setMsg(
        existing.status === "canceled"
          ? "라운드 재신청 완료!"
          : "라운드 신청 정보가 수정되었습니다!"
      );
      await refresh();
      return;
    }

    const { error } = await supabase
      .from("side_event_registrations")
      .insert({
        side_event_id: sideEventId,
        user_id: uid,
        nickname: nick,
        memo: memo.trim() || null,
        status: "applied",
        meal_selected: mealSelected,
        lodging_selected: lodgingSelected,
      });

    if (error) setMsg(`라운드 신청 실패: ${friendlyError(error)}`);
    else {
      setMsg("라운드 신청 완료!");
      await refresh();
    }
  };

  const cancelSideEventMine = async (sideEventId: number) => {
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    const regs = sideEventRegs.get(sideEventId) ?? [];
    const mine = regs.find((r) => r.user_id === uid);
    if (!mine) {
      setMsg("이 라운드의 신청 내역이 없어.");
      return;
    }

    const { error } = await supabase
      .from("side_event_registrations")
      .update({ status: "canceled" })
      .eq("id", mine.id);

    if (error) setMsg(`취소 실패: ${friendlyError(error)}`);
    else {
      setMsg("라운드 취소 완료");
      await refresh();
    }
  };

  const myParticipantList = regs.filter(
    (r) => r.user_id === me && r.id !== mainRegId
  );
  const hasActiveRegistration = regs.some(
    (r) => r.user_id === me && r.status !== "canceled"
  );

  const formatStatus = (status: Registration["status"]) => {
    if (status === "undecided") return "미정";
    if (status === "applied") return "신청";
    if (status === "confirmed") return "확정";
    if (status === "waitlisted") return "대기";
    if (status === "canceled") return "취소";
    return status;
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
                    <label className="text-sm font-medium">닉네임 (프로필)</label>
                    <Input
                      value={profileNickname || "닉네임 없음"}
                      disabled
                      className="bg-slate-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">
                      닉네임 변경은 프로필 페이지에서 가능합니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">참가 상태</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={mainStatus}
                      onChange={(e) =>
                        setMainStatus(e.target.value as Registration["status"])
                      }
                    >
                      <option value="applied">신청</option>
                      <option value="undecided">미정</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">메모(선택)</label>
                    <Input
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">카풀 제공</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={
                        carpoolAvailable === null
                          ? "undecided"
                          : carpoolAvailable
                          ? "yes"
                          : "no"
                      }
                      onChange={(e) => {
                        if (e.target.value === "undecided") {
                          setCarpoolAvailable(null);
                          setCarpoolSeats(null);
                        } else if (e.target.value === "yes") {
                          setCarpoolAvailable(true);
                        } else {
                          setCarpoolAvailable(false);
                          setCarpoolSeats(null);
                        }
                      }}
                    >
                      <option value="undecided">미정</option>
                      <option value="yes">제공 가능</option>
                      <option value="no">제공 안 함</option>
                    </select>
                  </div>

                  {carpoolAvailable === true && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">제공 좌석 수</label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={carpoolSeats ?? ""}
                        onChange={(e) =>
                          setCarpoolSeats(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">선택</option>
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n}석
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">이동수단</label>
                    <Input
                      value={transportation}
                      onChange={(e) => setTransportation(e.target.value)}
                      placeholder="예: 자차, 카풀, 대중교통 (선택사항)"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setTransportation("미정")}
                      className="text-xs"
                    >
                      "미정"으로 입력
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">출발지</label>
                    <Input
                      value={departureLocation}
                      onChange={(e) => setDepartureLocation(e.target.value)}
                      placeholder="예: 강남역 (선택사항)"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDepartureLocation("미정")}
                      className="text-xs"
                    >
                      "미정"으로 입력
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">추가 비고</label>
                    <textarea
                      className="min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      value={extraNotes}
                      onChange={(e) => setExtraNotes(e.target.value)}
                      placeholder="추가 요청사항이 있다면 적어주세요"
                    />
                  </div>

                  {mealOptions.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">식사 메뉴 선택</label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={selectedMealId ?? ""}
                        onChange={(e) => setSelectedMealId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">미정</option>
                        {mealOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.menu_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {tournamentExtras.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">참여 활동 선택 (선택사항)</label>
                      <div className="space-y-2 rounded-md border border-slate-200 p-3">
                        {tournamentExtras.map((extra) => (
                          <label key={extra.id} className="flex items-start gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4"
                              checked={selectedExtras.includes(extra.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExtras([...selectedExtras, extra.id]);
                                } else {
                                  setSelectedExtras(selectedExtras.filter((id) => id !== extra.id));
                                }
                              }}
                            />
                            <div>
                              <span className="font-medium">{extra.activity_name}</span>
                              {extra.description && (
                                <p className="text-xs text-slate-500">{extra.description}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        {selectedExtras.length} / {tournamentExtras.length}개 선택됨
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={apply} size="sm">
                      {regs.find((r) => r.user_id === user?.id && r.status !== "canceled") ? "정보 수정" : "신청하기"}
                    </Button>
                    <Button onClick={saveExtras} variant="secondary" size="sm">
                      저장
                    </Button>
                    <Button onClick={cancelMine} variant="outline" size="sm">
                      신청 취소
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/t/${tournamentId}/participants`}>
                        참가자 현황
                      </Link>
                    </Button>
                    <Button onClick={refresh} variant="ghost" size="sm">
                      새로고침
                    </Button>
                  </div>

                  {msg && <p className="text-sm text-slate-600">{msg}</p>}
                </CardContent>
              </Card>

              {user && myParticipantList.length > 0 && (
                <Card className="border-slate-200/70">
                  <CardHeader>
                    <CardTitle>내 참가자 목록</CardTitle>
                    <CardDescription>
                      내 계정으로 신청한 모든 참가자입니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto -mx-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>닉네임</TableHead>
                            <TableHead>관계</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead>작업</TableHead>
                          </TableRow>
                        </TableHeader>
                      <TableBody>
                        {myParticipantList.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.nickname}</TableCell>
                            <TableCell>{p.relation ?? "-"}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{formatStatus(p.status)}</Badge>
                            </TableCell>
                            <TableCell>
                              {p.status !== "canceled" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelParticipant(p.id)}
                                >
                                  취소
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <h3 className="font-medium text-sm">추가 참가자 등록</h3>
                      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">닉네임</label>
                          <Input
                            value={extraName}
                            onChange={(e) => setExtraName(e.target.value)}
                            placeholder="참가자 이름"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">관계</label>
                          <Input
                            value={extraRelation}
                            onChange={(e) => setExtraRelation(e.target.value)}
                            placeholder="예: 가족, 지인"
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">상태</label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            value={extraStatus}
                            onChange={(e) =>
                              setExtraStatus(e.target.value as Registration["status"])
                            }
                          >
                            <option value="applied">신청</option>
                            <option value="undecided">미정</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">메모</label>
                          <Input
                            value={extraMemo}
                            onChange={(e) => setExtraMemo(e.target.value)}
                            placeholder="선택사항"
                          />
                        </div>
                      </div>
                      <Button onClick={addParticipant} size="sm">
                        추가 참가자 등록
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="border-slate-200/70">
              <CardHeader>
                <CardTitle>카풀 매칭 현황</CardTitle>
                <CardDescription>
                  로그인 사용자에게 카풀 가능/좌석만 공개됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {carpoolPublic.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    카풀 제공자가 아직 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-6">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>닉네임</TableHead>
                        <TableHead>제공 좌석</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {carpoolPublic.map((row) => (
                        <TableRow key={row.registration_id}>
                          <TableCell>{row.nickname}</TableCell>
                          <TableCell>
                            {row.carpool_seats ? `${row.carpool_seats}석` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {user && (
              <Card className="border-slate-200/70">
                <CardHeader>
                  <CardTitle>경품 지원 현황</CardTitle>
                  <CardDescription>
                    대회를 위해 경품을 지원해주신 분들입니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {prizes.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      아직 등록된 경품이 없습니다.
                    </p>
                  ) : (
                    <div className="overflow-x-auto -mx-6">
                      <Table>
                        <TableHeader>
                          <TableRow>
                          <TableHead>지원자</TableHead>
                          <TableHead>경품명</TableHead>
                          <TableHead>비고</TableHead>
                          <TableHead>등록일</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prizes.map((prize) => (
                          <TableRow key={prize.id}>
                            <TableCell>{prize.supporter_name ?? "익명"}</TableCell>
                            <TableCell>{prize.item_name}</TableCell>
                            <TableCell>{prize.note ?? "-"}</TableCell>
                            <TableCell>
                              {new Date(prize.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-3">
                    <h3 className="font-medium text-sm">경품 지원하기</h3>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">경품명</label>
                        <Input
                          value={prizeItem}
                          onChange={(e) => setPrizeItem(e.target.value)}
                          placeholder="예: 골프공 1박스"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">비고</label>
                        <Input
                          value={prizeNote}
                          onChange={(e) => setPrizeNote(e.target.value)}
                          placeholder="선택사항"
                        />
                      </div>
                    </div>
                    <Button onClick={addPrizeSupport} size="sm">
                      경품 등록
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

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

            <Card className="border-slate-200/70">
              <CardHeader>
                <CardTitle>조편성</CardTitle>
                <CardDescription>공개된 조편성을 확인하세요.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={`/t/${tournamentId}/groups`}>조편성 보기</Link>
                </Button>
              </CardContent>
            </Card>

            {sideEvents.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  사전/사후 라운드
                </h2>
                {sideEvents.map((se) => {
                  const seRegs = sideEventRegs.get(se.id) ?? [];
                  return (
                    <Card key={se.id} className="border-slate-200/70">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-3">
                          <span>
                            {se.round_type === "pre" ? "📍 사전" : "📍 사후"}{" "}
                            {se.title}
                          </span>
                          <Badge variant="secondary" className="capitalize">
                            {se.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {se.tee_time && `${se.tee_time} · `}
                          {se.location ?? "-"}
                          {se.max_participants &&
                            ` · 최대 ${se.max_participants}명`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {se.notes && (
                          <p className="text-sm text-slate-600">{se.notes}</p>
                        )}

                        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                          <div className="space-y-3">
                            <h3 className="font-medium">라운드 신청</h3>

                            {/* Meal option selection */}
                            {se.meal_option_id && (
                              <div className="space-y-1">
                                <label className="text-sm font-medium">식사 참여</label>
                                <select
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  value={
                                    sideEventMealSelections.get(se.id) === null
                                      ? "undecided"
                                      : sideEventMealSelections.get(se.id)
                                      ? "yes"
                                      : "no"
                                  }
                                  onChange={(e) => {
                                    const newMap = new Map(sideEventMealSelections);
                                    if (e.target.value === "undecided") {
                                      newMap.set(se.id, null);
                                    } else {
                                      newMap.set(se.id, e.target.value === "yes");
                                    }
                                    setSideEventMealSelections(newMap);
                                  }}
                                >
                                  <option value="undecided">미정</option>
                                  <option value="yes">참여</option>
                                  <option value="no">불참</option>
                                </select>
                                <p className="text-xs text-slate-500">
                                  라운드 참여 시 식사를 포함합니다.
                                </p>
                              </div>
                            )}

                            {/* Lodging selection */}
                            {se.lodging_available && (
                              <div className="space-y-1">
                                <label className="text-sm font-medium">
                                  숙박 참여 {se.lodging_required && "(필수)"}
                                </label>
                                <select
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  value={
                                    sideEventLodgingSelections.get(se.id) === null
                                      ? "undecided"
                                      : sideEventLodgingSelections.get(se.id)
                                      ? "yes"
                                      : "no"
                                  }
                                  onChange={(e) => {
                                    const newMap = new Map(sideEventLodgingSelections);
                                    if (e.target.value === "undecided") {
                                      newMap.set(se.id, null);
                                    } else {
                                      newMap.set(se.id, e.target.value === "yes");
                                    }
                                    setSideEventLodgingSelections(newMap);
                                  }}
                                >
                                  <option value="undecided">미정</option>
                                  <option value="yes">참여</option>
                                  <option value="no">불참</option>
                                </select>
                                <p className="text-xs text-slate-500">
                                  {se.lodging_required
                                    ? "이 라운드는 숙박이 필수입니다."
                                    : "라운드 참여 시 숙박을 포함합니다."}
                                </p>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => applySideEvent(se.id)}
                                size="sm"
                              >
                                신청
                              </Button>
                              <Button
                                onClick={() => cancelSideEventMine(se.id)}
                                size="sm"
                                variant="outline"
                              >
                                취소
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
