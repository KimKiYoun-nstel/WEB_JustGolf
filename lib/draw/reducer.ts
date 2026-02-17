import type {
  AssignConfirmedPayload,
  AssignUpdatedPayload,
  DrawEventRecord,
  DrawMode,
  DrawSessionSeed,
  DrawState,
  MemberMovedPayload,
  PickResultPayload,
  SessionStartedPayload,
  StepConfiguredPayload,
  UndoLastPayload,
} from "./types";

function dedupeNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

function createGroupBuckets(groupCount: number): Record<number, number[]> {
  const groups: Record<number, number[]> = {};
  for (let groupNo = 1; groupNo <= groupCount; groupNo += 1) {
    groups[groupNo] = [];
  }
  return groups;
}

function normalizeGroupNo(groupNo: number | null | undefined, groupCount: number): number | null {
  if (!Number.isInteger(groupNo)) return null;
  if (!groupNo || groupNo < 1 || groupNo > groupCount) return null;
  return groupNo;
}

function appendUniquePlayer(groups: Record<number, number[]>, groupNo: number, playerId: number) {
  const nextGroups = { ...groups };
  const currentMembers = nextGroups[groupNo] ?? [];
  nextGroups[groupNo] = currentMembers.includes(playerId)
    ? currentMembers
    : [...currentMembers, playerId];
  return nextGroups;
}

function isGroupFull(groups: Record<number, number[]>, groupNo: number, groupSize: number) {
  const members = groups[groupNo] ?? [];
  return members.length >= groupSize;
}

function removePlayerFromAllGroups(
  groups: Record<number, number[]>,
  playerId: number
): Record<number, number[]> {
  const nextGroups: Record<number, number[]> = {};
  Object.entries(groups).forEach(([groupNo, members]) => {
    nextGroups[Number(groupNo)] = members.filter((id) => id !== playerId);
  });
  return nextGroups;
}

function normalizeTempoPayload(tempo: StepConfiguredPayload["tempo"]) {
  if (!tempo || typeof tempo !== "object") return null;
  const baseHz =
    typeof tempo.baseHz === "number" && Number.isFinite(tempo.baseHz)
      ? tempo.baseHz
      : undefined;
  const slowdownMs =
    typeof tempo.slowdownMs === "number" && Number.isFinite(tempo.slowdownMs)
      ? tempo.slowdownMs
      : undefined;
  const nearMiss =
    typeof tempo.nearMiss === "number" && Number.isFinite(tempo.nearMiss)
      ? tempo.nearMiss
      : undefined;

  if (baseHz === undefined && slowdownMs === undefined && nearMiss === undefined) {
    return null;
  }

  return { baseHz, slowdownMs, nearMiss };
}

function normalizeDeckOrderPayload(
  deckOrder: StepConfiguredPayload["deckOrder"],
  remainingPlayerIds: number[]
) {
  if (!Array.isArray(deckOrder) || deckOrder.length === 0) return null;
  if (deckOrder.length !== remainingPlayerIds.length) return null;

  const parsed: number[] = [];
  for (const value of deckOrder) {
    if (!Number.isInteger(value) || value <= 0) return null;
    parsed.push(value);
  }

  const uniqueDeckSize = new Set(parsed).size;
  if (uniqueDeckSize !== parsed.length) return null;

  const remainingSet = new Set(remainingPlayerIds);
  if (remainingSet.size !== remainingPlayerIds.length) return null;

  for (const playerId of parsed) {
    if (!remainingSet.has(playerId)) return null;
  }

  return parsed;
}

export function resolveTargetGroupNo({
  step,
  mode,
  targetGroupNo,
  groupCount,
}: {
  step: number;
  mode: DrawMode;
  targetGroupNo?: number | null;
  groupCount: number;
}): number {
  if (mode === "TARGET_GROUP") {
    return normalizeGroupNo(targetGroupNo, groupCount) ?? 1;
  }

  const normalizedStep = Math.max(0, step);
  return (normalizedStep % groupCount) + 1;
}

export function createInitialDrawState(seed: DrawSessionSeed): DrawState {
  const uniquePlayers = dedupeNumbers(seed.playerIds);

  return {
    sessionId: seed.sessionId,
    tournamentId: seed.tournamentId,
    status: seed.status ?? "pending",
    groupCount: seed.groupCount,
    groupSize: seed.groupSize,
    totalPlayers: seed.totalPlayers,
    currentStep: 0,
    currentMode: null,
    targetGroupNo: null,
    currentPickPlayerId: null,
    pendingGroupNo: null,
    startedAt: null,
    durationMs: null,
    stepSeed: null,
    stepPattern: null,
    stepTempo: null,
    stepDeckPlayerIds: null,
    phase: "idle",
    remainingPlayerIds: uniquePlayers,
    groups: createGroupBuckets(seed.groupCount),
  };
}

