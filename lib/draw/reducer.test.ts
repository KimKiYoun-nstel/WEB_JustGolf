import { describe, expect, it } from "vitest";
import { applyDrawEvent, createInitialDrawState, replayDrawEvents } from "./reducer";
import type { DrawEventRecord, DrawSessionSeed } from "./types";

const baseSeed: DrawSessionSeed = {
  sessionId: 1,
  tournamentId: 99,
  groupCount: 3,
  groupSize: 2,
  totalPlayers: 3,
  playerIds: [101, 102, 103],
};

describe("draw reducer", () => {
  it("applies ROUND_ROBIN flow and updates remaining/groups", () => {
    let state = createInitialDrawState(baseSeed);

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "SESSION_STARTED",
      payload: {
        startedAt: "2026-02-13T09:00:00.000Z",
      },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "STEP_CONFIGURED",
      payload: {
        mode: "ROUND_ROBIN",
        startedAt: "2026-02-13T09:00:01.000Z",
        durationMs: 3000,
      },
    });

    expect(state.targetGroupNo).toBe(1);
    expect(state.phase).toBe("configured");

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "PICK_RESULT",
      payload: {
        playerId: 102,
      },
    });

    expect(state.currentPickPlayerId).toBe(102);
    expect(state.phase).toBe("picked");

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "ASSIGN_CONFIRMED",
      payload: {
        playerId: 102,
        groupNo: 1,
      },
    });

    expect(state.groups[1]).toEqual([102]);
    expect(state.remainingPlayerIds).toEqual([101, 103]);
    expect(state.phase).toBe("confirmed");

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 1,
      event_type: "STEP_CONFIGURED",
      payload: {
        mode: "ROUND_ROBIN",
        startedAt: "2026-02-13T09:00:04.000Z",
        durationMs: 3000,
      },
    });

    expect(state.targetGroupNo).toBe(2);
  });

  it("supports TARGET_GROUP mode and pre-confirm assignment update", () => {
    let state = createInitialDrawState({
      ...baseSeed,
      groupCount: 2,
      groupSize: 2,
      totalPlayers: 2,
      playerIds: [201, 202],
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "STEP_CONFIGURED",
      payload: {
        mode: "TARGET_GROUP",
        targetGroupNo: 2,
        startedAt: "2026-02-13T09:10:00.000Z",
        durationMs: 2000,
      },
    });

    expect(state.targetGroupNo).toBe(2);

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "PICK_RESULT",
      payload: { playerId: 201 },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "ASSIGN_UPDATED",
      payload: { playerId: 201, groupNo: 1 },
    });

    expect(state.pendingGroupNo).toBe(1);

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "ASSIGN_CONFIRMED",
      payload: { playerId: 201, groupNo: 1 },
    });

    expect(state.groups[1]).toEqual([201]);
    expect(state.remainingPlayerIds).toEqual([202]);
  });

  it("is idempotent for duplicate ASSIGN_CONFIRMED events in replay", () => {
    const seed: DrawSessionSeed = {
      sessionId: 7,
      tournamentId: 88,
      groupCount: 1,
      groupSize: 1,
      totalPlayers: 1,
      playerIds: [301],
    };

    const events: DrawEventRecord[] = [
      {
        id: 1,
        session_id: 7,
        step: 0,
        event_type: "SESSION_STARTED",
        payload: { startedAt: "2026-02-13T10:00:00.000Z" },
      },
      {
        id: 2,
        session_id: 7,
        step: 0,
        event_type: "STEP_CONFIGURED",
        payload: {
          mode: "ROUND_ROBIN",
          startedAt: "2026-02-13T10:00:01.000Z",
          durationMs: 1000,
        },
      },
      {
        id: 3,
        session_id: 7,
        step: 0,
        event_type: "PICK_RESULT",
        payload: { playerId: 301 },
      },
      {
        id: 4,
        session_id: 7,
        step: 0,
        event_type: "ASSIGN_CONFIRMED",
        payload: { playerId: 301, groupNo: 1 },
      },
      {
        id: 5,
        session_id: 7,
        step: 0,
        event_type: "ASSIGN_CONFIRMED",
        payload: { playerId: 301, groupNo: 1 },
      },
    ];

    const state = replayDrawEvents(seed, events);

    expect(state.groups[1]).toEqual([301]);
    expect(state.remainingPlayerIds).toEqual([]);
    expect(state.phase).toBe("finished");
    expect(state.status).toBe("finished");
  });

  it("ignores invalid group numbers and falls back to configured target group", () => {
    let state = createInitialDrawState({
      ...baseSeed,
      groupCount: 2,
      totalPlayers: 1,
      playerIds: [401],
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "STEP_CONFIGURED",
      payload: {
        mode: "TARGET_GROUP",
        targetGroupNo: 2,
        startedAt: "2026-02-13T11:00:00.000Z",
        durationMs: 2000,
      },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "PICK_RESULT",
      payload: { playerId: 401 },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "ASSIGN_UPDATED",
      payload: { playerId: 401, groupNo: 999 },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "ASSIGN_CONFIRMED",
      payload: { playerId: 401, groupNo: 999 },
    });

    expect(state.groups[2]).toEqual([401]);
    expect(state.phase).toBe("finished");
  });

  it("moves assigned member between groups with MEMBER_MOVED", () => {
    const seed: DrawSessionSeed = {
      sessionId: 11,
      tournamentId: 88,
      groupCount: 2,
      groupSize: 2,
      totalPlayers: 2,
      playerIds: [501, 502],
    };

    const events: DrawEventRecord[] = [
      {
        id: 1,
        session_id: 11,
        step: 0,
        event_type: "SESSION_STARTED",
        payload: { startedAt: "2026-02-13T12:00:00.000Z" },
      },
      {
        id: 2,
        session_id: 11,
        step: 0,
        event_type: "STEP_CONFIGURED",
        payload: {
          mode: "ROUND_ROBIN",
          startedAt: "2026-02-13T12:00:01.000Z",
          durationMs: 1000,
        },
      },
      {
        id: 3,
        session_id: 11,
        step: 0,
        event_type: "PICK_RESULT",
        payload: { playerId: 501 },
      },
      {
        id: 4,
        session_id: 11,
        step: 0,
        event_type: "ASSIGN_CONFIRMED",
        payload: { playerId: 501, groupNo: 1 },
      },
      {
        id: 5,
        session_id: 11,
        step: 0,
        event_type: "MEMBER_MOVED",
        payload: { playerId: 501, fromGroupNo: 1, toGroupNo: 2 },
      },
    ];

    const state = replayDrawEvents(seed, events);
    expect(state.groups[1]).toEqual([]);
    expect(state.groups[2]).toEqual([501]);
    expect(state.remainingPlayerIds).toEqual([502]);
  });

  it("ignores ASSIGN_CONFIRMED when target group is already full", () => {
    const seed: DrawSessionSeed = {
      sessionId: 13,
      tournamentId: 88,
      groupCount: 2,
      groupSize: 1,
      totalPlayers: 2,
      playerIds: [701, 702],
    };

    const events: DrawEventRecord[] = [
      {
        id: 1,
        session_id: 13,
        step: 0,
        event_type: "SESSION_STARTED",
        payload: { startedAt: "2026-02-13T12:20:00.000Z" },
      },
      {
        id: 2,
        session_id: 13,
        step: 0,
        event_type: "STEP_CONFIGURED",
        payload: {
          mode: "ROUND_ROBIN",
          startedAt: "2026-02-13T12:20:01.000Z",
          durationMs: 1000,
        },
      },
      {
        id: 3,
        session_id: 13,
        step: 0,
        event_type: "PICK_RESULT",
        payload: { playerId: 701 },
      },
      {
        id: 4,
        session_id: 13,
        step: 0,
        event_type: "ASSIGN_CONFIRMED",
        payload: { playerId: 701, groupNo: 1 },
      },
      {
        id: 5,
        session_id: 13,
        step: 1,
        event_type: "STEP_CONFIGURED",
        payload: {
          mode: "TARGET_GROUP",
          targetGroupNo: 1,
          startedAt: "2026-02-13T12:20:05.000Z",
          durationMs: 1000,
        },
      },
      {
        id: 6,
        session_id: 13,
        step: 1,
        event_type: "PICK_RESULT",
        payload: { playerId: 702 },
      },
      {
        id: 7,
        session_id: 13,
        step: 1,
        event_type: "ASSIGN_CONFIRMED",
        payload: { playerId: 702, groupNo: 1 },
      },
    ];

    const state = replayDrawEvents(seed, events);
    expect(state.groups[1]).toEqual([701]);
    expect(state.groups[2]).toEqual([]);
    expect(state.remainingPlayerIds).toContain(702);
  });

  it("ignores MEMBER_MOVED when target group is already full", () => {
    const seed: DrawSessionSeed = {
      sessionId: 14,
      tournamentId: 88,
      groupCount: 2,
      groupSize: 1,
      totalPlayers: 2,
      playerIds: [801, 802],
    };

    const events: DrawEventRecord[] = [
      {
        id: 1,
        session_id: 14,
        step: 0,
        event_type: "SESSION_STARTED",
        payload: { startedAt: "2026-02-13T12:30:00.000Z" },
      },
      {
        id: 2,
        session_id: 14,
        step: 0,
        event_type: "STEP_CONFIGURED",
        payload: {
          mode: "ROUND_ROBIN",
          startedAt: "2026-02-13T12:30:01.000Z",
          durationMs: 1000,
        },
      },
      {
        id: 3,
        session_id: 14,
        step: 0,
        event_type: "PICK_RESULT",
        payload: { playerId: 801 },
      },
      {
        id: 4,
        session_id: 14,
        step: 0,
        event_type: "ASSIGN_CONFIRMED",
        payload: { playerId: 801, groupNo: 1 },
      },
      {
        id: 5,
        session_id: 14,
        step: 1,
        event_type: "STEP_CONFIGURED",
        payload: {
          mode: "ROUND_ROBIN",
          startedAt: "2026-02-13T12:30:05.000Z",
          durationMs: 1000,
        },
      },
      {
        id: 6,
        session_id: 14,
        step: 1,
        event_type: "PICK_RESULT",
        payload: { playerId: 802 },
      },
      {
        id: 7,
        session_id: 14,
        step: 1,
        event_type: "ASSIGN_CONFIRMED",
        payload: { playerId: 802, groupNo: 2 },
      },
      {
        id: 8,
        session_id: 14,
        step: 1,
        event_type: "MEMBER_MOVED",
        payload: { playerId: 801, fromGroupNo: 1, toGroupNo: 2 },
      },
    ];

    const state = replayDrawEvents(seed, events);
    expect(state.groups[1]).toEqual([801]);
    expect(state.groups[2]).toEqual([802]);
  });

  it("restores last confirmed member with UNDO_LAST", () => {
    const seed: DrawSessionSeed = {
      sessionId: 12,
      tournamentId: 88,
      groupCount: 1,
      groupSize: 2,
      totalPlayers: 2,
      playerIds: [601, 602],
    };

    const events: DrawEventRecord[] = [
      {
        id: 1,
        session_id: 12,
        step: 0,
        event_type: "SESSION_STARTED",
        payload: { startedAt: "2026-02-13T12:10:00.000Z" },
      },
      {
        id: 2,
        session_id: 12,
        step: 0,
        event_type: "STEP_CONFIGURED",
        payload: {
          mode: "ROUND_ROBIN",
          startedAt: "2026-02-13T12:10:01.000Z",
          durationMs: 1000,
        },
      },
      {
        id: 3,
        session_id: 12,
        step: 0,
        event_type: "PICK_RESULT",
        payload: { playerId: 601 },
      },
      {
        id: 4,
        session_id: 12,
        step: 0,
        event_type: "ASSIGN_CONFIRMED",
        payload: { playerId: 601, groupNo: 1 },
      },
      {
        id: 5,
        session_id: 12,
        step: 0,
        event_type: "UNDO_LAST",
        payload: { playerId: 601, groupNo: 1 },
      },
    ];

    const state = replayDrawEvents(seed, events);
    expect(state.groups[1]).toEqual([]);
    expect(state.remainingPlayerIds).toContain(601);
    expect(state.phase).toBe("picked");
    expect(state.currentPickPlayerId).toBe(601);
    expect(state.status).toBe("live");
  });

  it("does not apply PICK_RESULT before STEP_CONFIGURED for same step", () => {
    let state = createInitialDrawState({
      ...baseSeed,
      totalPlayers: 2,
      playerIds: [901, 902],
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "SESSION_STARTED",
      payload: { startedAt: "2026-02-13T13:00:00.000Z" },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 1,
      event_type: "PICK_RESULT",
      payload: { playerId: 901 },
    });

    expect(state.phase).toBe("idle");
    expect(state.currentPickPlayerId).toBeNull();

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 1,
      event_type: "STEP_CONFIGURED",
      payload: {
        mode: "ROUND_ROBIN",
        startedAt: "2026-02-13T13:00:01.000Z",
        durationMs: 1500,
      },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 1,
      event_type: "PICK_RESULT",
      payload: { playerId: 901 },
    });

    expect(state.phase).toBe("picked");
    expect(state.currentPickPlayerId).toBe(901);
  });

  it("allows re-pick during picked phase before assignment confirmation", () => {
    let state = createInitialDrawState({
      ...baseSeed,
      totalPlayers: 3,
      playerIds: [1001, 1002, 1003],
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "SESSION_STARTED",
      payload: { startedAt: "2026-02-18T09:00:00.000Z" },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "STEP_CONFIGURED",
      payload: {
        mode: "ROUND_ROBIN",
        startedAt: "2026-02-18T09:00:01.000Z",
        durationMs: 1800,
      },
    });

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "PICK_RESULT",
      payload: { playerId: 1001 },
    });

    expect(state.phase).toBe("picked");
    expect(state.currentPickPlayerId).toBe(1001);

    state = applyDrawEvent(state, {
      session_id: 1,
      step: 0,
      event_type: "PICK_RESULT",
      payload: { playerId: 1003 },
    });

    expect(state.phase).toBe("picked");
    expect(state.currentPickPlayerId).toBe(1003);
    expect(state.remainingPlayerIds).toEqual([1001, 1002, 1003]);
  });
});
