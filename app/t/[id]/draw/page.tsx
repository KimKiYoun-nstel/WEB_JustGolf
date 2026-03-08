"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../lib/supabaseClient";
import { replayDrawEvents } from "../../../../lib/draw/reducer";
import type { DrawEventRecord, DrawSessionSeed } from "../../../../lib/draw/types";
import { isDrawEventType } from "../../../../lib/draw/types";
import DrawAnimator from "../../../../components/draw/DrawAnimator";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { useToast } from "../../../../components/ui/toast";
import { Input } from "../../../../components/ui/input";

type DrawSessionRow = {
  id: number;
  tournament_id: number;
  status: "pending" | "live" | "finished" | "canceled";
  group_count: number;
  group_size: number;
  total_players: number;
  player_ids: number[];
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

type ChatSessionInfo = {
  id: number;
  drawSessionId: number;
  status: "live" | "closed";
};

type ChatMessage = {
  id: number;
  chat_session_id: number;
  user_id: string;
  nickname: string;
  message: string;
  created_at: string;
};

type SyncStatus = "connecting" | "realtime" | "polling";

function toDrawEvent(row: DrawEventRow): DrawEventRecord | null {
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

function normalizeEvents(rows: DrawEventRow[]) {
  return rows.map(toDrawEvent).filter((value): value is DrawEventRecord => value !== null).sort(sortEvents);
}

function playerKey(playerIds: number[]) {
  if (playerIds.length === 0) return "";
  return [...playerIds].sort((a, b) => a - b).join(",");
}

function resolveStepCandidateIds(state: ReturnType<typeof replayDrawEvents>) {
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

export default function TournamentDrawViewerPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<DrawSessionRow | null>(null);
  const [events, setEvents] = useState<DrawEventRecord[]>([]);
  const [nicknameByRegistrationId, setNicknameByRegistrationId] = useState<
    Record<number, string>
  >({});
  const [msg, setMsg] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("polling");
  const [lowSpecMode, setLowSpecMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("draw_low_spec") === "1";
  });
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [mobileGroupsPanelOpen, setMobileGroupsPanelOpen] = useState(false);
  const [mobileRemainingPanelOpen, setMobileRemainingPanelOpen] = useState(false);
  const nicknameCacheKeyRef = useRef("");
  const prevRemainingOrderRef = useRef<number[] | null>(null);

  // Chat states
  const [chatCanJoin, setChatCanJoin] = useState(false);
  const [chatUserId, setChatUserId] = useState("");
  const [chatNickname, setChatNickname] = useState("");
  const [chatSession, setChatSession] = useState<ChatSessionInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatPopupOpen, setChatPopupOpen] = useState(false);
  const [chatInputMessage, setChatInputMessage] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatShouldAutoScrollRef = useRef(true);
  const chatPopupRef = useRef<Window | null>(null);
  const chatPopupWatchRef = useRef<number | null>(null);
  const mobileChatHistoryPushedRef = useRef(false);

  const persistLowSpec = (next: boolean) => {
    setLowSpecMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("draw_low_spec", next ? "1" : "0");
    }
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

    const supabase = createClient();
    let mounted = true;

    const fetchSnapshot = async (silent = false) => {
      const { data: sessionData, error: sessionError } = await supabase
        .from("draw_sessions")
        .select("id,tournament_id,status,group_count,group_size,total_players,player_ids")
        .eq("tournament_id", tournamentId)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;

      if (sessionError) {
        if (!silent) {
          setMsg(`라이브 세션 조회 실패: ${sessionError.message}`);
          setLoading(false);
        }
        return;
      }

      if (!sessionData) {
        setSession(null);
        setEvents([]);
        setNicknameByRegistrationId({});
        nicknameCacheKeyRef.current = "";
        if (!silent) setLoading(false);
        return;
      }

      const row = sessionData as DrawSessionRow;
      setSession(row);

      const { data: eventData, error: eventError } = await supabase
        .from("draw_events")
        .select("id,session_id,step,event_type,payload,created_at")
        .eq("session_id", row.id)
        .order("step", { ascending: true })
        .order("id", { ascending: true });

      if (!mounted) return;

      if (eventError) {
        if (!silent) {
          setMsg(`이벤트 조회 실패: ${eventError.message}`);
          setLoading(false);
        }
        return;
      }

      setEvents(normalizeEvents((eventData ?? []) as DrawEventRow[]));

      const playerIds = Array.isArray(row.player_ids) ? row.player_ids : [];
      const nextPlayerKey = playerKey(playerIds);

      if (nextPlayerKey !== nicknameCacheKeyRef.current) {
        if (playerIds.length === 0) {
          setNicknameByRegistrationId({});
          nicknameCacheKeyRef.current = "";
        } else {
          const { data: regData } = await supabase
            .from("registrations")
            .select("id,nickname")
            .in("id", playerIds);

          if (!mounted) return;

          const map: Record<number, string> = {};
          ((regData ?? []) as RegistrationRow[]).forEach((reg) => {
            map[reg.id] = reg.nickname;
          });
          setNicknameByRegistrationId(map);
          nicknameCacheKeyRef.current = nextPlayerKey;
        }
      }

      setMsg("");
      if (!silent) setLoading(false);
    };

    void fetchSnapshot(false);

    const pollId = window.setInterval(() => {
      void fetchSnapshot(true);
    }, 1000);

    return () => {
      mounted = false;
      window.clearInterval(pollId);
    };
  }, [tournamentId]);

  // Chat session fetch
  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;

    let mounted = true;

    const resetChatState = () => {
      setChatCanJoin(false);
      setChatUserId("");
      setChatNickname("");
      setChatSession(null);
      setChatMessages([]);
      setChatUnreadCount(0);
      setChatPopupOpen(false);
      setChatExpanded(false);
      setChatOpen(false);
      mobileChatHistoryPushedRef.current = false;
    };

    const fetchChatSession = async () => {
      try {
        const response = await fetch(`/api/tournaments/${tournamentId}/draw-chat/session`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!mounted) return;

        if (response.ok && data.canJoin) {
          setChatCanJoin(true);
          setChatUserId(typeof data.userId === "string" ? data.userId : "");
          setChatNickname(data.nickname);
          setChatSession(data.chatSession);

          if (data.chatSession?.id) {
            const supabase = createClient();
            const { data: msgData, error: msgError } = await supabase
              .from("draw_chat_messages")
              .select("id,chat_session_id,user_id,nickname,message,created_at")
              .eq("chat_session_id", data.chatSession.id)
              .order("created_at", { ascending: true })
              .order("id", { ascending: true });

            if (!msgError && msgData) {
              setChatMessages(msgData as ChatMessage[]);
            }
          }
        } else {
          resetChatState();
        }
      } catch (error) {
        if (!mounted) return;
        // Keep the previous chat UI state on transient network failures.
        console.error("Failed to fetch draw chat session:", error);
      }
    };

    void fetchChatSession();

    const chatSessionPollId = window.setInterval(() => {
      void fetchChatSession();
    }, 5000);

    return () => {
      mounted = false;
      window.clearInterval(chatSessionPollId);
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!session?.id) return;

    const supabase = createClient();
    const connectingTimer = window.setTimeout(() => {
      setSyncStatus("connecting");
    }, 0);

    const channel = supabase
      .channel(`draw-events-viewer-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "draw_events",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          const inserted = toDrawEvent(payload.new as DrawEventRow);
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
          const updated = toDrawEvent(payload.new as DrawEventRow);
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "draw_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          setSession(payload.new as DrawSessionRow);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSyncStatus("realtime");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setSyncStatus("polling");
        }
      });

    return () => {
      window.clearTimeout(connectingTimer);
      channel.unsubscribe();
    };
  }, [session?.id]);

  // Chat realtime subscription
  useEffect(() => {
    if (!chatSession?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`draw-chat-viewer-${chatSession.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "draw_chat_messages",
          filter: `chat_session_id=eq.${chatSession.id}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          const shouldStickToBottom = chatShouldAutoScrollRef.current;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => {
            if (shouldStickToBottom) {
              chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              setChatUnreadCount(0);
            } else {
              setChatUnreadCount((prev) => prev + 1);
            }
          }, 50);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [chatSession?.id]);

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

  const effectiveSyncStatus: SyncStatus = session?.id ? syncStatus : "polling";

  const displayName = (registrationId: number) =>
    nicknameByRegistrationId[registrationId] ?? `#${registrationId}`;

  const handleChatEnter = () => {
    if (!chatCanJoin) return;

    if (isCompactLayout) {
      // Mobile: open fixed overlay (compact mode)
      setChatExpanded(false);
      setChatOpen(true);
      setTimeout(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      // PC: open popup window
      const existing = chatPopupRef.current;
      if (existing && !existing.closed) {
        existing.focus();
        setChatPopupOpen(true);
        return;
      }

      const chatUrl = `/t/${tournamentId}/draw/chat`;
      const popup = window.open(
        chatUrl,
        "_blank",
        "width=500,height=700,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes"
      );

      if (!popup) {
        window.location.href = chatUrl;
        return;
      }

      chatPopupRef.current = popup;
      setChatPopupOpen(true);

      if (chatPopupWatchRef.current) {
        clearInterval(chatPopupWatchRef.current);
      }

      chatPopupWatchRef.current = window.setInterval(() => {
        if (!chatPopupRef.current || chatPopupRef.current.closed) {
          setChatPopupOpen(false);
          if (chatPopupWatchRef.current) {
            clearInterval(chatPopupWatchRef.current);
            chatPopupWatchRef.current = null;
          }
        }
      }, 1000);
    }
  };

  const handleChatSend = async () => {
    if (!chatSession?.id || !chatInputMessage.trim() || chatSending) return;

    setChatSending(true);

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/draw-chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatSessionId: chatSession.id,
          message: chatInputMessage.trim(),
        }),
      });

      if (!response.ok) {
        toast({
          variant: "error",
          title: "메시지 전송 실패",
          description: "잠시 후 다시 시도해주세요.",
        });
        return;
      }

      setChatInputMessage("");
      chatShouldAutoScrollRef.current = true;
      setTimeout(() => chatInputRef.current?.focus(), 0);
    } finally {
      setChatSending(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleChatSend();
    }
  };

  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    chatShouldAutoScrollRef.current = isAtBottom;
    if (isAtBottom) {
      setChatUnreadCount(0);
    }
  };

  const handleCloseMobileChat = () => {
    if (typeof window !== "undefined" && mobileChatHistoryPushedRef.current) {
      window.history.back();
      return;
    }
    setChatExpanded(false);
    setChatOpen(false);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !isCompactLayout) return;
    if (chatOpen && !mobileChatHistoryPushedRef.current) {
      window.history.pushState({ drawChatOverlay: true }, "");
      mobileChatHistoryPushedRef.current = true;
    }
  }, [chatOpen, isCompactLayout]);

  useEffect(() => {
    if (!chatOpen) {
      mobileChatHistoryPushedRef.current = false;
    }
  }, [chatOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      if (isCompactLayout && chatOpen) {
        setChatExpanded(false);
        setChatOpen(false);
        mobileChatHistoryPushedRef.current = false;
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [chatOpen, isCompactLayout]);

  useEffect(() => {
    return () => {
      if (chatPopupWatchRef.current) {
        clearInterval(chatPopupWatchRef.current);
        chatPopupWatchRef.current = null;
      }
    };
  }, []);

  const isChatWindowOpen = isCompactLayout ? chatOpen : chatPopupOpen;
  const stateBadgeBaseClass = "h-6 border-slate-200 bg-slate-50 text-slate-700";

  return (
    <main
      className={`min-h-screen bg-slate-50/70 ${
        isCompactLayout && chatOpen ? (chatExpanded ? "pb-[60vh]" : "pb-48") : ""
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">라이브 조편성</h1>
            <p className="text-sm text-slate-500">
              라이브 이벤트를 리플레이하여 현재 상태를 표시합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex items-center gap-1">
              <Badge
                variant="outline"
                className={
                  effectiveSyncStatus === "realtime"
                    ? "h-6 border-emerald-200 bg-emerald-50 text-emerald-700"
                    : effectiveSyncStatus === "connecting"
                      ? "h-6 border-amber-200 bg-amber-50 text-amber-700"
                      : stateBadgeBaseClass
                }
              >
                {effectiveSyncStatus === "realtime"
                  ? "실시간 연결"
                  : effectiveSyncStatus === "connecting"
                    ? "실시간 연결 중"
                    : "폴링 백업 동기화"}
              </Badge>
              {chatSession && (
                <Badge
                  variant="outline"
                  className={
                    chatSession.status === "live"
                      ? "h-6 border-emerald-200 bg-emerald-50 text-emerald-700"
                      : stateBadgeBaseClass
                  }
                >
                  채팅 {chatSession.status === "live" ? "LIVE" : "CLOSED"}
                </Badge>
              )}
              {chatCanJoin && chatSession && (
                <Badge
                  variant="outline"
                  className={
                    isChatWindowOpen
                      ? "h-6 border-sky-200 bg-sky-50 text-sky-700"
                      : stateBadgeBaseClass
                  }
                >
                  창 {isChatWindowOpen ? "열림" : "닫힘"}
                </Badge>
              )}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={lowSpecMode}
                onChange={(e) => persistLowSpec(e.target.checked)}
                className="h-4 w-4"
              />
              저사양 모드
            </label>
            {chatCanJoin && chatSession && (
              <Button onClick={handleChatEnter} variant="outline" size="sm" className="h-8">
                {isChatWindowOpen ? "채팅창 포커스" : "채팅 입장"}
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/t/${tournamentId}/participants`} className="no-underline hover:no-underline">
                참가자 현황으로
              </Link>
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
        ) : !state ? (
          <Card>
            <CardContent className="py-6 text-sm text-slate-500">
              아직 생성된 라이브 조편성 세션이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-slate-200/70">
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Badge
                    variant="outline"
                    className="h-6 border-amber-200 bg-amber-50 px-2 capitalize text-amber-700"
                  >
                    phase: {state.phase}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      state.status === "live"
                        ? "h-6 border-emerald-200 bg-emerald-50 px-2 capitalize text-emerald-700"
                        : `${stateBadgeBaseClass} px-2 capitalize`
                    }
                  >
                    session: {state.status}
                  </Badge>
                  <span className="text-slate-600">
                    진행: {state.totalPlayers - state.remainingPlayerIds.length}/{state.totalPlayers}
                  </span>
                  <span className="text-slate-600">step: {state.currentStep + 1}</span>
                  {state.targetGroupNo ? (
                    <span className="text-slate-600">타겟 조: {state.targetGroupNo}조</span>
                  ) : null}
                  {state.currentPickPlayerId &&
                  (state.phase === "confirmed" || state.phase === "finished") ? (
                    <span className="font-medium text-slate-800">
                      현재 당첨: {displayName(state.currentPickPlayerId)}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>

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

            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <Card className="border-slate-200/70">
                <CardHeader className="pb-1.5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">조 편성 현황</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{state.groupCount}개 조</span>
                      {isCompactLayout ? (
                        <Button
                          type="button"
                          onClick={() => setMobileGroupsPanelOpen((prev) => !prev)}
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                        >
                          {mobileGroupsPanelOpen ? "접기" : "펼치기"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                {!isCompactLayout || mobileGroupsPanelOpen ? (
                  <CardContent className="pt-0">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: state.groupCount }, (_, index) => index + 1).map(
                        (groupNo) => {
                          const memberCount = state.groups[groupNo].length;
                          const isGroupLocked = memberCount >= state.groupSize;
                          return (
                          <div
                            key={groupNo}
                            className={`rounded-lg border p-3 transition-colors ${
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
                        }
                      )}
                    </div>
                  </CardContent>
                ) : null}
              </Card>

              <Card className="border-slate-200/70">
                <CardHeader className="pb-1.5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">남은 추첨 대상</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{state.remainingPlayerIds.length}명</span>
                      {isCompactLayout ? (
                        <Button
                          type="button"
                          onClick={() => setMobileRemainingPanelOpen((prev) => !prev)}
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                        >
                          {mobileRemainingPanelOpen ? "접기" : "펼치기"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                {!isCompactLayout || mobileRemainingPanelOpen ? (
                  <CardContent className="pt-0">
                    {state.remainingPlayerIds.length === 0 ? (
                      <p className="text-sm text-slate-500">모든 인원 배정이 완료되었습니다.</p>
                    ) : (
                      <ul className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                        {state.remainingPlayerIds.map((registrationId) => (
                          <li
                            key={registrationId}
                            className="rounded-md border border-slate-200 bg-white px-3 py-2"
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
          </>
        )}
      </div>

      {isCompactLayout && chatOpen && (
        <section className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-4px_14px_rgba(15,23,42,0.1)] backdrop-blur">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">라이브 채팅</p>
              {chatSession && (
                <Badge
                  variant="outline"
                  className={
                    chatSession.status === "live"
                      ? "h-6 border-emerald-200 bg-emerald-50 text-emerald-700"
                      : stateBadgeBaseClass
                  }
                >
                  {chatSession.status === "live" ? "진행 중" : "종료"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setChatExpanded((prev) => !prev)}
                aria-label={chatExpanded ? "기본 채팅으로 축소" : "채팅 확장"}
              >
                {chatExpanded ? "기본" : "확장"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleCloseMobileChat}
                aria-label="채팅 닫기"
              >
                닫기
              </Button>
            </div>
          </div>

          <div
            className={chatExpanded ? "h-[42vh] overflow-y-auto px-3 py-2" : "h-[96px] overflow-hidden px-3 py-2"}
            onScroll={chatExpanded ? handleChatScroll : undefined}
          >
            {chatMessages.length === 0 ? (
              <p className="py-2 text-center text-xs text-slate-400">아직 메시지가 없습니다.</p>
            ) : (
              <ul className="space-y-1 text-[13px] leading-5">
                {(chatExpanded ? chatMessages : chatMessages.slice(-4)).map((m) => {
                  const isMine = chatUserId !== "" && m.user_id === chatUserId;
                  return (
                    <li key={m.id} className={isMine ? "rounded bg-emerald-50/70 px-1" : "px-1"}>
                      <span className={isMine ? "font-semibold text-emerald-700" : "font-semibold text-slate-700"}>
                        {isMine ? "나" : m.nickname}
                      </span>
                      <span className="mx-1 text-slate-400">:</span>
                      <span className={chatExpanded ? "break-words text-slate-800" : "inline-block max-w-full truncate align-bottom text-slate-800"}>
                        {m.message}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div ref={chatMessagesEndRef} />
          </div>

          {chatExpanded && chatUnreadCount > 0 && (
            <div className="flex justify-center border-t border-dashed bg-white/80 py-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  chatShouldAutoScrollRef.current = true;
                  chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                  setChatUnreadCount(0);
                }}
              >
                새 메시지 {chatUnreadCount}개
              </Button>
            </div>
          )}

          <div className="border-t px-3 py-2">
            <div className="flex gap-2">
              <Input
                ref={chatInputRef}
                value={chatInputMessage}
                onChange={(e) => setChatInputMessage(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="메시지를 입력하세요"
                maxLength={300}
                disabled={chatSession?.status !== "live"}
                className="h-9 flex-1"
              />
              <Button
                onClick={handleChatSend}
                disabled={!chatInputMessage.trim() || chatSending || chatSession?.status !== "live"}
                variant="outline"
                size="sm"
                className="h-9 px-3"
              >
                전송
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              {chatNickname ? `입장명: ${chatNickname} • ` : ""}
              {chatInputMessage.length}/300
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
