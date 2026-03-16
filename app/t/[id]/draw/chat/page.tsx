"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import { Badge } from "../../../../../components/ui/badge";
import {
  buildDrawChatBroadcastTopic,
  DRAW_CHAT_BROADCAST_EVENT,
  type DrawChatRealtimeMessage,
} from "../../../../../lib/draw/chatRealtime";

type ChatSessionInfo = {
  id: number;
  linkedDrawSessionId: number | null;
  status: "live" | "closed";
};

export default function DrawChatPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [nickname, setNickname] = useState("");
  const [canJoin, setCanJoin] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSessionInfo | null>(null);
  const [messages, setMessages] = useState<DrawChatRealtimeMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const appendMessage = (nextMessage: DrawChatRealtimeMessage) => {
    setMessages((prev) => {
      if (prev.some((item) => item.id === nextMessage.id)) return prev;
      return [...prev, nextMessage];
    });
    setParticipants((prev) => {
      if (prev.includes(nextMessage.nickname)) return prev;
      return [...prev, nextMessage.nickname];
    });
  };

  const scrollToBottom = (force = false) => {
    if (force || shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;

    let mounted = true;

    const fetchSession = async () => {
      setLoading(true);
      setMsg("");

      try {
        const response = await fetch(`/api/tournaments/${tournamentId}/draw-chat/session`, {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!mounted) return;

        if (!response.ok || !data.chatSession) {
          setCanJoin(false);
          setChatSession(null);
          setCurrentUserId("");
          setNickname("");
          setMessages([]);
          setParticipants([]);
          setMsg("채팅 세션을 불러오지 못했습니다.");
          setLoading(false);
          return;
        }

        const nextSession = data.chatSession as ChatSessionInfo;
        setCurrentUserId(typeof data.userId === "string" ? data.userId : "");
        setNickname(typeof data.nickname === "string" ? data.nickname : "");
        setCanJoin(Boolean(data.canJoin));
        setChatSession((prev) => {
          if (!prev || prev.id !== nextSession.id) {
            setMessages([]);
            setParticipants([]);
            setUnreadCount(0);
          }
          return nextSession;
        });

        if (!data.canJoin) {
          const reason =
            data.reason === "nickname_required"
              ? "채팅 입장을 위해 프로필 닉네임이 필요합니다."
              : data.reason === "chat_not_live"
                ? "채팅이 현재 닫혀 있습니다."
                : "채팅 입장 조건을 확인해주세요.";
          setMsg(reason);
        }

        setLoading(false);
      } catch (error) {
        if (!mounted) return;
        console.error("Failed to fetch chat page session:", error);
        setMsg("네트워크 오류로 채팅 세션을 불러오지 못했습니다.");
        setLoading(false);
      }
    };

    const supabase = createClient();
    const sessionChannel = supabase
      .channel(`draw-chat-session-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "draw_chat_sessions",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          void fetchSession();
        }
      )
      .subscribe();

    void fetchSession();

    return () => {
      mounted = false;
      sessionChannel.unsubscribe();
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!chatSession?.id) return;
    if (!Number.isFinite(tournamentId)) return;

    const supabase = createClient();
    const topic = buildDrawChatBroadcastTopic(tournamentId);
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: DRAW_CHAT_BROADCAST_EVENT }, ({ payload }) => {
        const newMsg = payload as DrawChatRealtimeMessage;
        if (!newMsg || newMsg.chatSessionId !== chatSession.id) return;
        const shouldStickToBottom = shouldAutoScrollRef.current;
        appendMessage(newMsg);
        setTimeout(() => {
          if (shouldStickToBottom) {
            scrollToBottom(true);
          } else {
            setUnreadCount((prev) => prev + 1);
          }
        }, 40);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [chatSession?.id, tournamentId]);

  const handleSend = async () => {
    if (!chatSession?.id || !inputMessage.trim() || sending) return;

    setSending(true);
    setMsg("");

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/draw-chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatSessionId: chatSession.id,
          message: inputMessage.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMsg(data.error ?? "메시지 전송에 실패했습니다.");
        return;
      }

      if (data.message) {
        appendMessage(data.message as DrawChatRealtimeMessage);
      }

      setInputMessage("");
      shouldAutoScrollRef.current = true;
      setTimeout(() => {
        scrollToBottom(true);
        inputRef.current?.focus();
      }, 0);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    shouldAutoScrollRef.current = isAtBottom;
    if (isAtBottom) {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewportHeight = () => {
      const header = document.querySelector("header");
      const headerHeight = header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
      const nextHeight = Math.max(320, window.innerHeight - Math.round(headerHeight));
      setViewportHeight(nextHeight);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  return (
    <main
      className="flex flex-col overflow-hidden bg-slate-50"
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
    >
      <div className="z-20 flex shrink-0 items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">라이브 채팅</h1>
          {nickname && (
            <p className="text-xs text-slate-500">
              입장명 <span className="font-medium">{nickname}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-6">
            참가 {participants.length}명
          </Badge>
          {chatSession && (
            <Badge
              variant="outline"
              className={
                chatSession.status === "live"
                  ? "h-6 border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "h-6"
              }
            >
              {chatSession.status === "live" ? "진행 중" : "종료"}
            </Badge>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-500">로딩 중...</p>
        </div>
      ) : !canJoin || !chatSession ? (
        <div className="flex flex-1 items-center justify-center">
          <Card className="mx-4 max-w-md">
            <CardContent className="py-6 text-center text-sm text-slate-600">
              {msg || "채팅에 입장할 수 없습니다."}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" onScroll={handleScroll}>
              <div className="space-y-1 text-[13px] leading-5">
                {messages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">
                    채팅이 시작되었습니다. 첫 메시지를 보내보세요.
                  </p>
                ) : (
                  messages.map((item) => (
                    <p
                      key={item.id}
                      className={
                        item.userId === currentUserId
                          ? "rounded bg-emerald-50/70 px-2 py-1"
                          : "px-2 py-1"
                      }
                    >
                      <span
                        className={
                          item.userId === currentUserId
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-slate-700"
                        }
                      >
                        {item.userId === currentUserId ? "나" : item.nickname}
                      </span>
                      <span className="mx-1 text-slate-400">:</span>
                      <span className="break-words text-slate-800">{item.message}</span>
                    </p>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {unreadCount > 0 && (
              <div className="flex justify-center border-t border-dashed bg-white/80 py-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    shouldAutoScrollRef.current = true;
                    scrollToBottom(true);
                  }}
                >
                  새 메시지 {unreadCount}개
                </Button>
              </div>
            )}

            <div className="z-20 shrink-0 border-t bg-white p-3">
              {msg && <div className="mb-2 rounded bg-red-50 px-3 py-1 text-xs text-red-700">{msg}</div>}
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요 (최대 300자)"
                  maxLength={300}
                  disabled={chatSession.status !== "live"}
                  className="h-10 flex-1"
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || sending || chatSession.status !== "live"}
                  size="sm"
                  variant="outline"
                  className="h-10 px-3"
                >
                  전송
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Enter로 전송 · {inputMessage.length}/300</p>
            </div>
          </div>

          <aside className="w-40 shrink-0 border-l bg-white sm:w-44 md:w-48">
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b px-3 py-2">
                <h2 className="text-xs font-semibold text-slate-600">참가자 ({participants.length})</h2>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                <ul className="space-y-1">
                  {participants.map((nick, idx) => (
                    <li key={`${nick}-${idx}`} className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span className="truncate">{nick}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