export function applyDrawEvent(state: DrawState, event: DrawEventRecord): DrawState {
  switch (event.event_type) {
    case "SESSION_STARTED": {
      const payload = event.payload as SessionStartedPayload;
      const nextRemaining = payload.playerIds
        ? dedupeNumbers(payload.playerIds)
        : state.remainingPlayerIds;

      return {
        ...state,
        status: "live",
        phase: "idle",
        startedAt: payload.startedAt,
        remainingPlayerIds: nextRemaining,
        stepDeckPlayerIds: null,
      };
    }

    case "STEP_CONFIGURED": {
      const payload = event.payload as StepConfiguredPayload;
      const targetGroupNo = resolveTargetGroupNo({
        step: event.step,
        mode: payload.mode,
        targetGroupNo: payload.targetGroupNo,
        groupCount: state.groupCount,
      });

      return {
        ...state,
        currentStep: event.step,
        currentMode: payload.mode,
        targetGroupNo,
        pendingGroupNo: targetGroupNo,
        currentPickPlayerId: null,
        startedAt: payload.startedAt,
        durationMs: payload.durationMs,
        stepSeed:
          typeof payload.seed === "number" && Number.isFinite(payload.seed)
            ? payload.seed
            : null,
        stepPattern: typeof payload.pattern === "string" ? payload.pattern : null,
        stepTempo: normalizeTempoPayload(payload.tempo),
        stepDeckPlayerIds: normalizeDeckOrderPayload(
          payload.deckOrder,
          state.remainingPlayerIds
        ),
        phase: "configured",
      };
    }

    case "PICK_RESULT": {
      const payload = event.payload as PickResultPayload;
      if (event.step !== state.currentStep) {
        return state;
      }
      if (
        state.phase !== "configured" &&
        state.phase !== "spinning" &&
        state.phase !== "picked"
      ) {
        return state;
      }
      if (!state.remainingPlayerIds.includes(payload.playerId)) {
        return state;
      }

      return {
        ...state,
        currentStep: event.step,
        currentPickPlayerId: payload.playerId,
        phase: "picked",
      };
    }

    case "ASSIGN_UPDATED": {
      const payload = event.payload as AssignUpdatedPayload;
      if (event.step !== state.currentStep) return state;
      if (state.phase !== "picked") return state;
      if (state.currentPickPlayerId !== payload.playerId) return state;
      const groupNo = normalizeGroupNo(payload.groupNo, state.groupCount);
      if (!groupNo) return state;
      if (isGroupFull(state.groups, groupNo, state.groupSize)) return state;

      return {
        ...state,
        currentStep: event.step,
        currentPickPlayerId: payload.playerId,
        pendingGroupNo: groupNo,
        phase: "picked",
      };
    }

    case "ASSIGN_CONFIRMED": {
      const payload = event.payload as AssignConfirmedPayload;
      if (event.step !== state.currentStep) return state;
      if (state.phase !== "picked") return state;
      if (state.currentPickPlayerId !== payload.playerId) return state;
      const groupNo =
        normalizeGroupNo(payload.groupNo, state.groupCount) ??
        state.pendingGroupNo ??
        state.targetGroupNo;

      if (!groupNo) return state;
      if (!state.remainingPlayerIds.includes(payload.playerId)) {
        return state;
      }
      if (isGroupFull(state.groups, groupNo, state.groupSize)) {
        return state;
      }

      const nextGroups = appendUniquePlayer(state.groups, groupNo, payload.playerId);
      const nextRemaining = state.remainingPlayerIds.filter((id) => id !== payload.playerId);
      const finished = nextRemaining.length === 0;

      return {
        ...state,
        currentStep: Math.max(state.currentStep, event.step),
        currentPickPlayerId: payload.playerId,
        pendingGroupNo: null,
        targetGroupNo: groupNo,
        remainingPlayerIds: nextRemaining,
        stepDeckPlayerIds: null,
        groups: nextGroups,
        phase: finished ? "finished" : "confirmed",
        status: finished ? "finished" : "live",
      };
    }

    case "MEMBER_MOVED": {
      const payload = event.payload as MemberMovedPayload;
      const toGroupNo = normalizeGroupNo(payload.toGroupNo, state.groupCount);
      if (!toGroupNo) return state;
      if (state.remainingPlayerIds.includes(payload.playerId)) {
        return state;
      }
      const targetGroupHasPlayer = (state.groups[toGroupNo] ?? []).includes(payload.playerId);
      if (!targetGroupHasPlayer && isGroupFull(state.groups, toGroupNo, state.groupSize)) {
        return state;
      }

      const cleanedGroups = removePlayerFromAllGroups(state.groups, payload.playerId);
      const nextGroups = appendUniquePlayer(cleanedGroups, toGroupNo, payload.playerId);

      return {
        ...state,
        groups: nextGroups,
        phase: state.phase === "finished" ? "finished" : "confirmed",
      };
    }

    case "UNDO_LAST": {
      const payload = event.payload as UndoLastPayload;
      const fallbackGroupNo = normalizeGroupNo(payload.groupNo, state.groupCount);
      const cleanedGroups = removePlayerFromAllGroups(state.groups, payload.playerId);

      const wasInGroup =
        Object.values(state.groups).some((members) => members.includes(payload.playerId)) ||
        Boolean(fallbackGroupNo);
      if (!wasInGroup) return state;

      const alreadyRemaining = state.remainingPlayerIds.includes(payload.playerId);
      const nextRemaining = alreadyRemaining
        ? state.remainingPlayerIds
        : [...state.remainingPlayerIds, payload.playerId];

      return {
        ...state,
        status: "live",
        currentStep: event.step,
        currentPickPlayerId: payload.playerId,
        pendingGroupNo: null,
        stepDeckPlayerIds: null,
        phase: "picked",
        remainingPlayerIds: nextRemaining,
        groups: cleanedGroups,
      };
    }

    default:
      return state;
  }
}

export function replayDrawEvents(seed: DrawSessionSeed, events: DrawEventRecord[]): DrawState {
  const sorted = [...events].sort((a, b) => {
    const stepDelta = a.step - b.step;
    if (stepDelta !== 0) return stepDelta;
    return (a.id ?? 0) - (b.id ?? 0);
  });

  return sorted.reduce((state, event) => applyDrawEvent(state, event), createInitialDrawState(seed));
}
