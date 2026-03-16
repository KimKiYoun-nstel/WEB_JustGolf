import { createServiceRoleSupabaseClient } from "../apiGuard";

export const KAKAO_OIDC_STATE_TTL_SECONDS = 60 * 10;

export type KakaoOidcStateIntent = "sign_in" | "link";

type IssueKakaoOidcStateInput = {
  state: string;
  intent: KakaoOidcStateIntent;
  expectedUserId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

type ConsumeKakaoOidcStateInput = {
  state: string;
  ip?: string | null;
  userAgent?: string | null;
};

type StateRow = {
  state: string;
  intent: KakaoOidcStateIntent;
  expected_user_id: string | null;
  expires_at: string;
  consumed_at: string | null;
};

const isTableMissingError = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  if (code === "42P01") return true;
  const message = ((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return message.includes("kakao_oidc_states") && message.includes("does not exist");
};

const toSafeString = (value?: string | null) => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
};

export async function issueKakaoOidcState(input: IssueKakaoOidcStateInput) {
  try {
    const supabaseAdmin = createServiceRoleSupabaseClient();
    const expiresAt = new Date(Date.now() + KAKAO_OIDC_STATE_TTL_SECONDS * 1000).toISOString();

    const { error } = await supabaseAdmin.from("kakao_oidc_states").insert({
      state: input.state,
      intent: input.intent,
      expected_user_id: input.expectedUserId ?? null,
      issued_ip: toSafeString(input.ip),
      issued_user_agent: toSafeString(input.userAgent),
      expires_at: expiresAt,
    });

    if (error) {
      return {
        stored: false,
        reason: isTableMissingError(error) ? "table_missing" : "insert_failed",
        errorMessage: error.message,
      } as const;
    }

    return { stored: true } as const;
  } catch (error) {
    return {
      stored: false,
      reason: "unexpected_failure",
      errorMessage: error instanceof Error ? error.message : String(error),
    } as const;
  }
}

export async function consumeKakaoOidcState(input: ConsumeKakaoOidcStateInput) {
  try {
    const supabaseAdmin = createServiceRoleSupabaseClient();

    const { data: stateRow, error: selectError } = await supabaseAdmin
      .from("kakao_oidc_states")
      .select("state,intent,expected_user_id,expires_at,consumed_at")
      .eq("state", input.state)
      .maybeSingle<StateRow>();

    if (selectError) {
      return {
        matched: false,
        reason: isTableMissingError(selectError) ? "table_missing" : "select_failed",
        errorMessage: selectError.message,
      } as const;
    }

    if (!stateRow) {
      return { matched: false, reason: "not_found" } as const;
    }

    if (stateRow.consumed_at) {
      return { matched: false, reason: "already_consumed" } as const;
    }

    if (Date.parse(stateRow.expires_at) <= Date.now()) {
      return { matched: false, reason: "expired" } as const;
    }

    const { data: consumedRow, error: updateError } = await supabaseAdmin
      .from("kakao_oidc_states")
      .update({
        consumed_at: new Date().toISOString(),
        consumed_ip: toSafeString(input.ip),
        consumed_user_agent: toSafeString(input.userAgent),
      })
      .eq("state", input.state)
      .is("consumed_at", null)
      .select("state,intent,expected_user_id")
      .maybeSingle<Pick<StateRow, "state" | "intent" | "expected_user_id">>();

    if (updateError) {
      return {
        matched: false,
        reason: "consume_failed",
        errorMessage: updateError.message,
      } as const;
    }

    if (!consumedRow) {
      return { matched: false, reason: "race_consumed" } as const;
    }

    return {
      matched: true,
      intent: consumedRow.intent,
      expectedUserId: consumedRow.expected_user_id,
    } as const;
  } catch (error) {
    return {
      matched: false,
      reason: "unexpected_failure",
      errorMessage: error instanceof Error ? error.message : String(error),
    } as const;
  }
}
