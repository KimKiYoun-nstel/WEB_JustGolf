import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

type Credential = {
  email: string;
  password: string;
};

type Sample = {
  index: number;
  apiMs: number;
  e2eMs: number;
  deliveryMs: number;
};

function readEnv(filePath: string) {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

function getServiceClient() {
  const env = readEnv(".env.local");
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stampNow() {
  const d = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

async function ensureAdminFixture(
  credential: Credential,
  participantCount: number,
  nickname: string
) {
  const supabase = getServiceClient();

  const existingUsers = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existingUsers.error) throw existingUsers.error;

  const existing = existingUsers.data.users.find(
    (user) => (user.email ?? "").toLowerCase() === credential.email.toLowerCase()
  );

  let userId = existing?.id;
  if (!existing) {
    const created = await supabase.auth.admin.createUser({
      email: credential.email,
      password: credential.password,
      email_confirm: true,
      user_metadata: { nickname, onboarding_completed: true },
    });
    if (created.error) throw created.error;
    userId = created.data.user?.id;
  } else {
    const updated = await supabase.auth.admin.updateUserById(existing.id, {
      password: credential.password,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        nickname,
        onboarding_completed: true,
      },
    });
    if (updated.error) throw updated.error;
  }
  if (!userId) throw new Error("Failed to resolve fixture user id");

  const upsertProfile = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: credential.email,
      nickname,
      is_admin: true,
      is_approved: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (upsertProfile.error) throw upsertProfile.error;

  const today = new Date().toISOString().slice(0, 10);
  const stamp = Date.now();
  const tournamentRes = await supabase
    .from("tournaments")
    .insert({
      title: `Chat Perf ${stamp}`,
      event_date: today,
      status: "open",
      created_by: userId,
    })
    .select("id")
    .single();
  if (tournamentRes.error) throw tournamentRes.error;
  const tournamentId = Number(tournamentRes.data.id);

  const rows = Array.from({ length: participantCount }, (_, idx) => ({
    tournament_id: tournamentId,
    user_id: null,
    registering_user_id: userId,
    nickname: `perf-${stamp}-${String(idx + 1).padStart(2, "0")}`,
    relation: "perf-seed",
    status: "approved",
    approval_status: "approved",
  }));
  const regsRes = await supabase.from("registrations").insert(rows);
  if (regsRes.error) throw regsRes.error;

  return { tournamentId, userId };
}

async function login(page: Page, credential: Credential) {
  const fillInputReliably = async (
    locator: ReturnType<Page["locator"]>,
    value: string
  ) => {
    await locator.click({ force: true });
    await locator.fill("");
    await locator.type(value, { delay: 20 });
    const current = await locator.inputValue();
    if (current === value) return;
    await locator.evaluate((node, nextValue) => {
      const input = node as HTMLInputElement;
      input.value = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const emailInput = page.getByPlaceholder("example@company.com").first();
  const passwordInput = page.locator('input[type="password"]').first();
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await fillInputReliably(emailInput, credential.email);
  await fillInputReliably(passwordInput, credential.password);
  await page.getByRole("button", { name: "로그인" }).first().click();

  await page.waitForLoadState("networkidle").catch(() => {});
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (!page.url().includes("/login")) break;
    const processingVisible = await page
      .getByRole("button", { name: /처리 중/ })
      .first()
      .isVisible()
      .catch(() => false);
    if (!processingVisible) break;
    await page.waitForTimeout(250);
  }

  if (page.url().includes("/auth/onboarding")) {
    const onboardingButton = page.getByRole("button", { name: "저장하고 시작하기" }).first();
    if (await onboardingButton.isVisible().catch(() => false)) {
      await onboardingButton.click();
      await page.waitForLoadState("networkidle");
    }
  }

  if (page.url().includes("/login")) {
    throw new Error("Login did not complete. Still on /login.");
  }
}

async function startLiveSession(page: Page, tournamentId: number, participantCount: number) {
  const groupSize = 4;
  const groupCount = Math.max(1, Math.ceil(participantCount / groupSize));
  const result = await page.evaluate(
    async ({ id, gc, gs }) => {
      const response = await fetch(`/api/admin/tournaments/${id}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_session",
          groupCount: gc,
          groupSize: gs,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      return {
        ok: response.ok,
        status: response.status,
        error: data?.error ?? null,
      };
    },
    { id: tournamentId, gc: groupCount, gs: groupSize }
  );

  if (!result.ok) {
    throw new Error(
      `start_session failed (status=${result.status}, error=${result.error ?? "unknown"})`
    );
  }
}

test("live draw chat performance benchmark", async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);

  const runId = stampNow();
  const nickname = `perf${Date.now().toString().slice(-6)}`;
  const credential: Credential = {
    email: `playwright.chat.perf.${runId}@testmail.com`,
    password: "Playwright123!",
  };

  const participantCount = 16;
  const fixture = await ensureAdminFixture(credential, participantCount, nickname);

  await login(page, credential);
  await startLiveSession(page, fixture.tournamentId, participantCount);

  const storageState = await page.context().storageState();
  const senderContext = await browser.newContext({ storageState });
  const receiverContext = await browser.newContext({ storageState });
  const senderPage = await senderContext.newPage();
  const receiverPage = await receiverContext.newPage();

  await senderPage.goto(`/t/${fixture.tournamentId}/draw/chat`, { waitUntil: "networkidle" });
  await receiverPage.goto(`/t/${fixture.tournamentId}/draw/chat`, { waitUntil: "networkidle" });

  await expect(senderPage.getByRole("heading", { name: "라이브 채팅" })).toBeVisible();
  await expect(receiverPage.getByRole("heading", { name: "라이브 채팅" })).toBeVisible();

  const chatSessionInfo = await senderPage.evaluate(async (tournamentId) => {
    const response = await fetch(`/api/tournaments/${tournamentId}/draw-chat/session`, {
      method: "GET",
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    return {
      ok: response.ok,
      data,
    };
  }, fixture.tournamentId);

  if (!chatSessionInfo.ok || !chatSessionInfo.data?.chatSession?.id) {
    throw new Error("Failed to resolve chat session id for performance test.");
  }

  const chatSessionId = Number(chatSessionInfo.data.chatSession.id);
  const samples: Sample[] = [];
  const messageCount = 20;

  for (let index = 1; index <= messageCount; index += 1) {
    const messageText = `[perf-${runId}] msg-${String(index).padStart(2, "0")}`;
    const startedAt = Date.now();

    const sendResult = await senderPage.evaluate(
      async ({ tournamentId, sessionId, message }) => {
        const t0 = performance.now();
        const response = await fetch(`/api/tournaments/${tournamentId}/draw-chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatSessionId: sessionId,
            message,
          }),
        });
        const t1 = performance.now();
        const data = await response.json().catch(() => ({}));
        return {
          ok: response.ok,
          status: response.status,
          apiMs: t1 - t0,
          error: (data as { error?: string }).error ?? null,
        };
      },
      { tournamentId: fixture.tournamentId, sessionId: chatSessionId, message: messageText }
    );

    expect(sendResult.ok).toBeTruthy();
    await expect(receiverPage.getByText(messageText).last()).toBeVisible({ timeout: 5000 });

    const e2eMs = Date.now() - startedAt;
    const apiMs = Number(sendResult.apiMs);
    samples.push({
      index,
      apiMs,
      e2eMs,
      deliveryMs: Math.max(0, e2eMs - apiMs),
    });

    await senderPage.waitForTimeout(350);
  }

  const burstMessageBase = `[burst-${runId}]`;
  const burstStatuses = await senderPage.evaluate(
    async ({ tournamentId, sessionId, base }) => {
      const req = Array.from({ length: 4 }, (_, idx) =>
        fetch(`/api/tournaments/${tournamentId}/draw-chat/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatSessionId: sessionId,
            message: `${base}-${idx + 1}`,
          }),
        }).then(async (response) => {
          const data = await response.json().catch(() => ({}));
          return {
            status: response.status,
            ok: response.ok,
            error: (data as { error?: string }).error ?? null,
          };
        })
      );
      return Promise.all(req);
    },
    { tournamentId: fixture.tournamentId, sessionId: chatSessionId, base: burstMessageBase }
  );

  const tooManyCount = burstStatuses.filter((row) => row.status === 429).length;
  expect(tooManyCount).toBeGreaterThan(0);

  const supabaseAdmin = getServiceClient();
  const dbMessageCountRes = await supabaseAdmin
    .from("draw_chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", fixture.tournamentId);

  if (dbMessageCountRes.error) {
    throw dbMessageCountRes.error;
  }

  const dbMessageCount = Number(dbMessageCountRes.count ?? 0);
  expect(dbMessageCount).toBe(0);

  const apiValues = samples.map((row) => row.apiMs);
  const e2eValues = samples.map((row) => row.e2eMs);
  const deliveryValues = samples.map((row) => row.deliveryMs);

  const report = {
    runId,
    tournamentId: fixture.tournamentId,
    messageCount,
    metrics: {
      api: {
        avgMs: Number(average(apiValues).toFixed(2)),
        p95Ms: Number(percentile(apiValues, 95).toFixed(2)),
        maxMs: Number(Math.max(...apiValues).toFixed(2)),
      },
      e2e: {
        avgMs: Number(average(e2eValues).toFixed(2)),
        p95Ms: Number(percentile(e2eValues, 95).toFixed(2)),
        maxMs: Number(Math.max(...e2eValues).toFixed(2)),
      },
      delivery: {
        avgMs: Number(average(deliveryValues).toFixed(2)),
        p95Ms: Number(percentile(deliveryValues, 95).toFixed(2)),
        maxMs: Number(Math.max(...deliveryValues).toFixed(2)),
      },
    },
    checks: {
      rateLimit429Count: tooManyCount,
      dbMessageCount,
    },
    samples,
    burstStatuses,
  };

  const outDir = path.join(process.cwd(), "artifacts", "chat-performance", runId);
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  await testInfo.attach("chat-performance-report", {
    body: fs.readFileSync(reportPath),
    contentType: "application/json",
  });

  await senderContext.close();
  await receiverContext.close();
});
