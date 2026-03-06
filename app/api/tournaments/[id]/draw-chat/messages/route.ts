import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../../lib/apiGuard";

type DrawChatMessageBody = {
  chatSessionId?: number;
  message?: string;
};

type DrawChatSessionRow = {
  id: number;
  tournament_id: number;
  status: "live" | "closed";
};

function parseTournamentId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await params;
    const tournamentId = parseTournamentId(resolved.id);
    if (!tournamentId) {
      return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as DrawChatMessageBody | null;
    const chatSessionId = normalizePositiveInt(body?.chatSessionId);
    const rawMessage = typeof body?.message === "string" ? body.message : "";
    const message = rawMessage.trim();

    if (!chatSessionId) {
      return NextResponse.json({ error: "chatSessionId is required" }, { status: 400 });
    }

    if (message.length === 0) {
      return NextResponse.json({ error: "메시지를 입력해주세요." }, { status: 400 });
    }

    if (message.length > 300) {
      return NextResponse.json(
        { error: "메시지는 300자 이하로 입력해주세요." },
        { status: 400 }
      );
    }

    const guard = await requireApiUser();
    if ("error" in guard) {
      return guard.error;
    }

    const profileRes = await guard.supabase
      .from("profiles")
      .select("nickname")
      .eq("id", guard.user.id)
      .maybeSingle();

    if (profileRes.error) {
      return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
    }

    const profile = (profileRes.data ?? null) as { nickname?: string | null } | null;
    const nickname = (profile?.nickname ?? "").trim();
    if (!nickname) {
      return NextResponse.json(
        { error: "채팅 입장을 위해 프로필 닉네임이 필요합니다." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();
    const chatSessionRes = await supabaseAdmin
      .from("draw_chat_sessions")
      .select("id,tournament_id,status")
      .eq("id", chatSessionId)
      .maybeSingle();

    if (chatSessionRes.error) {
      return NextResponse.json({ error: chatSessionRes.error.message }, { status: 500 });
    }

    if (!chatSessionRes.data) {
      return NextResponse.json({ error: "채팅 세션을 찾을 수 없습니다." }, { status: 404 });
    }

    const chatSession = chatSessionRes.data as DrawChatSessionRow;
    if (chatSession.tournament_id !== tournamentId) {
      return NextResponse.json(
        { error: "Tournament and chat session do not match." },
        { status: 400 }
      );
    }

    if (chatSession.status !== "live") {
      return NextResponse.json(
        { error: "종료된 채팅 세션에는 메시지를 전송할 수 없습니다." },
        { status: 409 }
      );
    }

    const insertRes = await guard.supabase
      .from("draw_chat_messages")
      .insert({
        chat_session_id: chatSessionId,
        tournament_id: tournamentId,
        user_id: guard.user.id,
        nickname,
        message,
      })
      .select("id,chat_session_id,tournament_id,user_id,nickname,message,created_at")
      .single();

    if (insertRes.error || !insertRes.data) {
      return NextResponse.json(
        { error: insertRes.error?.message ?? "메시지 전송에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: insertRes.data }, { status: 201 });
  } catch (error) {
    console.error("Draw chat messages API POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
