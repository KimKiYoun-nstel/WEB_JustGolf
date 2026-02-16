"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabaseClient";
import { useAuth } from "../../../lib/auth";
import { TOURNAMENT_FILES_BUCKET } from "../../../lib/storage";
import { formatRegistrationStatus, formatTournamentStatus } from "../../../lib/statusLabels";
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
import { useToast } from "../../../components/ui/toast";
import { TableOfContents, useTableOfContents, type TOCItem } from "../../../components/TableOfContents";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  tee_time: string | null;
  notes: string | null;
  status: string;
};

type Registration = {
  id: number;
  user_id: string | null;                     // NULL이면 제3자
  registering_user_id: string;                 // 실제 신청한 회원
  nickname: string;
  status: "applied" | "approved" | "waitlisted" | "canceled" | "undecided";
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
  side_event_id: number;
  registration_id: number;
  user_id: string | null;
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

type TournamentExtra = {
  id: number;
  activity_name: string;
  description: string | null;
  display_order: number;
};

type ActivitySelection = {
  extra_id: number;
};

type PrizeSupport = {
  id: number;
  item_name: string;
  note: string | null;
  created_at: string;
};


export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const supabase = createClient();

  const { user, loading } = useAuth();
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
  const [sideEventMealSelections, setSideEventMealSelections] = useState<Map<number, boolean | null>>(new Map());
  const [sideEventLodgingSelections, setSideEventLodgingSelections] = useState<Map<number, boolean | null>>(new Map());
  const [sideEventTargetRegistrationIds, setSideEventTargetRegistrationIds] =
    useState<Map<number, number | null>>(new Map());
  const [extraName, setExtraName] = useState("");
  const [extraRelation, setExtraRelation] = useState("");
  const [extraStatus, setExtraStatus] = useState<Registration["status"]>("applied");
  const [extraMemo, setExtraMemo] = useState("");
  const [extraMealId, setExtraMealId] = useState<number | null>(null);
  const [extraActivityIds, setExtraActivityIds] = useState<number[]>([]);
  const [prizeItem, setPrizeItem] = useState("");
  const [prizeNote, setPrizeNote] = useState("");
  const [prizeSupports, setPrizeSupports] = useState<PrizeSupport[]>([]);
  const [editingPrizeId, setEditingPrizeId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<Registration | null>(null);
  const [editName, setEditName] = useState("");
  const [editRelation, setEditRelation] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editMealId, setEditMealId] = useState<number | null>(null);
  const [editActivityIds, setEditActivityIds] = useState<number[]>([]);
  const [isApplySheetOpen, setIsApplySheetOpen] = useState(false);
  const [isAddParticipantSheetOpen, setIsAddParticipantSheetOpen] =
    useState(false);
  const { toast } = useToast();

  const friendlyError = (error: { code?: string; message: string }) => {
    if (error.code === "23505") return "이미 신청했습니다.";
    if (error.code === "42501") return "권한이 없어요. 로그인 상태를 확인해줘.";
    if (error.message.toLowerCase().includes("permission")) {
      return "권한이 없어요. 로그인 상태를 확인해줘.";
    }
    return error.message;
  };

  useEffect(() => {
    if (!msg) return;

    const normalized = msg.replace(/^✅\s*/, "");
    const isSuccess = msg.startsWith("✅") || /저장되었습니다|완료|변경되었습니다/.test(msg);
    const isError = /실패|오류|권한|필요|없습니다|중복/.test(msg);

    toast({
      variant: isSuccess ? "success" : isError ? "error" : "default",
      title: normalized,
    });
    setMsg("");
  }, [msg, toast]);

  const refresh = async () => {
    const supabase = createClient();
    setMsg("");
    const uid = user?.id ?? "";

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
      .select("id,title,event_date,course_name,location,tee_time,notes,status")
      .eq("id", tournamentId)
      .single();

    if (tRes.error) {
      setMsg(`대회 조회 실패: ${tRes.error.message}`);
      return;
    }
    setT(tRes.data as Tournament);

    let mainRegIdForExtras: number | null = null;
    let activeMyRegIds: number[] = [];

    const rRes = await supabase
      .from("registrations")
      .select("id,user_id,registering_user_id,nickname,status,memo,meal_option_id,relation")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: true });

    if (rRes.error) {
      setMsg(`신청 현황 조회 실패: ${friendlyError(rRes.error)}`);
    } else {
      const regList = (rRes.data ?? []) as Registration[];
      // 내가 등록한 모든 참가자 (본인 + 제3자)
      const myRegs = uid ? regList.filter((r) => r.registering_user_id === uid) : [];
      const activeMyRegs = myRegs.filter((r) => r.status !== "canceled");
      activeMyRegIds = activeMyRegs.map((r) => r.id);
      
      // 본인 등록 찾기 (user_id === uid)
      const preferredMain =
        activeMyRegs.find((r) => r.user_id === uid) ??
        myRegs.find((r) => r.user_id === uid);

      mainRegIdForExtras = preferredMain?.id ?? null;

      setMainRegId(preferredMain?.id ?? null);
      setMainStatus(preferredMain?.status ?? "applied");

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
      const sideEvents = (seRes.data ?? []) as SideEvent[];
      setSideEvents(sideEvents);

      // Load registrations for each side event in a single query
      const seRegMap = new Map<number, SideEventRegistration[]>();
      const defaultTargetRegId = mainRegIdForExtras ?? activeMyRegIds[0] ?? null;
      const nextTargetMap = new Map<number, number | null>();
      const nextMealMap = new Map<number, boolean | null>();
      const nextLodgingMap = new Map<number, boolean | null>();
      const sideEventIds = sideEvents.map((se) => se.id);

      if (sideEventIds.length > 0) {
        const serRes = await supabase
          .from("side_event_registrations")
          .select(
            "id,side_event_id,registration_id,user_id,nickname,status,memo,meal_selected,lodging_selected"
          )
          .in("side_event_id", sideEventIds)
          .order("side_event_id", { ascending: true })
          .order("id", { ascending: true });

        if (!serRes.error) {
          const seRows = (serRes.data ?? []) as SideEventRegistration[];
          for (const row of seRows) {
            const bucket = seRegMap.get(row.side_event_id) ?? [];
            bucket.push(row);
            seRegMap.set(row.side_event_id, bucket);
          }
        }
      }

      for (const se of sideEvents) {
        const seRows = seRegMap.get(se.id) ?? [];
        const prevTargetRegId = sideEventTargetRegistrationIds.get(se.id) ?? null;
        const resolvedTargetRegId =
          prevTargetRegId && activeMyRegIds.includes(prevTargetRegId)
            ? prevTargetRegId
            : defaultTargetRegId;

        nextTargetMap.set(se.id, resolvedTargetRegId);
        const myDefaultSideReg = resolvedTargetRegId
          ? seRows.find((row) => row.registration_id === resolvedTargetRegId)
          : undefined;
        nextMealMap.set(se.id, myDefaultSideReg?.meal_selected ?? null);
        nextLodgingMap.set(se.id, myDefaultSideReg?.lodging_selected ?? null);
      }

      setSideEventRegs(seRegMap);
      setSideEventTargetRegistrationIds(nextTargetMap);
      setSideEventMealSelections(nextMealMap);
      setSideEventLodgingSelections(nextLodgingMap);
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
        setSelectedExtras(
          (selectedRes.data as ActivitySelection[]).map((s) => s.extra_id)
        );
      } else {
        setSelectedExtras([]);
      }
    } else {
      setSelectedExtras([]);
    }

    if (uid) {
      const prizeRes = await supabase
        .from("tournament_prize_supports")
        .select("id,item_name,note,created_at")
        .eq("tournament_id", tournamentId)
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (!prizeRes.error) {
        setPrizeSupports((prizeRes.data ?? []) as PrizeSupport[]);
      } else {
        setPrizeSupports([]);
      }
    } else {
      setPrizeSupports([]);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    if (loading) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, loading, user?.id]);

  const apply = async () => {
    const supabase = createClient();
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
    
    // 대회 상태 확인
    if (!t) {
      setMsg("대회 정보를 찾을 수 없습니다.");
      return;
    }
    if (t.status !== "open") {
      const statusLabel = 
        t.status === "draft" ? "아직 모집을 시작하지 않은" :
        t.status === "closed" ? "모집을 마감한" :
        t.status === "done" ? "완료된" :
        t.status === "deleted" ? "삭제된" :
        "";
      setMsg(`${statusLabel} 대회입니다. 신청할 수 없습니다.`);
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
          registering_user_id: uid,        // 본인 신청
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
      if (!saved) {
        setLoadingAction(null);
        return;
      }

      const activitySaved = await upsertActivitySelections(registrationId);
      if (!activitySaved) {
        setLoadingAction(null);
        return;
      }
    }

    setLoadingAction(null);
    setMsg("✅ 신청이 완료되었습니다.");
    await refresh();
  };

  const cancelMine = async () => {
    const supabase = createClient();
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

    if (!confirm(`${mine.nickname}님의 신청을 삭제하시겠습니까?`)) {
      return;
    }

    setLoadingAction('cancel-main');

    const { error } = await supabase
      .from("registrations")
      .delete()
      .eq("id", mine.id);

    setLoadingAction(null);

    if (error) setMsg(`삭제 실패: ${friendlyError(error)}`);
    else {
      setMsg("✅ 신청이 삭제되었습니다.");
      await refresh();
    }
  };

  const addParticipant = async () => {
    const supabase = createClient();
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
      setMsg("닉네임을 입력해주세요.");
      return;
    }

    const nameLower = name.toLowerCase();
    const duplicate = regs.find((r) => r.nickname.trim().toLowerCase() === nameLower);
    if (duplicate) {
      setMsg("이미 사용 중인 닉네임입니다.");
      return;
    }

    const rel = extraRelation.trim() || null;
    const status = extraStatus === "canceled" ? "applied" : extraStatus;

    const { data, error } = await supabase
      .from("registrations")
      .insert({
        tournament_id: tournamentId,
        user_id: null,                    // 제3자는 NULL
        registering_user_id: uid,         // 실제 신청한 회원
        nickname: name,
        relation: rel,
        memo: extraMemo.trim() || null,
        meal_option_id: extraMealId,
        status,
      })
      .select("id")
      .single();

    if (error) {
      setMsg(`추가 참가자 등록 실패: ${friendlyError(error)}`);
      return;
    }

    const registrationId = data?.id;
    if (!registrationId) {
      setMsg("등록 ID를 가져올 수 없습니다.");
      return;
    }

    // 참여 활동 저장
    if (extraActivityIds.length > 0) {
      const activityInserts = extraActivityIds.map((extraId) => ({
        registration_id: registrationId,
        extra_id: extraId,
        selected: true,
      }));

      const { error: actError } = await supabase
        .from("registration_activity_selections")
        .insert(activityInserts);

      if (actError) {
        setLoadingAction(null);
        setMsg(`활동 선택 저장 실패: ${friendlyError(actError)}`);
        return;
      }
    }

    setLoadingAction(null);
    setExtraName("");
    setExtraRelation("");
    setExtraStatus("applied");
    setExtraMemo("");
    setExtraMealId(null);
    setExtraActivityIds([]);
    setMsg("✅ 추가 참가자가 등록되었습니다.");
    await refresh();
  };

  const deleteParticipant = async (registrationId: number) => {
    const supabase = createClient();
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    // 본인 또는 내가 등록한 제3자인지 확인
    const target = regs.find((r) => r.id === registrationId && r.registering_user_id === uid);
    if (!target) {
      setMsg("삭제 권한이 없습니다.");
      return;
    }

    if (!confirm(`${target.nickname}님의 신청을 삭제하시겠습니까?`)) {
      return;
    }

    setLoadingAction(`delete-${registrationId}`);

    const { error } = await supabase
      .from("registrations")
      .delete()
      .eq("id", target.id);

    setLoadingAction(null);

    if (error) {
      setMsg(`삭제 실패: ${friendlyError(error)}`);
    } else {
      setMsg("✅ 신청이 삭제되었습니다.");
      await refresh();
    }
  };

  const startEditParticipant = async (registrationId: number) => {
    const participant = regs.find((r) => r.id === registrationId);
    if (!participant || participant.user_id !== null) {
      setMsg("제3자 등록만 수정할 수 있습니다.");
      return;
    }

    setEditingParticipant(participant);
    setEditName(participant.nickname);
    setEditRelation(participant.relation ?? "");
    setEditMemo(participant.memo ?? "");
    setEditMealId(participant.meal_option_id ?? null);

    // Load activity selections
    const supabase = createClient();
    const selectedRes = await supabase
      .from("registration_activity_selections")
      .select("extra_id")
      .eq("registration_id", registrationId)
      .eq("selected", true);

    if (!selectedRes.error && selectedRes.data) {
      setEditActivityIds(
        (selectedRes.data as ActivitySelection[]).map((s) => s.extra_id)
      );
    } else {
      setEditActivityIds([]);
    }
  };

  const saveEditParticipant = async () => {
    const supabase = createClient();
    setMsg("");
    const uid = user?.id;
    if (!uid || !editingParticipant) {
      setMsg("로그인 필요");
      return;
    }

    const name = editName.trim();
    if (!name) {
      setMsg("닉네임을 입력해주세요.");
      return;
    }

    const nameLower = name.toLowerCase();
    const duplicate = regs.find(
      (r) => r.id !== editingParticipant.id && r.nickname.trim().toLowerCase() === nameLower
    );
    if (duplicate) {
      setMsg("이미 사용 중인 닉네임입니다.");
      return;
    }

    setLoadingAction(`edit-${editingParticipant.id}`);

    // Update registration
    const { error } = await supabase
      .from("registrations")
      .update({
        nickname: name,
        relation: editRelation.trim() || null,
        memo: editMemo.trim() || null,
        meal_option_id: editMealId,
      })
      .eq("id", editingParticipant.id);

    if (error) {
      setLoadingAction(null);
      setMsg(`수정 실패: ${friendlyError(error)}`);
      return;
    }

    // Update activity selections
    await supabase
      .from("registration_activity_selections")
      .delete()
      .eq("registration_id", editingParticipant.id);

    if (editActivityIds.length > 0) {
      const activityInserts = editActivityIds.map((extraId) => ({
        registration_id: editingParticipant.id,
        extra_id: extraId,
        selected: true,
      }));

      const { error: actError } = await supabase
        .from("registration_activity_selections")
        .insert(activityInserts);

      if (actError) {
        setLoadingAction(null);
        setMsg(`활동 선택 저장 실패: ${friendlyError(actError)}`);
        return;
      }
    }

    setLoadingAction(null);
    setEditingParticipant(null);
    setMsg("✅ 참가자 정보가 수정되었습니다.");
    await refresh();
  };

  const addPrizeSupport = async () => {
    const supabase = createClient();
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

    if (editingPrizeId) {
      const { error } = await supabase
        .from("tournament_prize_supports")
        .update({
          item_name: item,
          note: prizeNote.trim() || null,
        })
        .eq("id", editingPrizeId);

      if (error) {
        setMsg(`경품 지원 수정 실패: ${friendlyError(error)}`);
        return;
      }

      setEditingPrizeId(null);
      setPrizeItem("");
      setPrizeNote("");
      setMsg("경품 지원이 수정되었습니다.");
      await refresh();
      return;
    }

    let supporterNickname: string | null = null;
    const profileRes = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", uid)
      .single();

    if (!profileRes.error) {
      supporterNickname = profileRes.data?.nickname ?? null;
    }

    const { error } = await supabase
      .from("tournament_prize_supports")
      .insert({
        tournament_id: tournamentId,
        user_id: uid,
        item_name: item,
        note: prizeNote.trim() || null,
        supporter_nickname: supporterNickname,
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

  const startEditPrizeSupport = (support: PrizeSupport) => {
    setEditingPrizeId(support.id);
    setPrizeItem(support.item_name);
    setPrizeNote(support.note ?? "");
  };

  const cancelEditPrizeSupport = () => {
    setEditingPrizeId(null);
    setPrizeItem("");
    setPrizeNote("");
  };

  const deletePrizeSupport = async (supportId: number, itemName: string) => {
    const supabase = createClient();
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("경품 지원을 삭제하려면 로그인 필요");
      return;
    }

    if (!confirm(`"${itemName}" 경품 지원을 삭제하시겠습니까?`)) {
      return;
    }

    const { error } = await supabase
      .from("tournament_prize_supports")
      .delete()
      .eq("id", supportId);

    if (error) {
      setMsg(`경품 지원 삭제 실패: ${friendlyError(error)}`);
      return;
    }

    if (editingPrizeId === supportId) {
      cancelEditPrizeSupport();
    }

    setMsg("✅ 경품 지원이 삭제되었습니다.");
    await refresh();
  };

  const upsertExtras = async (registrationId: number) => {
    const supabase = createClient();
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
    const supabase = createClient();
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
    const supabase = createClient();
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    // 대회 상태 확인 (open 상태일 때만 수정 가능)
    if (!t) {
      setMsg("대회 정보를 찾을 수 없습니다.");
      return;
    }
    if (t.status !== "open") {
      setMsg("모집 중인 대회만 정보를 수정할 수 있습니다.");
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

  const setSideEventTargetRegistration = (
    sideEventId: number,
    registrationId: number | null
  ) => {
    setSideEventTargetRegistrationIds((prev) => {
      const next = new Map(prev);
      next.set(sideEventId, registrationId);
      return next;
    });

    const existing = registrationId
      ? (sideEventRegs.get(sideEventId) ?? []).find(
          (r) => r.registration_id === registrationId
        )
      : undefined;

    setSideEventMealSelections((prev) => {
      const next = new Map(prev);
      next.set(sideEventId, existing?.meal_selected ?? null);
      return next;
    });

    setSideEventLodgingSelections((prev) => {
      const next = new Map(prev);
      next.set(sideEventId, existing?.lodging_selected ?? null);
      return next;
    });
  };

  const applySideEvent = async (sideEventId: number) => {
    const supabase = createClient();
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

    const targetRegistrationId =
      sideEventTargetRegistrationIds.get(sideEventId) ?? null;
    if (!targetRegistrationId) {
      setMsg("라운드에 등록할 참가자를 먼저 선택해주세요.");
      return;
    }

    const targetReg = regs.find(
      (r) =>
        r.id === targetRegistrationId &&
        r.registering_user_id === uid &&
        r.status !== "canceled"
    );
    if (!targetReg) {
      setMsg("선택한 참가자의 참가 신청 정보를 찾을 수 없습니다.");
      return;
    }

    const mealSelected = sideEventMealSelections.get(sideEventId) ?? null;
    const lodgingSelected = sideEventLodgingSelections.get(sideEventId) ?? null;

    const existing = (sideEventRegs.get(sideEventId) ?? []).find(
      (r) => r.registration_id === targetReg.id
    );

    if (existing) {
      const { error } = await supabase
        .from("side_event_registrations")
        .update({
          registration_id: targetReg.id,
          user_id: targetReg.user_id,
          nickname: targetReg.nickname,
          memo: null,
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
        registration_id: targetReg.id,
        user_id: targetReg.user_id,
        nickname: targetReg.nickname,
        memo: null,
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
    const supabase = createClient();
    setMsg("");
    const uid = user?.id;
    if (!uid) {
      setMsg("로그인 필요");
      return;
    }

    const targetRegistrationId =
      sideEventTargetRegistrationIds.get(sideEventId) ?? null;
    if (!targetRegistrationId) {
      setMsg("취소할 참가자를 먼저 선택해주세요.");
      return;
    }

    const regs = sideEventRegs.get(sideEventId) ?? [];
    const mine = regs.find((r) => r.registration_id === targetRegistrationId);
    if (!mine) {
      setMsg("선택한 참가자의 라운드 신청 내역이 없습니다.");
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

  // 내가 등록한 모든 참가자 (본인 + 제3자)
  const myParticipantList = regs.filter(
    (r) => r.registering_user_id === user?.id
  );
  const activeMyParticipantList = myParticipantList.filter(
    (r) => r.status !== "canceled"
  );

  const formatStatus = (status: Registration["status"]) =>
    formatRegistrationStatus(status);
  const applicantCount = regs.filter((r) => r.status === "applied").length;

  // TableOfContents 아이템 정의
  const tocItems: TOCItem[] = [
    { id: "tournament-info", label: "대회 정보", icon: "📌" },
    { id: "main-registration", label: "참가 신청", icon: "🎮" },
    ...(sideEvents.length > 0
      ? [{ id: "round-section", label: "라운드", icon: "🌅" }]
      : []),
    ...(files.length > 0
      ? [{ id: "files-section", label: "파일", icon: "📥" }]
      : []),
  ];

  const activeSection = useTableOfContents(tocItems.map((item) => item.id));

  return (
    <main className="min-h-screen bg-slate-50/70">
      <TableOfContents items={tocItems} activeSection={activeSection} />
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">
        {!t ? (
          <Card>
            <CardContent className="py-10">
              <p className="text-sm text-slate-500">로딩중...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card id="tournament-info" className="border-slate-200/70">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{t.title}</span>
                  <Badge variant="secondary" className="capitalize">
                    {formatTournamentStatus(t.status)}
                  </Badge>
                </CardTitle>
                <CardDescription>대회 정보 요약</CardDescription>
                <div className="mt-3 flex justify-center">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/t/${tournamentId}/participants`}>
                      참가자 현황
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-1 text-sm text-slate-600">
                  <div>일자: {t.event_date}</div>
                  <div>코스: {t.course_name ?? "-"}</div>
                  <div>지역: {t.location ?? "-"}</div>
                  <div>첫 티오프: {t.tee_time ?? "-"}</div>
                  <div>신청자 수: {applicantCount}명</div>
                  <div>메모: {t.notes ?? "-"}</div>
                </div>
              </CardContent>
            </Card>

            <div id="main-registration" className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="flex justify-center lg:hidden">
                <Button
                  onClick={() => setIsApplySheetOpen(true)}
                  className="inline-flex w-auto max-w-full px-5"
                >
                  참가신청 열기
                </Button>
              </div>

              {isApplySheetOpen && (
                <button
                  type="button"
                  className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                  aria-label="참가 신청 시트 닫기"
                  onClick={() => setIsApplySheetOpen(false)}
                />
              )}

              <Card
                className={`border-slate-200/70 ${
                  isApplySheetOpen
                    ? "fixed inset-x-2 bottom-2 z-50 max-h-[88vh] overflow-hidden rounded-2xl lg:static lg:max-h-none lg:rounded-xl"
                    : "hidden lg:block"
                }`}
              >
                <CardHeader>
                  <CardTitle>참가 신청</CardTitle>
                  <CardDescription>
                    현황은 공개(A). 신청은 로그인 필요.
                  </CardDescription>
                  <div className="lg:hidden">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsApplySheetOpen(false)}
                    >
                      닫기
                    </Button>
                  </div>
                </CardHeader>
                <CardContent
                  className={`space-y-4 overflow-x-hidden ${
                    isApplySheetOpen
                      ? "max-h-[calc(88vh-180px)] overflow-y-auto pb-6"
                      : ""
                  }`}
                >
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
                      variant="secondary"
                      onClick={() => setTransportation("미정")}
                      className="text-xs"
                    >
                      미정으로 입력
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
                      variant="secondary"
                      onClick={() => setDepartureLocation("미정")}
                      className="text-xs"
                    >
                      미정으로 입력
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
                    <Button onClick={apply} size="sm" disabled={loadingAction === 'apply'}>
                      {loadingAction === 'apply' ? "처리중..." : regs.find((r) => r.user_id === user?.id && r.status !== "canceled") ? "정보 수정" : "신청하기"}
                    </Button>
                    <Button onClick={cancelMine} variant="outline" size="sm" disabled={loadingAction === 'cancel-main'}>
                      {loadingAction === 'cancel-main' ? "삭제중..." : "신청 삭제"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 내 참가자 목록 (등록한 참가자가 있을 때만 표시) */}
              {user && myParticipantList.length > 0 && (
                <Card className="border-slate-200/70">
                  <CardHeader>
                    <CardTitle>내 참가자 목록</CardTitle>
                    <CardDescription>
                      내 계정으로 신청한 모든 참가자입니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-md border border-slate-200 lg:overflow-x-visible">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="px-4 py-2 text-xs font-semibold text-slate-600">닉네임</TableHead>
                            <TableHead className="px-4 py-2 text-xs font-semibold text-slate-600">관계</TableHead>
                            <TableHead className="px-4 py-2 text-xs font-semibold text-slate-600 text-center">상태</TableHead>
                            <TableHead className="px-4 py-2 text-xs font-semibold text-slate-600 text-center w-[160px]">액션</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {myParticipantList.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell className="px-4">{p.nickname}</TableCell>
                              <TableCell className="px-4">{p.relation ?? "-"}</TableCell>
                              <TableCell className="px-4 text-center align-middle">
                                <Badge variant={p.status === "approved" ? "default" : "outline"}>
                                  {formatStatus(p.status)}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-4 text-center align-middle whitespace-nowrap w-[160px]">
                                <div className="inline-flex items-center justify-center gap-2 w-full">
                                  {p.user_id === null && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => startEditParticipant(p.id)}
                                      disabled={!!loadingAction}
                                    >
                                      수정
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => deleteParticipant(p.id)}
                                    disabled={loadingAction === `delete-${p.id}`}
                                  >
                                    {loadingAction === `delete-${p.id}` ? "삭제중..." : "삭제"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 제3자 정보 수정 다이얼로그 */}
              {user && editingParticipant && (
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardHeader>
                    <CardTitle className="text-blue-900">제3자 정보 수정</CardTitle>
                    <CardDescription>
                      {editingParticipant.nickname}님의 정보를 수정합니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">닉네임</label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="예: 홍길동"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">관계</label>
                        <Input
                          value={editRelation}
                          onChange={(e) => setEditRelation(e.target.value)}
                          placeholder="예: 가족, 지인"
                        />
                      </div>
                    </div>

                    {mealOptions.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium">식사 메뉴</label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={editMealId ?? ""}
                          onChange={(e) => setEditMealId(e.target.value ? Number(e.target.value) : null)}
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
                        <label className="text-xs font-medium">참여 활동</label>
                        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3 max-h-40 overflow-y-auto lg:max-h-none lg:overflow-y-visible">
                          {tournamentExtras.map((extra) => (
                            <label key={extra.id} className="flex items-start gap-2 text-sm">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4"
                                checked={editActivityIds.includes(extra.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditActivityIds([...editActivityIds, extra.id]);
                                  } else {
                                    setEditActivityIds(editActivityIds.filter((id) => id !== extra.id));
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
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-medium">메모 (선택)</label>
                      <Input
                        value={editMemo}
                        onChange={(e) => setEditMemo(e.target.value)}
                        placeholder="특이사항 등"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={saveEditParticipant} 
                        size="sm"
                        disabled={loadingAction === `edit-${editingParticipant.id}`}
                      >
                        {loadingAction === `edit-${editingParticipant.id}` ? "저장중..." : "저장"}
                      </Button>
                      <Button 
                        onClick={() => setEditingParticipant(null)} 
                        variant="outline" 
                        size="sm"
                        disabled={!!loadingAction}
                      >
                        취소
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 제3자 등록 (로그인만 하면 항상 표시) */}
              {user && (
                <>
                  <div className="flex justify-center lg:hidden">
                    <Button
                      onClick={() => setIsAddParticipantSheetOpen(true)}
                      className="inline-flex w-auto max-w-full px-5"
                      variant="outline"
                    >
                      추가 참가자 등록 열기
                    </Button>
                  </div>

                  {isAddParticipantSheetOpen && (
                    <button
                      type="button"
                      className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                      aria-label="추가 참가자 등록 시트 닫기"
                      onClick={() => setIsAddParticipantSheetOpen(false)}
                    />
                  )}

                  <Card
                    className={`border-slate-200/70 ${
                      isAddParticipantSheetOpen
                        ? "fixed inset-x-2 bottom-2 z-50 max-h-[88vh] overflow-hidden rounded-2xl lg:static lg:max-h-none lg:rounded-xl"
                        : "hidden lg:block"
                    }`}
                  >
                    <CardHeader>
                      <CardTitle>추가 참가자 등록 (제3자)</CardTitle>
                      <CardDescription>
                        본인이 아닌 다른 분들을 대신 등록할 수 있습니다 (비회원 가능)
                      </CardDescription>
                      <div className="lg:hidden">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddParticipantSheetOpen(false)}
                        >
                          닫기
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent
                      className={`space-y-3 overflow-x-hidden ${
                        isAddParticipantSheetOpen
                          ? "max-h-[calc(88vh-180px)] overflow-y-auto pb-6"
                          : ""
                      }`}
                    >
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">닉네임</label>
                        <Input
                          value={extraName}
                          onChange={(e) => setExtraName(e.target.value)}
                          placeholder="예: 홍길동"
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
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
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
                        <label className="text-xs font-medium">식사 메뉴</label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                          value={extraMealId ?? ""}
                          onChange={(e) =>
                            setExtraMealId(e.target.value ? Number(e.target.value) : null)
                          }
                        >
                          <option value="">선택 안 함</option>
                          {mealOptions
                            .filter((m) => m.is_active)
                            .sort((a, b) => a.display_order - b.display_order)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.menu_name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {tournamentExtras.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium">참여 활동 (선택)</label>
                        <div className="space-y-2 rounded-md border border-slate-200 p-3 max-h-40 overflow-y-auto lg:max-h-none lg:overflow-y-visible">
                          {tournamentExtras.map((extra) => (
                            <label key={extra.id} className="flex items-start gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4"
                                checked={extraActivityIds.includes(extra.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setExtraActivityIds([...extraActivityIds, extra.id]);
                                  } else {
                                    setExtraActivityIds(extraActivityIds.filter((id) => id !== extra.id));
                                  }
                                }}
                              />
                              <div className="flex-1">
                                <span className="font-medium">{extra.activity_name}</span>
                                {extra.description && (
                                  <p className="text-xs text-slate-500">{extra.description}</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-medium">메모 (선택)</label>
                      <Input
                        value={extraMemo}
                        onChange={(e) => setExtraMemo(e.target.value)}
                        placeholder="특이사항 등"
                      />
                    </div>

                    <Button onClick={addParticipant} size="sm" className="w-full sm:w-auto" disabled={loadingAction === 'addParticipant'}>
                      {loadingAction === 'addParticipant' ? "등록중..." : "추가 참가자 등록"}
                    </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            {user && (
              <Card className="border-slate-200/70">
                <CardHeader>
                  <CardTitle>경품 지원하기</CardTitle>
                  <CardDescription>
                    경품 지원은 이 화면에서 등록합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={addPrizeSupport} size="sm">
                      {editingPrizeId ? "경품 수정" : "경품 등록"}
                    </Button>
                    {editingPrizeId && (
                      <Button onClick={cancelEditPrizeSupport} size="sm" variant="outline">
                        취소
                      </Button>
                    )}
                  </div>

                  {prizeSupports.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">내 경품 지원</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>경품명</TableHead>
                            <TableHead>비고</TableHead>
                            <TableHead>작업</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {prizeSupports.map((support) => (
                            <TableRow key={support.id}>
                              <TableCell className="font-medium">
                                {support.item_name}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {support.note || "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEditPrizeSupport(support)}
                                  >
                                    수정
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deletePrizeSupport(support.id, support.item_name)}
                                  >
                                    삭제
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card id="files-section" className="border-slate-200/70">
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>파일명</TableHead>
                        <TableHead>유형</TableHead>
                        <TableHead>열기</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {files.map((file) => {
                        const { data } = supabase.storage
                          .from(TOURNAMENT_FILES_BUCKET)
                          .getPublicUrl(file.storage_path);
                        return (
                          <TableRow key={file.id}>
                            <TableCell className="font-medium">
                              {file.file_name}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {file.file_type}
                            </TableCell>
                            <TableCell>
                              <Button asChild size="sm" variant="outline">
                                <a
                                  href={data.publicUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  열기
                                </a>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>


            {sideEvents.length > 0 && (
              <div id="round-section" className="space-y-4">
                <h2 className="text-2xl font-bold text-slate-900">
                  사전/사후 라운드
                </h2>
                {sideEvents.map((se) => {
                  const seRegs = sideEventRegs.get(se.id) ?? [];
                  const selectedTargetRegistrationId =
                    sideEventTargetRegistrationIds.get(se.id) ?? null;
                  const selectedTargetParticipant = activeMyParticipantList.find(
                    (r) => r.id === selectedTargetRegistrationId
                  );
                  const selectedTargetSideReg = selectedTargetRegistrationId
                    ? seRegs.find(
                        (r) => r.registration_id === selectedTargetRegistrationId
                      )
                    : undefined;
                  return (
                    <Card key={se.id} className="border-slate-200/70">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-3">
                          <span>
                            {se.round_type === "pre" ? "📍 사전" : "📍 사후"}{" "}
                            {se.title}
                          </span>
                          <Badge variant="secondary" className="capitalize">
                            {formatTournamentStatus(se.status)}
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

                            {activeMyParticipantList.length > 0 && (
                              <div className="space-y-1">
                                <label className="text-sm font-medium">
                                  참가자 선택
                                </label>
                                <select
                                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  value={selectedTargetRegistrationId ?? ""}
                                  onChange={(e) =>
                                    setSideEventTargetRegistration(
                                      se.id,
                                      e.target.value ? Number(e.target.value) : null
                                    )
                                  }
                                >
                                  <option value="">참가자 선택</option>
                                  {activeMyParticipantList.map((participant) => (
                                    <option
                                      key={participant.id}
                                      value={participant.id}
                                    >
                                      {participant.nickname}
                                      {participant.user_id === null ? " (제3자)" : ""}
                                    </option>
                                  ))}
                                </select>
                                {selectedTargetParticipant && (
                                  <p className="text-xs text-slate-500">
                                    선택됨: {selectedTargetParticipant.nickname}
                                    {selectedTargetSideReg
                                      ? ` · 현재 라운드 상태: ${formatStatus(
                                          selectedTargetSideReg.status as Registration["status"]
                                        )}`
                                      : " · 현재 라운드 신청 없음"}
                                  </p>
                                )}
                              </div>
                            )}

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
