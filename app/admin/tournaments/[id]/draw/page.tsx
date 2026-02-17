"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { replayDrawEvents } from "../../../../../lib/draw/reducer";
import type {
  DrawEventRecord,
  DrawMode,
  DrawSessionSeed,
  DrawState,
} from "../../../../../lib/draw/types";
import { isDrawEventType } from "../../../../../lib/draw/types";
import {
  deriveDrawSeed,
  resolveScoreboardCursorIndex,
} from "../../../../../lib/draw/animators/scoreboard/path";
import DrawAnimator from "../../../../../components/draw/DrawAnimator";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import { useToast } from "../../../../../components/ui/toast";

type DrawSessionRow = {
  id: number;
  tournament_id: number;
  status: "pending" | "live" | "finished" | "canceled";
  group_count: number;
  group_size: number;
  total_players: number;
  player_ids: number[];
  current_step: number;
};

type DrawEventRow = {
  id: number;
  session_id: number;
  step: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type RegistrationRow = {
  id: number;
  nickname: string;
};

type DrawApiResponse = {
  session: DrawSessionRow | null;
  events: DrawEventRow[];
  error?: string;
};

type DrawAction =
  | "start_session"
  | "shuffle_deck"
  | "start_step"
  | "pick_result"
  | "assign_update"
  | "assign_confirm"
  | "move_member"
  | "undo_last"
  | "reset_draw";

function toEventRecord(row: DrawEventRow): DrawEventRecord | null {
  if (!isDrawEventType(row.event_type)) return null;

  return {
    id: row.id,
    session_id: row.session_id,
    step: row.step,
    event_type: row.event_type,
    payload: (row.payload ?? {}) as unknown as DrawEventRecord["payload"],
    created_at: row.created_at,
  };
}

function sortEvents(a: DrawEventRecord, b: DrawEventRecord) {
  const stepDelta = a.step - b.step;
  if (stepDelta !== 0) return stepDelta;
  return (a.id ?? 0) - (b.id ?? 0);
}

function resolveStepCandidateIds(state: DrawState) {
  const deck = state.stepDeckPlayerIds;
  if (
    Array.isArray(deck) &&
    deck.length === state.remainingPlayerIds.length &&
    deck.length > 0
  ) {
    return deck;
  }
  return state.remainingPlayerIds;
}

function resolveStepSeed(state: DrawState) {
  const candidateIds = resolveStepCandidateIds(state);
  if (typeof state.stepSeed === "number" && Number.isFinite(state.stepSeed)) {
    return state.stepSeed;
  }
  return deriveDrawSeed([
    "scoreboard-v1",
    state.currentStep,
    state.startedAt ?? "none",
    state.durationMs ?? 3500,
    candidateIds.join(","),
  ]);
}

function resolveCursorIndexForPick(state: DrawState) {
  const candidateIds = resolveStepCandidateIds(state);
  if (candidateIds.length === 0) return null;
  if (!state.startedAt) return null;
  const startedAtMs = new Date(state.startedAt).getTime();
  if (!Number.isFinite(startedAtMs)) return null;
  return resolveScoreboardCursorIndex({
    candidateCount: candidateIds.length,
    durationMs: Math.min(30000, Math.max(800, state.durationMs ?? 3500)),
    seed: resolveStepSeed(state),
    tempo: state.stepTempo ?? undefined,
    startedAtMs,
    atMs: Date.now(),
  });
}

function isDeckOrderShuffled(prev: number[], next: number[]) {
  if (prev.length !== next.length || prev.length <= 1) return false;
  if (prev.every((value, index) => value === next[index])) return false;
  const left = [...prev].sort((a, b) => a - b);
  const right = [...next].sort((a, b) => a - b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export default function AdminTournamentDrawPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<DrawSessionRow | null>(null);
  const [events, setEvents] = useState<DrawEventRecord[]>([]);
  const [msg, setMsg] = useState("");
  const [nicknameByRegistrationId, setNicknameByRegistrationId] = useState<
    Record<number, string>
  >({});

  const [groupCount, setGroupCount] = useState("10");
  const [groupSize, setGroupSize] = useState("4");

  const [mode, setMode] = useState<DrawMode>("ROUND_ROBIN");
  const [targetGroupNo, setTargetGroupNo] = useState("1");
  const [durationMs, setDurationMs] = useState("7");
  const [assignGroupNo, setAssignGroupNo] = useState("1");

  const [movePlayerId, setMovePlayerId] = useState("");
  const [moveTargetGroupNo, setMoveTargetGroupNo] = useState("1");
  const autoPickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statePhaseRef = useRef<string | null>(null);
  const stateRef = useRef<DrawState | null>(null);
  const prevRemainingOrderRef = useRef<number[] | null>(null);
  const [lowSpecMode, setLowSpecMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("draw_low_spec") === "1";
  });
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [mobileGroupsPanelOpen, setMobileGroupsPanelOpen] = useState(false);
  const [mobileRemainingPanelOpen, setMobileRemainingPanelOpen] = useState(false);

  const persistLowSpec = (next: boolean) => {
    setLowSpecMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("draw_low_spec", next ? "1" : "0");
    }
  };

  const loadSnapshot = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setMsg("");
    }

    const response = await fetch(`/api/admin/tournaments/${tournamentId}/draw`, {
      method: "GET",
      cache: "no-store",
    });
    const data = (await response.json()) as DrawApiResponse;

    if (!response.ok || data.error) {
      setMsg(data.error ?? "라이브 세션 정보를 불러오지 못했습니다.");
      if (!silent) setLoading(false);
      return;
    }

    setSession(data.session ?? null);
    const normalized = (data.events ?? [])
      .map(toEventRecord)
      .filter((value): value is DrawEventRecord => value !== null)
      .sort(sortEvents);
    setEvents(normalized);

    if (data.session?.player_ids?.length) {
      const supabase = createClient();
      const { data: regs } = await supabase
        .from("registrations")
        .select("id,nickname")
        .in("id", data.session.player_ids);

      const map: Record<number, string> = {};
      ((regs ?? []) as RegistrationRow[]).forEach((reg) => {
        map[reg.id] = reg.nickname;
      });
      setNicknameByRegistrationId(map);
    } else {
      setNicknameByRegistrationId({});
    }

    if (!silent) setLoading(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsCompactLayout(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  useEffect(() => {
    if (!session?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`draw-events-admin-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "draw_events",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const inserted = toEventRecord(payload.new as DrawEventRow);
          if (!inserted) return;

          setEvents((prev) => {
            if (inserted.id && prev.some((event) => event.id === inserted.id)) {
              return prev;
            }
            return [...prev, inserted].sort(sortEvents);
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "draw_events",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const updated = toEventRecord(payload.new as DrawEventRow);
          if (!updated?.id) return;
          setEvents((prev) => {
            const idx = prev.findIndex((event) => event.id === updated.id);
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = updated;
            return next.sort(sortEvents);
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [session?.id]);

  const seed = useMemo<DrawSessionSeed | null>(() => {
    if (!session) return null;
    return {
      sessionId: session.id,
      tournamentId: session.tournament_id,
      status: session.status,
      groupCount: session.group_count,
      groupSize: session.group_size,
      totalPlayers: session.total_players,
      playerIds: Array.isArray(session.player_ids) ? session.player_ids : [],
    };
  }, [session]);

  const state = useMemo(() => {
    if (!seed) return null;
    return replayDrawEvents(seed, events);
  }, [seed, events]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!state) {
      prevRemainingOrderRef.current = null;
      return;
    }
    const nextOrder = state.remainingPlayerIds;
    const prevOrder = prevRemainingOrderRef.current;
    if (
      prevOrder &&
      isDeckOrderShuffled(prevOrder, nextOrder) &&
      state.phase !== "configured" &&
      state.phase !== "picked"
    ) {
      toast({
        variant: "default",
        title: "덱 섞는중입니다.",
        description: "참가자 순서를 재정렬하고 있습니다.",
        duration: 2000,
      });
    }
    prevRemainingOrderRef.current = [...nextOrder];
  }, [state, toast]);

  useEffect(() => {
    statePhaseRef.current = state?.phase ?? null;
    if (state?.phase !== "configured" && autoPickTimerRef.current) {
      clearTimeout(autoPickTimerRef.current);
      autoPickTimerRef.current = null;
    }
  }, [state?.phase, state]);

  useEffect(() => {
    return () => {
      if (autoPickTimerRef.current) {
        clearTimeout(autoPickTimerRef.current);
      }
    };
  }, []);

  const assignedMembers = useMemo(() => {
    if (!state) return [] as Array<{ playerId: number; groupNo: number }>;
    const rows: Array<{ playerId: number; groupNo: number }> = [];
    Object.entries(state.groups).forEach(([groupNo, members]) => {
      members.forEach((playerId) => {
        rows.push({ playerId, groupNo: Number(groupNo) });
      });
    });
    return rows;
  }, [state]);

  const fullGroupNos = useMemo(() => {
    if (!state) return new Set<number>();
    const full = new Set<number>();
    for (let groupNo = 1; groupNo <= state.groupCount; groupNo += 1) {
      if ((state.groups[groupNo]?.length ?? 0) >= state.groupSize) {
        full.add(groupNo);
      }
    }
    return full;
  }, [state]);

  const availableGroupNos = useMemo(() => {
    if (!state) return [] as number[];
    return Array.from({ length: state.groupCount }, (_, index) => index + 1).filter(
      (groupNo) => !fullGroupNos.has(groupNo)
    );
  }, [state, fullGroupNos]);

  useEffect(() => {
    if (!state) return;
    const preferredAssignGroupNo = state.pendingGroupNo ?? state.targetGroupNo ?? 1;
    const normalizedAssignGroupNo =
      availableGroupNos.find((groupNo) => groupNo === preferredAssignGroupNo) ??
      availableGroupNos[0] ??
      preferredAssignGroupNo;
    if (String(normalizedAssignGroupNo) !== assignGroupNo) {
      setAssignGroupNo(String(normalizedAssignGroupNo));
    }

    const preferredTargetGroupNo = Number(targetGroupNo) || 1;
    const normalizedTargetGroupNo =
      availableGroupNos.find((groupNo) => groupNo === preferredTargetGroupNo) ??
      availableGroupNos[0] ??
      preferredTargetGroupNo;
    if (String(normalizedTargetGroupNo) !== targetGroupNo) {
      setTargetGroupNo(String(normalizedTargetGroupNo));
    }

    if (assignedMembers.length > 0) {
      if (!movePlayerId || !assignedMembers.some((row) => String(row.playerId) === movePlayerId)) {
        setMovePlayerId(String(assignedMembers[0].playerId));
      }
    } else {
      setMovePlayerId("");
    }

    if (session?.group_count) {
      const current = Number(moveTargetGroupNo);
      if (!Number.isInteger(current) || current < 1 || current > session.group_count) {
        setMoveTargetGroupNo("1");
      }
    }
  }, [
    state,
    assignedMembers,
    movePlayerId,
    moveTargetGroupNo,
    session?.group_count,
    availableGroupNos,
    assignGroupNo,
    targetGroupNo,
  ]);

  const displayName = (registrationId: number) =>
    nicknameByRegistrationId[registrationId] ?? `#${registrationId}`;

  const postAction = async (
    action: DrawAction,
    payload: Record<string, unknown> = {}
  ) => {
    setSaving(true);
    setMsg("");

    const response = await fetch(`/api/admin/tournaments/${tournamentId}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok || data?.error) {
      setMsg(data?.error ?? "요청 처리에 실패했습니다.");
      setSaving(false);
      return false;
    }

    await loadSnapshot({ silent: true });
    setSaving(false);
    return true;
  };

  const handleStartSession = async () => {
    const parsedGroupCount = Number(groupCount);
    const parsedGroupSize = Number(groupSize);

    if (!Number.isInteger(parsedGroupCount) || parsedGroupCount <= 0) {
      setMsg("groupCount는 1 이상의 정수여야 합니다.");
      return;
    }

    if (!Number.isInteger(parsedGroupSize) || parsedGroupSize <= 0) {
      setMsg("groupSize는 1 이상의 정수여야 합니다.");
      return;
    }

    await postAction("start_session", {
      groupCount: parsedGroupCount,
      groupSize: parsedGroupSize,
    });
  };

  const handleStartStep = async () => {
    if (!session) return;
    const latest = stateRef.current;
    const isRepickPhase =
      latest?.phase === "configured" ||
      latest?.phase === "spinning" ||
      latest?.phase === "picked";

    const actionMode: DrawMode = isRepickPhase
      ? (latest?.currentMode ?? mode)
      : mode;

    const parsedDurationSec = Number(durationMs);
    const baseDuration = isRepickPhase
      ? (typeof latest?.durationMs === "number" && Number.isFinite(latest.durationMs)
          ? latest.durationMs
          : 6500)
      : (Number.isFinite(parsedDurationSec)
          ? Math.max(1, Math.floor(parsedDurationSec)) * 1000
          : 7000);
    const safeDuration = Math.min(
      15000,
      Math.max(1000, baseDuration)
    );

    const fallbackTargetGroupNo = Number(targetGroupNo) || 1;
    const actionTargetGroupNo =
      actionMode === "TARGET_GROUP"
        ? (isRepickPhase
            ? (latest?.targetGroupNo ?? fallbackTargetGroupNo)
            : fallbackTargetGroupNo)
        : null;

    const ok = await postAction("start_step", {
      sessionId: session.id,
      mode: actionMode,
      targetGroupNo: actionTargetGroupNo,
      durationMs: safeDuration,
    });
    if (!ok) return;

    if (autoPickTimerRef.current) {
      clearTimeout(autoPickTimerRef.current);
    }
    autoPickTimerRef.current = setTimeout(() => {
      if (statePhaseRef.current !== "configured") return;
      const latest = stateRef.current;
      const cursorIndex = latest ? resolveCursorIndexForPick(latest) : null;
      const payload: Record<string, unknown> = {
        sessionId: session.id,
        pickedAtMs: Date.now(),
      };
      if (typeof cursorIndex === "number") {
        payload.cursorIndex = cursorIndex;
      }
      void postAction("pick_result", payload);
    }, safeDuration);
  };

  const handleShuffleDeck = async () => {
    if (!session) return;
    await postAction("shuffle_deck", {
      sessionId: session.id,
    });
  };

  const handleAssignConfirm = async () => {
    if (!session) return;
    await postAction("assign_confirm", {
      sessionId: session.id,
      groupNo: Number(assignGroupNo),
    });
  };

  const handleUndoLast = async () => {
    if (!session) return;
    await postAction("undo_last", { sessionId: session.id });
  };

  const handleMoveMember = async () => {
    if (!session) return;
    if (!movePlayerId) {
      setMsg("이동할 참가자를 선택하세요.");
      return;
    }

    await postAction("move_member", {
      sessionId: session.id,
      playerId: Number(movePlayerId),
      toGroupNo: Number(moveTargetGroupNo),
    });
  };

  const handleResetDraw = async () => {
    if (!session) return;

    const confirmed = window.confirm(
      "조편성 전체 리셋을 진행하면 현재 라이브 추첨 기록과 배정 결과가 모두 삭제됩니다. 계속할까요?"
    );
    if (!confirmed) return;

    if (autoPickTimerRef.current) {
      clearTimeout(autoPickTimerRef.current);
      autoPickTimerRef.current = null;
    }

    await postAction("reset_draw");
  };

  const selectedTargetGroupNo = Number(targetGroupNo);
  const selectedAssignGroupNo = Number(assignGroupNo);
  const selectedTargetGroupFull = fullGroupNos.has(selectedTargetGroupNo);
  const selectedAssignGroupFull = fullGroupNos.has(selectedAssignGroupNo);
  const hasAvailableGroup = availableGroupNos.length > 0;
  const isRepickPhase = Boolean(
    state &&
      (state.phase === "configured" ||
        state.phase === "spinning" ||
        state.phase === "picked")
  );

  const canStartStep = Boolean(
    state &&
      state.remainingPlayerIds.length > 0 &&
      state.phase !== "finished" &&
      (isRepickPhase ||
        (hasAvailableGroup &&
          (mode !== "TARGET_GROUP" || !selectedTargetGroupFull)))
  );
  const startStepButtonLabel = isRepickPhase ? "재추첨" : "다음 추첨 시작";
  const canShuffleDeck = Boolean(
    state &&
      state.remainingPlayerIds.length > 1 &&
      state.phase !== "configured" &&
      state.phase !== "picked"
  );
  const canAssign = Boolean(
    state &&
      state.phase === "picked" &&
      state.currentPickPlayerId &&
      !selectedAssignGroupFull
  );
  const canUndo = Boolean(events.length > 0 && events[events.length - 1]?.event_type === "ASSIGN_CONFIRMED");
  const canMove = Boolean(state && assignedMembers.length > 0);

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">라이브 조편성 관리</h1>
            <p className="text-xs text-slate-500">
              세션 시작, 스텝 진행, 당첨/확정, 이동/되돌리기를 수행합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/t/${tournamentId}/draw`}>시청자 화면</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/tournaments/${tournamentId}/groups`}>기존 조편성</Link>
            </Button>
          </div>
        </div>

        {msg && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-2 text-sm text-red-700">{msg}</CardContent>
          </Card>
        )}

        {loading ? (
          <Card>
            <CardContent className="py-6 text-sm text-slate-500">로딩 중...</CardContent>
          </Card>
        ) : (
          <>
            {!session ? (
              <Card className="border-slate-200/70">
                <CardHeader>
                  <CardTitle className="text-lg">라이브 세션 시작</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">조 수(groupCount)</label>
                      <Input
                        value={groupCount}
                        onChange={(e) => setGroupCount(e.target.value)}
                        placeholder="예: 10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">조당 인원(groupSize)</label>
                      <Input
                        value={groupSize}
                        onChange={(e) => setGroupSize(e.target.value)}
                        placeholder="예: 4"
                      />
                    </div>
                  </div>
                  <Button onClick={handleStartSession} disabled={saving}>
                    {saving ? "처리 중..." : "세션 시작"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid items-start gap-2 lg:grid-cols-[2fr_1fr]">
                  <Card className="border-slate-200/70">
                    <CardHeader className="px-3 py-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-sm">진행 컨트롤</CardTitle>
                        {state && (
                          <div className="flex flex-wrap items-center gap-1 text-[11px]">
                            <Badge variant="secondary" className="h-5 px-2 capitalize">
                              Phase: {state.phase}
                            </Badge>
                            <Badge variant="outline" className="h-5 px-2 capitalize">
                              Session: {state.status}
                            </Badge>
                            <span className="text-slate-600">
                              진행: {state.totalPlayers - state.remainingPlayerIds.length}/
                              {state.totalPlayers}
                            </span>
                            <span className="text-slate-600">step: {state.currentStep + 1}</span>
                            {state.targetGroupNo ? (
                              <span className="text-slate-600">타겟 조: {state.targetGroupNo}조</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 px-3 pb-2 pt-0">
                      <div className="grid gap-2 md:grid-cols-[170px_130px_160px_auto]">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">모드</label>
                          <select
                            value={mode}
                            onChange={(e) => setMode(e.target.value as DrawMode)}
                            className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm"
                          >
                            <option value="ROUND_ROBIN">ROUND_ROBIN</option>
                            <option value="TARGET_GROUP">TARGET_GROUP</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">타겟 조</label>
                          <select
                            value={targetGroupNo}
                            onChange={(e) => setTargetGroupNo(e.target.value)}
                            disabled={mode !== "TARGET_GROUP"}
                            aria-disabled={mode !== "TARGET_GROUP"}
                            className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm disabled:pointer-events-none disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {Array.from(
                              { length: session.group_count },
                              (_, index) => index + 1
                            ).map((groupNo) => (
                              <option
                                key={groupNo}
                                value={groupNo}
                                disabled={fullGroupNos.has(groupNo)}
                              >
                                {groupNo}조{fullGroupNos.has(groupNo) ? " (정원)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium">연출 시간(초)</label>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={durationMs}
                            onChange={(e) => setDurationMs(e.target.value)}
                            placeholder="예: 7"
                            className="h-8"
                          />
                        </div>
                        <div className="flex items-end">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={lowSpecMode}
                              onChange={(e) => persistLowSpec(e.target.checked)}
                              className="h-4 w-4"
                            />
                            저사양 모드
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={handleShuffleDeck}
                          disabled={saving || !canShuffleDeck}
                          variant="outline"
                          className="h-8 px-3 text-xs"
                        >
                          덱 섞기
                        </Button>
                        <Button
                          onClick={handleStartStep}
                          disabled={saving || !canStartStep}
                          className="h-8 px-3 text-xs"
                        >
                          {startStepButtonLabel}
                        </Button>
                        <Button
                          onClick={handleUndoLast}
                          disabled={saving || !canUndo}
                          variant="outline"
                          className="h-8 px-3 text-xs"
                        >
                          되돌리기
                        </Button>
                        <Button
                          onClick={handleResetDraw}
                          disabled={saving}
                          variant="destructive"
                          className="h-8 px-3 text-xs"
                        >
                          리셋
                        </Button>
                        <div className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-white px-2">
                          <label className="text-xs font-medium text-slate-600">확정조</label>
                          <select
                            value={assignGroupNo}
                            onChange={(e) => setAssignGroupNo(e.target.value)}
                            className="h-6 min-w-[74px] border-0 bg-transparent px-1 text-xs outline-none"
                          >
                            {Array.from(
                              { length: session.group_count },
                              (_, index) => index + 1
                            ).map((groupNo) => (
                              <option
                                key={groupNo}
                                value={groupNo}
                                disabled={fullGroupNos.has(groupNo)}
                              >
                                {groupNo}조{fullGroupNos.has(groupNo) ? " (정원)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          onClick={handleAssignConfirm}
                          disabled={saving || !canAssign}
                          className="h-8 px-3 text-xs"
                        >
                          배정확정
                        </Button>
                        <span className="text-[11px] text-slate-500">
                          연출 시간 경과 후 자동으로 당첨자 뽑기가 실행됩니다.
                        </span>
                      </div>

                    </CardContent>
                  </Card>

                  <Card className="border-slate-200/70">
                    <CardHeader className="px-3 py-1.5">
                      <CardTitle className="text-sm">재편성(멤버 이동)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 px-3 pb-2 pt-0">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">이동할 참가자</label>
                        <select
                          value={movePlayerId}
                          onChange={(e) => setMovePlayerId(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm"
                        >
                          {assignedMembers.length === 0 ? (
                            <option value="">이동 가능한 참가자 없음</option>
                          ) : (
                            assignedMembers.map((row) => (
                              <option key={`${row.playerId}-${row.groupNo}`} value={row.playerId}>
                                {displayName(row.playerId)} (현재 {row.groupNo}조)
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <div className="grid grid-cols-[120px_auto] gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium">대상 조</label>
                          <select
                          value={moveTargetGroupNo}
                          onChange={(e) => setMoveTargetGroupNo(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm"
                          >
                            {Array.from(
                              { length: session.group_count },
                              (_, index) => index + 1
                            ).map((groupNo) => (
                              <option key={groupNo} value={groupNo}>
                                {groupNo}조
                              </option>
                            ))}
                          </select>
                        </div>
                        <Button
                          onClick={handleMoveMember}
                          disabled={saving || !canMove}
                          className="h-8 self-end px-3 text-xs"
                        >
                          멤버 이동
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {state && (
                  <DrawAnimator
                    kind="scoreboard"
                    phase={state.phase}
                    mode={state.currentMode}
                    targetGroupNo={state.targetGroupNo}
                    assignGroupNo={state.pendingGroupNo ?? state.targetGroupNo}
                    durationMs={state.durationMs}
                    startedAt={state.startedAt}
                    stepSeed={state.stepSeed}
                    stepPattern={state.stepPattern}
                    stepTempo={state.stepTempo}
                    currentPickCandidateId={
                      state.currentPickPlayerId ? String(state.currentPickPlayerId) : null
                    }
                    currentPickLabel={
                      state.currentPickPlayerId ? displayName(state.currentPickPlayerId) : null
                    }
                    candidates={resolveStepCandidateIds(state).map((registrationId, index) => ({
                      id: String(registrationId),
                      label: displayName(registrationId),
                      slotNo: index + 1,
                    }))}
                    currentStep={state.currentStep}
                    totalSteps={state.totalPlayers}
                    lowSpecMode={lowSpecMode}
                  />
                )}

                {state && (
                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                    <Card className="border-slate-200/70">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-lg">조 편성 현황</CardTitle>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{state.groupCount}개 조</span>
                            {isCompactLayout ? (
                              <button
                                type="button"
                                onClick={() => setMobileGroupsPanelOpen((prev) => !prev)}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                              >
                                {mobileGroupsPanelOpen ? "접기" : "펼치기"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </CardHeader>
                      {!isCompactLayout || mobileGroupsPanelOpen ? (
                        <CardContent className="pt-0">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {Array.from(
                              { length: state.groupCount },
                              (_, index) => index + 1
                            ).map((groupNo) => {
                              const memberCount = state.groups[groupNo].length;
                              const isGroupLocked = memberCount >= state.groupSize;
                              return (
                                <div
                                  key={groupNo}
                                  className={`rounded-lg border p-2 transition-colors ${
                                    isGroupLocked
                                      ? "border-emerald-300 bg-emerald-50"
                                      : "border-slate-200 bg-white"
                                  }`}
                                >
                                <p className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-800">
                                  <span>{groupNo}조</span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                      isGroupLocked
                                        ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                                        : "border-slate-200 bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {isGroupLocked ? "확정" : `${memberCount}/${state.groupSize}`}
                                  </span>
                                </p>
                                <ul className="space-y-1 text-sm text-slate-700">
                                  {state.groups[groupNo].length === 0 ? (
                                    <li className="text-slate-400">-</li>
                                  ) : (
                                    state.groups[groupNo].map((registrationId) => (
                                      <li key={registrationId}>{displayName(registrationId)}</li>
                                    ))
                                  )}
                                </ul>
                              </div>
                            );
                            })}
                          </div>
                        </CardContent>
                      ) : null}
                    </Card>

                    <Card className="border-slate-200/70">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-lg">남은 추첨 대상</CardTitle>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">{state.remainingPlayerIds.length}명</span>
                            {isCompactLayout ? (
                              <button
                                type="button"
                                onClick={() => setMobileRemainingPanelOpen((prev) => !prev)}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                              >
                                {mobileRemainingPanelOpen ? "접기" : "펼치기"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </CardHeader>
                      {!isCompactLayout || mobileRemainingPanelOpen ? (
                        <CardContent className="pt-0">
                          {state.remainingPlayerIds.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              모든 인원 배정이 완료되었습니다.
                            </p>
                          ) : (
                            <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                              {state.remainingPlayerIds.map((registrationId) => (
                                <li
                                  key={registrationId}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5"
                                >
                                  {displayName(registrationId)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      ) : null}
                    </Card>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
