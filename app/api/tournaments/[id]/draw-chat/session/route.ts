import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../../lib/apiGuard";

type DrawChatSessionRow = {
  id: number;
  linked_draw_session_id: number | null;
  status: "live" | "closed";
};

function parseTournamentId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await params;
    const tournamentId = parseTournamentId(resolved.id);
    if (!tournamentId) {
      return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
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
    const supabaseAdmin = createServiceRoleSupabaseClient();

    const chatSessionRes = await supabaseAdmin
      .from("draw_chat_sessions")
      .select("id,linked_draw_session_id,status")
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chatSessionRes.error) {
      return NextResponse.json({ error: chatSessionRes.error.message }, { status: 500 });
    }

    if (!chatSessionRes.data) {
      return NextResponse.json({
        userId: guard.user.id,
        nickname,
        canJoin: false,
        chatSession: null,
        reason: "chat_session_not_found",
      });
    }

    const chatSession = chatSessionRes.data as DrawChatSessionRow;
    const canJoin = chatSession.status === "live" && nickname.length > 0;

    return NextResponse.json({
      userId: guard.user.id,
      nickname,
      canJoin,
      chatSession: {
        id: chatSession.id,
        linkedDrawSessionId: chatSession.linked_draw_session_id,
        status: chatSession.status,
      },
      reason: canJoin ? null : nickname.length === 0 ? "nickname_required" : "chat_not_live",
    });
  } catch (error) {
    console.error("Draw chat session API GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
