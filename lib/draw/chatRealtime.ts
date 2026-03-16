export const DRAW_CHAT_BROADCAST_EVENT = "chat_message";

export function buildDrawChatBroadcastTopic(tournamentId: number) {
  return `draw-chat:tournament:${tournamentId}`;
}

export type DrawChatRealtimeMessage = {
  id: string;
  chatSessionId: number;
  tournamentId: number;
  userId: string;
  nickname: string;
  message: string;
  createdAt: string;
};
