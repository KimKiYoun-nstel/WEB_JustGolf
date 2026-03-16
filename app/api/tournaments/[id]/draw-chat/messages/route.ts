import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../lib/apiGuard";
import type { DrawChatRealtimeMessage } from "../../../../../../lib/draw/chatRealtime";
import { publishDrawChatBroadcastMessage } from "../../../../../../lib/server/drawChatBroadcast";

type DrawChatMessageBody = {
  chatSessionId?: number;
  message?: string;
};

type DrawChatSessionRow = {
  id: number;
  tournament_id: number;
  status: "live" | "closed";
};

type RateLimitBucket = {
  count: number;
  windowStartAt: number;
  lastSeenAt: number;
};

type NicknameCacheEntry = {
  nickname: string;
  expiresAt: number;
};

const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_STALE_MS = 60_000;
const NICKNAME_CACHE_TTL_MS = 5 * 60_000;

function getRateLimitStore() {
  const globalObj = globalThis as typeof globalThis & {
    __drawChatRateLimitStore?: Map<string, RateLimitBucket>;
    __drawChatRateLimitLastGcAt?: number;
  };

  if (!globalObj.__drawChatRateLimitStore) {
    globalObj.__drawChatRateLimitStore = new Map<string, RateLimitBucket>();
  }
  return globalObj.__drawChatRateLimitStore;
}

function getNicknameCache() {
  const globalObj = globalThis as typeof globalThis & {
    __drawChatNicknameCache?: Map<string, NicknameCacheEntry>;
  };
  if (!globalObj.__drawChatNicknameCache) {
    globalObj.__drawChatNicknameCache = new Map<string, NicknameCacheEntry>();
  }
  return globalObj.__drawChatNicknameCache;
}

function garbageCollectRateLimitStore(now: number) {
  const globalObj = globalThis as typeof globalThis & {
    __drawChatRateLimitStore?: Map<string, RateLimitBucket>;
    __drawChatRateLimitLastGcAt?: number;
  };

  if (!globalObj.__drawChatRateLimitStore) return;

  const lastGcAt = globalObj.__drawChatRateLimitLastGcAt ?? 0;
  if (now - lastGcAt < 10_000) return;

  for (const [key, bucket] of globalObj.__drawChatRateLimitStore.entries()) {
    if (now - bucket.lastSeenAt > RATE_LIMIT_STALE_MS) {
      globalObj.__drawChatRateLimitStore.delete(key);
    }
  }

  globalObj.__drawChatRateLimitLastGcAt = now;
}

function parseTournamentId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function checkMessageRateLimit(params: { tournamentId: number; userId: string }) {
  const store = getRateLimitStore();
  const now = Date.now();
  garbageCollectRateLimitStore(now);

  const key = `${params.tournamentId}:${params.userId}`;
  const bucket = store.get(key);

  if (!bucket || now - bucket.windowStartAt >= RATE_LIMIT_WINDOW_MS) {
    store.set(key, {
      count: 1,
      windowStartAt: now,
      lastSeenAt: now,
    });
    return { allowed: true as const };
  }

  bucket.lastSeenAt = now;

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = Math.max(1, RATE_LIMIT_WINDOW_MS - (now - bucket.windowStartAt));
    return {
      allowed: false as const,
      retryAfterMs,
    };
  }

  bucket.count += 1;
  return { allowed: true as const };
}

async function resolveNickname(guard: Awaited<ReturnType<typeof requireApiUser>>) {
  if ("error" in guard) {
    return { error: "guard-error" as const };
  }

  const cache = getNicknameCache();
  const now = Date.now();
  const cached = cache.get(guard.user.id);
  if (cached && cached.expiresAt > now) {
    return { nickname: cached.nickname };
  }

  const profileRes = await guard.supabase
    .from("profiles")
    .select("nickname")
    .eq("id", guard.user.id)
    .maybeSingle();

  if (profileRes.error) {
    return { error: profileRes.error.message };
  }

  const profile = (profileRes.data ?? null) as { nickname?: string | null } | null;
  const nickname = (profile?.nickname ?? "").trim();
  if (!nickname) {
    return { error: "채팅 입장을 위해 프로필 닉네임이 필요합니다." };
  }

  cache.set(guard.user.id, {
    nickname,
    expiresAt: now + NICKNAME_CACHE_TTL_MS,
  });

  return { nickname };
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

    const rateLimitResult = checkMessageRateLimit({
      tournamentId,
      userId: guard.user.id,
    });
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "전송 속도가 너무 빠릅니다. 1초에 최대 3회까지 전송할 수 있습니다.",
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        { status: 429 }
      );
    }

    const nicknameResult = await resolveNickname(guard);
    if ("error" in nicknameResult) {
      const status =
        nicknameResult.error === "채팅 입장을 위해 프로필 닉네임이 필요합니다."
          ? 400
          : 500;
      return NextResponse.json({ error: nicknameResult.error }, { status });
    }

    const chatSessionRes = await guard.supabase
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

    const realtimeMessage: DrawChatRealtimeMessage = {
      id: crypto.randomUUID(),
      chatSessionId,
      tournamentId,
      userId: guard.user.id,
      nickname: nicknameResult.nickname,
      message,
      createdAt: new Date().toISOString(),
    };

    const publishResult = await publishDrawChatBroadcastMessage({
      tournamentId,
      message: realtimeMessage,
    });
    if ("error" in publishResult) {
      return NextResponse.json(
        { error: `메시지 브로드캐스트 실패: ${publishResult.error}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: realtimeMessage }, { status: 201 });
  } catch (error) {
    console.error("Draw chat messages API POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
