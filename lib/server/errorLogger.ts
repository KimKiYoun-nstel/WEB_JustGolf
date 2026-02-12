import { createServiceRoleSupabaseClient } from "../apiGuard";

export type ErrorLogInput = {
  category: string;
  action: string;
  message: string;
  level?: "error" | "warn" | "info";
  errorCode?: string | null;
  email?: string | null;
  authUserId?: string | null;
  path?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
};

const MAX_FIELD_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 1000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const trimOrNull = (value?: string | null, maxLength = MAX_FIELD_LENGTH) => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

export async function writeErrorLog(input: ErrorLogInput) {
  try {
    const supabaseAdmin = createServiceRoleSupabaseClient();
    const normalizedAuthUserId = trimOrNull(input.authUserId, 64);

    const { error } = await supabaseAdmin.from("error_logs").insert({
      level: input.level ?? "error",
      category: trimOrNull(input.category, 100) ?? "unknown",
      action: trimOrNull(input.action, 100) ?? "unknown",
      message: trimOrNull(input.message, MAX_MESSAGE_LENGTH) ?? "unknown error",
      error_code: trimOrNull(input.errorCode, 100),
      email: trimOrNull(input.email, 254)?.toLowerCase() ?? null,
      auth_user_id:
        normalizedAuthUserId && UUID_REGEX.test(normalizedAuthUserId)
          ? normalizedAuthUserId
          : null,
      path: trimOrNull(input.path, 300),
      ip: trimOrNull(input.ip, 120),
      user_agent: trimOrNull(input.userAgent, 500),
      details: input.details ?? {},
    });

    if (error) {
      console.error("Failed to write error log:", error.message);
    }
  } catch (e) {
    console.error("Unexpected error while writing error log:", e);
  }
}
