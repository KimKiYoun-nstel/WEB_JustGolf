import {
  buildDrawChatBroadcastTopic,
  DRAW_CHAT_BROADCAST_EVENT,
  type DrawChatRealtimeMessage,
} from "../draw/chatRealtime";

type PublishDrawChatMessageParams = {
  tournamentId: number;
  message: DrawChatRealtimeMessage;
};

export async function publishDrawChatBroadcastMessage(
  params: PublishDrawChatMessageParams
): Promise<{ ok: true } | { error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return { error: "Supabase 환경변수가 설정되지 않았습니다." };
  }

  const endpoint = `${supabaseUrl}/realtime/v1/api/broadcast`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: buildDrawChatBroadcastTopic(params.tournamentId),
          event: DRAW_CHAT_BROADCAST_EVENT,
          payload: params.message,
          private: false,
        },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      error: text || `Broadcast publish failed (${response.status})`,
    };
  }

  return { ok: true };
}
