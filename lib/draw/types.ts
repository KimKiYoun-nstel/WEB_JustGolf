export type DrawSessionStatus = "pending" | "live" | "finished" | "canceled";

export type DrawMode = "ROUND_ROBIN" | "TARGET_GROUP";

export type DrawPhase =
  | "idle"
  | "configured"
  | "spinning"
  | "picked"
  | "confirmed"
  | "finished";

export type DrawEventType =
  | "SESSION_STARTED"
  | "STEP_CONFIGURED"
  | "PICK_RESULT"
  | "ASSIGN_UPDATED"
  | "ASSIGN_CONFIRMED"
  | "MEMBER_MOVED"
  | "UNDO_LAST";

export const DRAW_EVENT_TYPES: DrawEventType[] = [
  "SESSION_STARTED",
  "STEP_CONFIGURED",
  "PICK_RESULT",
  "ASSIGN_UPDATED",
  "ASSIGN_CONFIRMED",
  "MEMBER_MOVED",
  "UNDO_LAST",
];

export function isDrawEventType(value: string): value is DrawEventType {
  return (DRAW_EVENT_TYPES as string[]).includes(value);
}

export interface SessionStartedPayload {
  startedAt: string;
  playerIds?: number[];
}

export interface StepConfiguredPayload {
  mode: DrawMode;
  targetGroupNo?: number | null;
  startedAt: string;
  durationMs: number;
}

export interface PickResultPayload {
  playerId: number;
}

export interface AssignUpdatedPayload {
  playerId: number;
  groupNo: number;
}

export interface AssignConfirmedPayload {
  playerId: number;
  groupNo: number;
}

export interface MemberMovedPayload {
  playerId: number;
  fromGroupNo?: number | null;
  toGroupNo: number;
}

export interface UndoLastPayload {
  playerId: number;
  groupNo?: number | null;
}

export interface DrawEventPayloadMap {
  SESSION_STARTED: SessionStartedPayload;
  STEP_CONFIGURED: StepConfiguredPayload;
  PICK_RESULT: PickResultPayload;
  ASSIGN_UPDATED: AssignUpdatedPayload;
  ASSIGN_CONFIRMED: AssignConfirmedPayload;
  MEMBER_MOVED: MemberMovedPayload;
  UNDO_LAST: UndoLastPayload;
}

export type DrawEventPayload = DrawEventPayloadMap[DrawEventType];

export interface DrawEventRecord<T extends DrawEventType = DrawEventType> {
  id?: number;
  session_id: number;
  step: number;
  event_type: T;
  payload: DrawEventPayloadMap[T];
  created_at?: string;
}

export interface DrawSessionSeed {
  sessionId: number;
  tournamentId: number;
  status?: DrawSessionStatus;
  groupCount: number;
  groupSize: number;
  totalPlayers: number;
  playerIds: number[];
}

export interface DrawState {
  sessionId: number;
  tournamentId: number;
  status: DrawSessionStatus;
  groupCount: number;
  groupSize: number;
  totalPlayers: number;
  currentStep: number;
  currentMode: DrawMode | null;
  targetGroupNo: number | null;
  currentPickPlayerId: number | null;
  pendingGroupNo: number | null;
  startedAt: string | null;
  durationMs: number | null;
  phase: DrawPhase;
  remainingPlayerIds: number[];
  groups: Record<number, number[]>;
}
