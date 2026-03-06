"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../../../lib/supabaseClient";
import { Button } from "../../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Input } from "../../../../../components/ui/input";
import { Badge } from "../../../../../components/ui/badge";

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

export default function DrawChatPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = useMemo(() => Number(params.id), [params.id]);

  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState("");
  const [canJoin, setCanJoin] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSessionInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const scrollToBottom = (force = false) => {
    if (force || shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!Number.isFinite(tournamentId)) return;

    const fetchSession = async () => {
      setLoading(true);
      setMsg("");

      const response = await fetch(`/api/tournaments/${tournamentId}/draw-chat/session`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.canJoin) {
        setMsg(
          data.reason === "nickname_required"
            ? "프로필에서 닉네임을 설정해주세요."
            : data.reason === "chat_not_live"
              ? "채팅 세션이 종료되었습니다."
              : data.reason === "live_draw_session_not_found"
                ? "라이브 조편성 세션이 없습니다."
                : "채팅에 입장할 수 없습니다."
        );
        setLoading(false);
        return;
      }

      setNickname(data.nickname);
      setCanJoin(data.canJoin);
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
          setMessages(msgData as ChatMessage[]);
          setTimeout(() => scrollToBottom(true), 100);
        }
      }

      setLoading(false);
    };

    void fetchSession();
  }, [tournamentId]);

  useEffect(() => {
    if (!chatSession?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`draw-chat-${chatSession.id}`)
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
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(), 50);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [chatSession?.id]);

  const handleSend = async () => {
    if (!chatSession?.id || !inputMessage.trim()) return;

    setSending(true);
    setMsg("");

    const response = await fetch(`/api/tournaments/${tournamentId}/draw-chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatSessionId: chatSession.id,
        message: inputMessage.trim(),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "전송 실패" }));
      setMsg(data.error ?? "메시지 전송에 실패했습니다.");
      setSending(false);
      return;
    }

    setInputMessage("");
    setSending(false);
    shouldAutoScrollRef.current = true;
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
  };

  return (
    <main className="flex h-screen flex-col bg-slate-50">
      <div className="flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">라이브 채팅</h1>
          {nickname && (
            <p className="text-xs text-slate-500">
              입장명: <span className="font-medium">{nickname}</span>
            </p>
          )}
        </div>
        {chatSession && (
          <Badge variant={chatSession.status === "live" ? "default" : "secondary"}>
            {chatSession.status === "live" ? "진행 중" : "종료"}
          </Badge>
        )}
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
        <>
          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            onScroll={handleScroll}
          >
            <div className="space-y-3">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  첫 번째 메시지를 보내보세요!
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg bg-white px-3 py-2 shadow-sm"
                  >
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {m.nickname}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(m.created_at).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-slate-800">
                      {m.message}
                    </p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t bg-white p-4">
            {msg && (
              <div className="mb-2 rounded bg-red-50 px-3 py-1 text-xs text-red-700">
                {msg}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요 (최대 300자)"
                maxLength={300}
                disabled={sending || chatSession.status !== "live"}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={
                  !inputMessage.trim() ||
                  sending ||
                  chatSession.status !== "live"
                }
              >
                전송
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">
              Enter로 전송 • {inputMessage.length}/300
            </p>
          </div>
        </>
      )}
    </main>
  );
}
