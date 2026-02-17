import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleSupabaseClient,
  requireApiUser,
} from "../../../../../../lib/apiGuard";
import {
  replayDrawEvents,
  resolveTargetGroupNo,
} from "../../../../../../lib/draw/reducer";
import type {
  DrawEventRecord,
  DrawMode,
  DrawSessionSeed,
} from "../../../../../../lib/draw/types";
import { isDrawEventType } from "../../../../../../lib/draw/types";
import {
  deriveDrawSeed,
  resolveScoreboardCursorIndex,
} from "../../../../../../lib/draw/animators/scoreboard/path";

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

type DrawActionBody = {
  action?:
    | "start_session"
    | "shuffle_deck"
    | "start_step"
    | "pick_result"
    | "assign_update"
    | "assign_confirm"
    | "move_member"
    | "undo_last"
    | "reset_draw";
  sessionId?: number;
  groupCount?: number;
  groupSize?: number;
  playerIds?: number[];
  mode?: DrawMode;
  targetGroupNo?: number | null;
  durationMs?: number;
  groupNo?: number;
  playerId?: number;
  toGroupNo?: number;
  cursorIndex?: number;
  pickedAtMs?: number;
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

function normalizeEventRow(row: DrawEventRow): DrawEventRecord | null {
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

function buildSeed(session: DrawSessionRow): DrawSessionSeed {
  const playerIds = Array.isArray(session.player_ids)
    ? session.player_ids.filter((id) => Number.isInteger(id) && id > 0)
    : [];

  return {
    sessionId: session.id,
    tournamentId: session.tournament_id,
    status: session.status,
    groupCount: session.group_count,
    groupSize: session.group_size,
    totalPlayers: session.total_players,
    playerIds,
  };
}

async function loadSessionWithState(
  supabaseAdmin: ReturnType<typeof createServiceRoleSupabaseClient>,
  sessionId: number
) {
  const sessionRes = await supabaseAdmin
    .from("draw_sessions")
    .select(
      "id,tournament_id,status,group_count,group_size,total_players,player_ids,current_step"
    )
    .eq("id", sessionId)
    .single();

  if (sessionRes.error || !sessionRes.data) {
    return { error: sessionRes.error?.message ?? "세션을 찾을 수 없습니다." };
  }

  const session = sessionRes.data as DrawSessionRow;

  const eventRes = await supabaseAdmin
    .from("draw_events")
    .select("id,session_id,step,event_type,payload,created_at")
    .eq("session_id", session.id)
    .order("step", { ascending: true })
    .order("id", { ascending: true });

  if (eventRes.error) {
    return { error: eventRes.error.message };
  }

  const events = ((eventRes.data ?? []) as DrawEventRow[])
    .map(normalizeEventRow)
    .filter((event): event is DrawEventRecord => event !== null);

  const state = replayDrawEvents(buildSeed(session), events);
  return { session, events, state };
}

async function ensureGroupRow(
  supabaseAdmin: ReturnType<typeof createServiceRoleSupabaseClient>,
  tournamentId: number,
  groupNo: number
) {
  const existing = await supabaseAdmin
    .from("tournament_groups")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("group_no", groupNo)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Group lookup failed: ${existing.error.message}`);
  }

  if (existing.data?.id) {
    return existing.data.id as number;
  }

  const inserted = await supabaseAdmin
    .from("tournament_groups")
    .insert({
      tournament_id: tournamentId,
      group_no: groupNo,
      is_published: false,
    })
    .select("id")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(`Group create failed: ${inserted.error?.message ?? "unknown"}`);
  }

  return inserted.data.id as number;
}

async function syncAssignmentToGroupsTable(
  supabaseAdmin: ReturnType<typeof createServiceRoleSupabaseClient>,
  params: {
    tournamentId: number;
    groupNo: number;
    registrationId: number;
    groupSize: number;
  }
) {
  const groupId = await ensureGroupRow(
    supabaseAdmin,
    params.tournamentId,
    params.groupNo
  );

  const currentAssignment = await supabaseAdmin
    .from("tournament_group_members")
    .select("id,group_id,position")
    .eq("registration_id", params.registrationId)
    .maybeSingle();

  if (currentAssignment.error) {
    throw new Error(`Current assignment lookup failed: ${currentAssignment.error.message}`);
  }

  if (currentAssignment.data?.group_id === groupId) {
    return;
  }

  const membersRes = await supabaseAdmin
    .from("tournament_group_members")
    .select("position")
    .eq("group_id", groupId);

  if (membersRes.error) {
    throw new Error(`Group members lookup failed: ${membersRes.error.message}`);
  }

  const used = new Set<number>(
    ((membersRes.data ?? []) as Array<{ position: number }>).map((row) => row.position)
  );
  let nextPosition: number | null = null;
  for (let position = 1; position <= params.groupSize; position += 1) {
    if (!used.has(position)) {
      nextPosition = position;
      break;
    }
  }

  if (!nextPosition) {
    throw new Error(`Target group (${params.groupNo}) has no available slot.`);
  }

  if (currentAssignment.data?.id) {
    const updateRes = await supabaseAdmin
      .from("tournament_group_members")
      .update({ group_id: groupId, position: nextPosition })
      .eq("id", currentAssignment.data.id);

    if (updateRes.error) {
      throw new Error(`Move existing assignment failed: ${updateRes.error.message}`);
    }
    return;
  }

  const insertRes = await supabaseAdmin.from("tournament_group_members").insert({
    group_id: groupId,
    registration_id: params.registrationId,
    position: nextPosition,
  });

  if (insertRes.error) {
    throw new Error(`Insert assignment failed: ${insertRes.error.message}`);
  }
}

async function removeAssignmentFromGroupsTable(
  supabaseAdmin: ReturnType<typeof createServiceRoleSupabaseClient>,
  registrationId: number
) {
  const deleteRes = await supabaseAdmin
    .from("tournament_group_members")
    .delete()
    .eq("registration_id", registrationId);

  if (deleteRes.error) {
    throw new Error(`Assignment removal failed: ${deleteRes.error.message}`);
  }
}

function findPlayerGroupNo(
  groups: Record<number, number[]>,
  playerId: number
): number | null {
  for (const [groupNo, members] of Object.entries(groups)) {
    if (members.includes(playerId)) {
      return Number(groupNo);
    }
  }
  return null;
}

function isGroupFull(
  groups: Record<number, number[]>,
  groupNo: number,
  groupSize: number
) {
  const currentSize = groups[groupNo]?.length ?? 0;
  return currentSize >= groupSize;
}

function findNextAvailableGroupNo(params: {
  groups: Record<number, number[]>;
  groupCount: number;
  groupSize: number;
  preferredGroupNo: number;
}): number | null {
  const { groups, groupCount, groupSize, preferredGroupNo } = params;
  const normalizedPreferred =
    ((Math.max(1, preferredGroupNo) - 1) % groupCount) + 1;

  for (let offset = 0; offset < groupCount; offset += 1) {
    const candidate = ((normalizedPreferred - 1 + offset) % groupCount) + 1;
    if (!isGroupFull(groups, candidate, groupSize)) {
      return candidate;
    }
  }

  return null;
}

function createStepSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function isSameOrder(left: number[], right: number[]) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function createStepPrng(seed: number) {
  let state = (seed ^ 0xa5a5a5a5) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function shuffleDeckWithSeed(playerIds: number[], seed: number) {
  const out = [...playerIds];
  const random = createStepPrng(seed);
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [out[index], out[swapWith]] = [out[swapWith], out[index]];
  }
  return out;
}

function resolveStepCandidatePool(state: { remainingPlayerIds: number[]; stepDeckPlayerIds?: number[] | null }) {
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseTournamentId(id);
    if (!tournamentId) {
      return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
    }

    const guard = await requireApiUser({ requireAdmin: true });
    if ("error" in guard) {
      return guard.error;
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();
    const sessionRes = await supabaseAdmin
      .from("draw_sessions")
      .select(
        "id,tournament_id,status,group_count,group_size,total_players,player_ids,current_step"
      )
      .eq("tournament_id", tournamentId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionRes.error) {
      return NextResponse.json({ error: sessionRes.error.message }, { status: 500 });
    }

    if (!sessionRes.data) {
      return NextResponse.json({ session: null, events: [] }, { status: 200 });
    }

    const session = sessionRes.data as DrawSessionRow;
    const eventRes = await supabaseAdmin
      .from("draw_events")
      .select("id,session_id,step,event_type,payload,created_at")
      .eq("session_id", session.id)
      .order("step", { ascending: true })
      .order("id", { ascending: true });

    if (eventRes.error) {
      return NextResponse.json({ error: eventRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      session,
      events: (eventRes.data ?? []) as DrawEventRow[],
    });
  } catch (error) {
    console.error("Draw API GET error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseTournamentId(id);
    if (!tournamentId) {
      return NextResponse.json({ error: "Invalid tournament id" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as DrawActionBody | null;
    if (!body?.action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const guard = await requireApiUser({ requireAdmin: true });
    if ("error" in guard) {
      return guard.error;
    }

    const supabaseAdmin = createServiceRoleSupabaseClient();

    if (body.action === "reset_draw") {
      const latestSessionRes = await supabaseAdmin
        .from("draw_sessions")
        .select(
          "id,tournament_id,status,group_count,group_size,total_players,player_ids,current_step"
        )
        .eq("tournament_id", tournamentId)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSessionRes.error) {
        return NextResponse.json(
          { error: latestSessionRes.error.message },
          { status: 500 }
        );
      }

      if (!latestSessionRes.data) {
        return NextResponse.json(
          { error: "리셋할 조편성 세션이 없습니다." },
          { status: 400 }
        );
      }

      const latestSession = latestSessionRes.data as DrawSessionRow;

      const regRes = await supabaseAdmin
        .from("registrations")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("status", "approved")
        .order("id", { ascending: true });

      if (regRes.error) {
        return NextResponse.json({ error: regRes.error.message }, { status: 500 });
      }

      const playerIds = ((regRes.data ?? []) as Array<{ id: number }>).map((row) => row.id);
      if (playerIds.length === 0) {
        return NextResponse.json(
          { error: "리셋 후 시작할 승인 참가자가 없습니다." },
          { status: 400 }
        );
      }

      const groupSize = Math.max(1, latestSession.group_size || 4);
      const groupCount = Math.max(
        Math.max(1, latestSession.group_count || 1),
        Math.ceil(playerIds.length / groupSize)
      );

      const groupsRes = await supabaseAdmin
        .from("tournament_groups")
        .select("id")
        .eq("tournament_id", tournamentId);

      if (groupsRes.error) {
        return NextResponse.json({ error: groupsRes.error.message }, { status: 500 });
      }

      const groupIds = ((groupsRes.data ?? []) as Array<{ id: number }>).map((row) => row.id);
      if (groupIds.length > 0) {
        const deleteMembersRes = await supabaseAdmin
          .from("tournament_group_members")
          .delete()
          .in("group_id", groupIds);
        if (deleteMembersRes.error) {
          return NextResponse.json(
            { error: deleteMembersRes.error.message },
            { status: 500 }
          );
        }
      }

      const sessionsRes = await supabaseAdmin
        .from("draw_sessions")
        .select("id")
        .eq("tournament_id", tournamentId);

      if (sessionsRes.error) {
        return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
      }

      const sessionIds = ((sessionsRes.data ?? []) as Array<{ id: number }>).map((row) => row.id);
      if (sessionIds.length > 0) {
        const deleteEventsRes = await supabaseAdmin
          .from("draw_events")
          .delete()
          .in("session_id", sessionIds);
        if (deleteEventsRes.error) {
          return NextResponse.json(
            { error: deleteEventsRes.error.message },
            { status: 500 }
          );
        }
      }

      const deleteSessionsRes = await supabaseAdmin
        .from("draw_sessions")
        .delete()
        .eq("tournament_id", tournamentId);
      if (deleteSessionsRes.error) {
        return NextResponse.json(
          { error: deleteSessionsRes.error.message },
          { status: 500 }
        );
      }

      await supabaseAdmin
        .from("tournament_groups")
        .update({ is_published: false })
        .eq("tournament_id", tournamentId);

      const restartedAt = new Date().toISOString();
      const newSessionRes = await supabaseAdmin
        .from("draw_sessions")
        .insert({
          tournament_id: tournamentId,
          status: "live",
          group_count: groupCount,
          group_size: groupSize,
          total_players: playerIds.length,
          player_ids: playerIds,
          current_step: 0,
          started_at: restartedAt,
          created_by: guard.user.id,
        })
        .select(
          "id,tournament_id,status,group_count,group_size,total_players,player_ids,current_step"
        )
        .single();

      if (newSessionRes.error || !newSessionRes.data) {
        return NextResponse.json(
          { error: newSessionRes.error?.message ?? "리셋 후 세션 생성 실패" },
          { status: 500 }
        );
      }

      const sessionStartEventRes = await supabaseAdmin.from("draw_events").insert({
        session_id: newSessionRes.data.id,
        step: 0,
        event_type: "SESSION_STARTED",
        payload: { startedAt: restartedAt, playerIds },
        created_by: guard.user.id,
      });

      if (sessionStartEventRes.error) {
        return NextResponse.json(
          { error: sessionStartEventRes.error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, session: newSessionRes.data }, { status: 200 });
    }

    if (body.action === "start_session") {
      const liveSessionCheck = await supabaseAdmin
        .from("draw_sessions")
        .select("id,status")
        .eq("tournament_id", tournamentId)
        .eq("status", "live")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (liveSessionCheck.error) {
        return NextResponse.json(
          { error: liveSessionCheck.error.message },
          { status: 500 }
        );
      }

      if (liveSessionCheck.data?.id) {
        return NextResponse.json(
          { error: "A live draw session is already running." },
          { status: 409 }
        );
      }

      let playerIds: number[] = [];
      if (Array.isArray(body.playerIds) && body.playerIds.length > 0) {
        playerIds = Array.from(
          new Set(
            body.playerIds.filter(
              (value) => Number.isInteger(value) && Number(value) > 0
            )
          )
        );
      } else {
        const regRes = await supabaseAdmin
          .from("registrations")
          .select("id")
          .eq("tournament_id", tournamentId)
          .eq("status", "approved")
          .order("id", { ascending: true });

        if (regRes.error) {
          return NextResponse.json({ error: regRes.error.message }, { status: 500 });
        }

        playerIds = ((regRes.data ?? []) as Array<{ id: number }>).map((row) => row.id);
      }

      if (playerIds.length === 0) {
        return NextResponse.json(
          { error: "No approved participants available for draw." },
          { status: 400 }
        );
      }

      const groupSize = normalizePositiveInt(body.groupSize) ?? 4;
      const groupCount =
        normalizePositiveInt(body.groupCount) ??
        Math.ceil(playerIds.length / groupSize);

      if (groupCount * groupSize < playerIds.length) {
        return NextResponse.json(
          { error: "groupCount x groupSize is smaller than participants." },
          { status: 400 }
        );
      }

      const startedAt = new Date().toISOString();
      const insertedSession = await supabaseAdmin
        .from("draw_sessions")
        .insert({
          tournament_id: tournamentId,
          status: "live",
          group_count: groupCount,
          group_size: groupSize,
          total_players: playerIds.length,
          player_ids: playerIds,
          current_step: 0,
          started_at: startedAt,
          created_by: guard.user.id,
        })
        .select(
          "id,tournament_id,status,group_count,group_size,total_players,player_ids,current_step"
        )
        .single();

      if (insertedSession.error || !insertedSession.data) {
        return NextResponse.json(
          { error: insertedSession.error?.message ?? "Session creation failed" },
          { status: 500 }
        );
      }

      const session = insertedSession.data as DrawSessionRow;
      const sessionStartEvent = await supabaseAdmin.from("draw_events").insert({
        session_id: session.id,
        step: 0,
        event_type: "SESSION_STARTED",
        payload: { startedAt, playerIds },
        created_by: guard.user.id,
      });

      if (sessionStartEvent.error) {
        return NextResponse.json(
          { error: sessionStartEvent.error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ session }, { status: 201 });
    }

    const sessionId = normalizePositiveInt(body.sessionId);
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const loaded = await loadSessionWithState(supabaseAdmin, sessionId);
    if ("error" in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: 400 });
    }

    const { session, state, events } = loaded;
    if (session.tournament_id !== tournamentId) {
      return NextResponse.json(
        { error: "Tournament and session do not match." },
        { status: 400 }
      );
    }

    if (body.action === "shuffle_deck") {
      if (state.phase === "configured" || state.phase === "picked") {
        return NextResponse.json(
          { error: "Cannot shuffle deck during active pick step." },
          { status: 409 }
        );
      }

      if (state.remainingPlayerIds.length <= 1) {
        return NextResponse.json(
          { error: "Not enough remaining participants to shuffle." },
          { status: 409 }
        );
      }

      const original = [...state.remainingPlayerIds];
      let shuffled = original;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        shuffled = shuffleDeckWithSeed(original, createStepSeed());
        if (!isSameOrder(shuffled, original)) break;
      }
      if (isSameOrder(shuffled, original) && original.length > 1) {
        shuffled = [...original];
        const lastIndex = shuffled.length - 1;
        [shuffled[0], shuffled[lastIndex]] = [shuffled[lastIndex], shuffled[0]];
      }

      const remainingSet = new Set(state.remainingPlayerIds);
      const assignedInSessionOrder = (session.player_ids ?? []).filter(
        (playerId) => Number.isInteger(playerId) && !remainingSet.has(playerId)
      );
      const nextPlayerIds = [...shuffled, ...assignedInSessionOrder];

      const updateRes = await supabaseAdmin
        .from("draw_sessions")
        .update({ player_ids: nextPlayerIds })
        .eq("id", session.id);

      if (updateRes.error) {
        return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
      }

      // State is rebuilt from event replay; keep SESSION_STARTED payload in sync with shuffled order.
      const sessionStartedEvent = events.find((event) => event.event_type === "SESSION_STARTED");
      if (sessionStartedEvent?.id) {
        const startedAt =
          typeof (sessionStartedEvent.payload as { startedAt?: unknown })?.startedAt === "string"
            ? String((sessionStartedEvent.payload as { startedAt?: string }).startedAt)
            : new Date().toISOString();
        const syncEventRes = await supabaseAdmin
          .from("draw_events")
          .update({
            payload: {
              startedAt,
              playerIds: nextPlayerIds,
            },
          })
          .eq("id", sessionStartedEvent.id);

        if (syncEventRes.error) {
          return NextResponse.json({ error: syncEventRes.error.message }, { status: 500 });
        }
      }

      return NextResponse.json(
        { ok: true, shuffledCount: shuffled.length },
        { status: 200 }
      );
    }

    if (body.action === "start_step") {
      if (state.remainingPlayerIds.length === 0) {
        return NextResponse.json(
          { error: "No remaining participants." },
          { status: 409 }
        );
      }

      const mode: DrawMode = body.mode === "TARGET_GROUP" ? "TARGET_GROUP" : "ROUND_ROBIN";
      const completedCount = session.total_players - state.remainingPlayerIds.length;
      const step = completedCount;
      const durationMs = Math.min(
        15000,
        Math.max(1000, normalizePositiveInt(body.durationMs) ?? 6500)
      );
      const resolvedTargetGroupNo = resolveTargetGroupNo({
        step,
        mode,
        targetGroupNo: body.targetGroupNo,
        groupCount: session.group_count,
      });
      let targetGroupNo: number | null = null;
      if (mode === "TARGET_GROUP") {
        if (isGroupFull(state.groups, resolvedTargetGroupNo, session.group_size)) {
          return NextResponse.json(
            { error: `Target group (${resolvedTargetGroupNo}) is already full.` },
            { status: 409 }
          );
        }
        targetGroupNo = resolvedTargetGroupNo;
      } else {
        targetGroupNo = findNextAvailableGroupNo({
          groups: state.groups,
          groupCount: session.group_count,
          groupSize: session.group_size,
          preferredGroupNo: resolvedTargetGroupNo,
        });
        if (!targetGroupNo) {
          return NextResponse.json(
            { error: "All groups are already full." },
            { status: 409 }
          );
        }
      }
      const startedAt = new Date().toISOString();
      const seed = createStepSeed();
      const deckOrder = [...state.remainingPlayerIds];
      const tempo = {
        baseHz: 10,
        slowdownMs: Math.min(7500, Math.max(1300, Math.round(durationMs * 0.62))),
        nearMiss: 0,
      };

      const eventRes = await supabaseAdmin
        .from("draw_events")
        .insert({
          session_id: session.id,
          step,
          event_type: "STEP_CONFIGURED",
          payload: {
            mode,
            targetGroupNo,
            startedAt,
            durationMs,
            seed,
            pattern: "scoreboard-chase-v1",
            tempo,
            deckOrder,
          },
          created_by: guard.user.id,
        })
        .select("id,session_id,step,event_type,payload,created_at")
        .single();

      if (eventRes.error || !eventRes.data) {
        return NextResponse.json(
          { error: eventRes.error?.message ?? "STEP_CONFIGURED insert failed" },
          { status: 500 }
        );
      }

      await supabaseAdmin
        .from("draw_sessions")
        .update({ current_step: step, status: "live", ended_at: null })
        .eq("id", session.id);

      return NextResponse.json({ event: eventRes.data }, { status: 201 });
    }

    if (body.action === "pick_result") {
      if (state.phase !== "configured" && state.phase !== "picked") {
        return NextResponse.json(
          { error: "Current step is not ready for pick." },
          { status: 409 }
        );
      }

      if (state.remainingPlayerIds.length === 0) {
        return NextResponse.json(
          { error: "No remaining participants." },
          { status: 409 }
        );
      }

      const candidatePool = resolveStepCandidatePool(state);
      if (candidatePool.length === 0) {
        return NextResponse.json(
          { error: "No candidates available for this step." },
          { status: 409 }
        );
      }

      const explicitCursorIndex =
        Number.isInteger(body.cursorIndex) &&
        Number(body.cursorIndex) >= 0 &&
        Number(body.cursorIndex) < candidatePool.length
          ? Number(body.cursorIndex)
          : null;
      const pickedAtMs =
        typeof body.pickedAtMs === "number" && Number.isFinite(body.pickedAtMs)
          ? body.pickedAtMs
          : Date.now();
      const startedAtMs = state.startedAt ? new Date(state.startedAt).getTime() : Date.now();
      const durationMs = Math.min(30000, Math.max(800, state.durationMs ?? 3500));
      const stepSeed =
        typeof state.stepSeed === "number" && Number.isFinite(state.stepSeed)
          ? state.stepSeed
          : deriveDrawSeed([
              "scoreboard-v1",
              state.currentStep,
              state.startedAt ?? "none",
              durationMs,
              candidatePool.join(","),
            ]);
      const resolvedCursorIndex =
        explicitCursorIndex ??
        resolveScoreboardCursorIndex({
          candidateCount: candidatePool.length,
          durationMs,
          seed: stepSeed,
          tempo: state.stepTempo ?? undefined,
          startedAtMs,
          atMs: pickedAtMs,
        });
      const playerId = candidatePool[resolvedCursorIndex];
      if (!playerId) {
        return NextResponse.json(
          { error: "Failed to resolve picked player." },
          { status: 500 }
        );
      }

      const eventRes = await supabaseAdmin
        .from("draw_events")
        .insert({
          session_id: session.id,
          step: state.currentStep,
          event_type: "PICK_RESULT",
          payload: { playerId },
          created_by: guard.user.id,
        })
        .select("id,session_id,step,event_type,payload,created_at")
        .single();

      if (eventRes.error || !eventRes.data) {
        return NextResponse.json(
          { error: eventRes.error?.message ?? "PICK_RESULT insert failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({ event: eventRes.data }, { status: 201 });
    }

    if (body.action === "assign_update") {
      if (state.phase !== "picked" || !state.currentPickPlayerId) {
        return NextResponse.json(
          { error: "Current state is not assign-update ready." },
          { status: 409 }
        );
      }

      const groupNo = normalizePositiveInt(body.groupNo);
      if (!groupNo || groupNo > session.group_count) {
        return NextResponse.json(
          { error: "Invalid groupNo" },
          { status: 400 }
        );
      }
      if (isGroupFull(state.groups, groupNo, session.group_size)) {
        return NextResponse.json(
          { error: `Target group (${groupNo}) is already full.` },
          { status: 409 }
        );
      }

      const eventRes = await supabaseAdmin
        .from("draw_events")
        .insert({
          session_id: session.id,
          step: state.currentStep,
          event_type: "ASSIGN_UPDATED",
          payload: { playerId: state.currentPickPlayerId, groupNo },
          created_by: guard.user.id,
        })
        .select("id,session_id,step,event_type,payload,created_at")
        .single();

      if (eventRes.error || !eventRes.data) {
        return NextResponse.json(
          { error: eventRes.error?.message ?? "ASSIGN_UPDATED insert failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({ event: eventRes.data }, { status: 201 });
    }

    if (body.action === "assign_confirm") {
      if (state.phase !== "picked" || !state.currentPickPlayerId) {
        return NextResponse.json(
          { error: "Current state is not assign-confirm ready." },
          { status: 409 }
        );
      }

      const fallbackGroupNo = state.pendingGroupNo ?? state.targetGroupNo;
      const groupNo = normalizePositiveInt(body.groupNo ?? fallbackGroupNo);
      if (!groupNo || groupNo > session.group_count) {
        return NextResponse.json(
          { error: "Invalid groupNo" },
          { status: 400 }
        );
      }
      if (isGroupFull(state.groups, groupNo, session.group_size)) {
        return NextResponse.json(
          { error: `Target group (${groupNo}) is already full.` },
          { status: 409 }
        );
      }

      const playerId = state.currentPickPlayerId;
      const eventRes = await supabaseAdmin
        .from("draw_events")
        .insert({
          session_id: session.id,
          step: state.currentStep,
          event_type: "ASSIGN_CONFIRMED",
          payload: { playerId, groupNo },
          created_by: guard.user.id,
        })
        .select("id,session_id,step,event_type,payload,created_at")
        .single();

      if (eventRes.error || !eventRes.data) {
        return NextResponse.json(
          { error: eventRes.error?.message ?? "ASSIGN_CONFIRMED insert failed" },
          { status: 500 }
        );
      }

      try {
        await syncAssignmentToGroupsTable(supabaseAdmin, {
          tournamentId,
          groupNo,
          registrationId: playerId,
          groupSize: session.group_size,
        });
      } catch (syncError) {
        return NextResponse.json(
          {
            error:
              syncError instanceof Error
                ? syncError.message
                : "Group table sync failed",
          },
          { status: 500 }
        );
      }

      const willFinish =
        state.remainingPlayerIds.length === 1 &&
        state.remainingPlayerIds[0] === playerId;
      const now = new Date().toISOString();
      await supabaseAdmin
        .from("draw_sessions")
        .update({
          current_step: state.currentStep,
          status: willFinish ? "finished" : "live",
          ended_at: willFinish ? now : null,
        })
        .eq("id", session.id);

      return NextResponse.json({ event: eventRes.data, willFinish }, { status: 201 });
    }

    if (body.action === "move_member") {
      const playerId = normalizePositiveInt(body.playerId);
      const toGroupNo = normalizePositiveInt(body.toGroupNo);
      if (!playerId || !toGroupNo || toGroupNo > session.group_count) {
        return NextResponse.json(
          { error: "playerId/toGroupNo is invalid" },
          { status: 400 }
        );
      }

      if (state.remainingPlayerIds.includes(playerId)) {
        return NextResponse.json(
          { error: "Unassigned member cannot be moved." },
          { status: 409 }
        );
      }

      const fromGroupNo = findPlayerGroupNo(state.groups, playerId);
      if (!fromGroupNo) {
        return NextResponse.json(
          { error: "Current group for member not found." },
          { status: 404 }
        );
      }

      if (fromGroupNo === toGroupNo) {
        return NextResponse.json(
          { error: "Cannot move to same group." },
          { status: 409 }
        );
      }

      const targetMemberCount = state.groups[toGroupNo]?.length ?? 0;
      if (targetMemberCount >= session.group_size) {
        return NextResponse.json(
          { error: "Target group is full." },
          { status: 409 }
        );
      }

      const eventRes = await supabaseAdmin
        .from("draw_events")
        .insert({
          session_id: session.id,
          step: state.currentStep,
          event_type: "MEMBER_MOVED",
          payload: { playerId, fromGroupNo, toGroupNo },
          created_by: guard.user.id,
        })
        .select("id,session_id,step,event_type,payload,created_at")
        .single();

      if (eventRes.error || !eventRes.data) {
        return NextResponse.json(
          { error: eventRes.error?.message ?? "MEMBER_MOVED insert failed" },
          { status: 500 }
        );
      }

      try {
        await syncAssignmentToGroupsTable(supabaseAdmin, {
          tournamentId,
          groupNo: toGroupNo,
          registrationId: playerId,
          groupSize: session.group_size,
        });
      } catch (syncError) {
        return NextResponse.json(
          {
            error:
              syncError instanceof Error
                ? syncError.message
                : "Group table sync failed",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ event: eventRes.data }, { status: 201 });
    }

    if (body.action === "undo_last") {
      const latestEvent = events.length > 0 ? events[events.length - 1] : null;
      if (!latestEvent || latestEvent.event_type !== "ASSIGN_CONFIRMED") {
        return NextResponse.json(
          { error: "Only immediate last confirmation can be undone." },
          { status: 409 }
        );
      }

      const confirmedPlayerId = normalizePositiveInt(
        (latestEvent.payload as { playerId?: unknown })?.playerId
      );
      const confirmedGroupNo = normalizePositiveInt(
        (latestEvent.payload as { groupNo?: unknown })?.groupNo
      );

      if (!confirmedPlayerId || !confirmedGroupNo) {
        return NextResponse.json(
          { error: "Invalid ASSIGN_CONFIRMED payload for undo." },
          { status: 400 }
        );
      }

      const undoRes = await supabaseAdmin
        .from("draw_events")
        .insert({
          session_id: session.id,
          step: latestEvent.step,
          event_type: "UNDO_LAST",
          payload: { playerId: confirmedPlayerId, groupNo: confirmedGroupNo },
          created_by: guard.user.id,
        })
        .select("id,session_id,step,event_type,payload,created_at")
        .single();

      if (undoRes.error || !undoRes.data) {
        return NextResponse.json(
          { error: undoRes.error?.message ?? "UNDO_LAST insert failed" },
          { status: 500 }
        );
      }

      try {
        await removeAssignmentFromGroupsTable(supabaseAdmin, confirmedPlayerId);
      } catch (syncError) {
        return NextResponse.json(
          {
            error:
              syncError instanceof Error
                ? syncError.message
                : "Group table rollback failed",
          },
          { status: 500 }
        );
      }

      await supabaseAdmin
        .from("draw_sessions")
        .update({
          current_step: latestEvent.step,
          status: "live",
          ended_at: null,
        })
        .eq("id", session.id);

      return NextResponse.json({ event: undoRes.data }, { status: 201 });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("Draw API POST error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
