import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const LABEL = {
  login: "\uB85C\uADF8\uC778",
  saveAndStart: "\uC800\uC7A5\uD558\uACE0 \uC2DC\uC791\uD558\uAE30",
  progressControl: "\uC9C4\uD589 \uCEE8\uD2B8\uB864",
  sessionStart: "\uC138\uC158 \uC2DC\uC791",
  winnerPrefix: "\uB2F9\uCCA8:",
  spinning: "\uCD94\uCCA8 \uC5F0\uCD9C \uC9C4\uD589 \uC911...",
};

type Credential = { email: string; password: string };
type PWPage = import("@playwright/test").Page;

async function fillInputReliably(
  locator: ReturnType<import("@playwright/test").Page["locator"]>,
  value: string
) {
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
}

function resolveFixtureCount(): number {
  const raw = Number(process.env.DRAW_FIXTURE_COUNT ?? "40");
  if (!Number.isFinite(raw)) return 40;
  const normalized = Math.floor(raw);
  return Math.min(120, Math.max(4, normalized));
}

function stampNow() {
  const d = new Date();
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

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
  const envLocal = readEnv(".env.local");
  const url = envLocal.NEXT_PUBLIC_SUPABASE_URL;
  const key = envLocal.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensurePlayableFixture(credential: Credential, participantCount: number) {
  const supabase = getServiceClient();
  const nickname = "PlayAdmin";

  const listRes = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listRes.error) throw listRes.error;
  const existing = listRes.data.users.find(
    (u) => (u.email ?? "").toLowerCase() === credential.email.toLowerCase()
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
  const insertedTournament = await supabase
    .from("tournaments")
    .insert({
      title: `Playwright Draw ${stamp}`,
      event_date: today,
      status: "open",
      created_by: userId,
    })
    .select("id")
    .single();
  if (insertedTournament.error) throw insertedTournament.error;
  const tournamentId = insertedTournament.data.id as number;

  const rows = Array.from({ length: participantCount }, (_, i) => ({
    tournament_id: tournamentId,
    user_id: null,
    registering_user_id: userId,
    nickname: `pw-draw-${stamp}-${String(i + 1).padStart(2, "0")}`,
    relation: "draw-seed",
    status: "approved",
    approval_status: "approved",
  }));
  const insertedRegs = await supabase.from("registrations").insert(rows);
  if (insertedRegs.error) throw insertedRegs.error;

  return { tournamentId, participantCount };
}

async function loginAsAdmin(page: import("@playwright/test").Page, credentials: Credential[]) {
  for (const credential of credentials) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const emailInput = page.getByPlaceholder("example@company.com").first();
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(emailInput).toBeEnabled();
    await expect(passwordInput).toBeEnabled();
    await fillInputReliably(emailInput, credential.email);
    await fillInputReliably(passwordInput, credential.password);

    await page.getByRole("button", { name: LABEL.login }).first().click();
    await page.waitForLoadState("networkidle").catch(() => {});

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (!page.url().includes("/login")) break;
      const processingVisible = await page.getByRole("button", { name: /처리 중/ }).first().isVisible().catch(() => false);
      if (!processingVisible) break;
      await page.waitForTimeout(250);
    }

    if (page.url().includes("/auth/onboarding")) {
      const onboardingButton = page.getByRole("button", { name: LABEL.saveAndStart }).first();
      if (await onboardingButton.isVisible().catch(() => false)) {
        await Promise.all([page.waitForLoadState("networkidle"), onboardingButton.click()]);
      }
    }

    if (!page.url().includes("/login")) return;
  }
  throw new Error("Admin login failed with provided credentials");
}

async function openLiveDrawPage(
  page: import("@playwright/test").Page,
  tournamentId: number,
  participantCount: number
) {
  await page.goto(`/admin/tournaments/${tournamentId}/draw`, { waitUntil: "networkidle" });
  const sessionStartBtn = page.getByRole("button", { name: LABEL.sessionStart }).first();
  if (await sessionStartBtn.isVisible().catch(() => false)) {
    const groupSize = 4;
    const groupCount = Math.max(1, Math.ceil(participantCount / groupSize));
    const inputs = page.locator("input");
    const inputCount = await inputs.count();
    if (inputCount >= 2) {
      await inputs.nth(0).fill(String(groupCount));
      await inputs.nth(1).fill(String(groupSize));
    }
    await Promise.all([page.waitForLoadState("networkidle"), sessionStartBtn.click()]);
  }
  await expect(page.getByText(LABEL.progressControl).first()).toBeVisible();
}

async function getAnimatorStageBox(page: import("@playwright/test").Page) {
  const stage = page.getByTestId("draw-animator-stage-wrap").first();
  await expect(stage).toBeVisible();
  return stage.boundingBox();
}

async function readCandidateIdByTone(page: PWPage, tone: "active" | "winner") {
  const locator = page.locator(
    `[data-testid="draw-scoreboard-candidate"][data-candidate-tone="${tone}"]`
  );
  const count = await locator.count();
  if (count === 0) return null;
  return locator.first().getAttribute("data-candidate-id");
}

async function waitForSyncedCandidateId(params: {
  pages: [PWPage, PWPage, PWPage];
  tone: "active" | "winner";
  label: string;
  timeoutMs?: number;
}) {
  const { pages, tone, label, timeoutMs = 10000 } = params;
  const deadline = Date.now() + timeoutMs;
  let lastIds: string[] = [];

  while (Date.now() < deadline) {
    const ids = await Promise.all(pages.map((page) => readCandidateIdByTone(page, tone)));
    lastIds = ids.map((id) => id ?? "null");
    const first = ids[0];
    if (first && ids[1] === first && ids[2] === first) {
      return first;
    }
    await pages[0].waitForTimeout(220);
  }

  throw new Error(`${label} sync failed (${tone}): ${lastIds.join(" / ")}`);
}

async function waitForSyncedFocusText(params: {
  pages: [PWPage, PWPage, PWPage];
  label: string;
  timeoutMs?: number;
}) {
  const { pages, label, timeoutMs = 10000 } = params;
  const deadline = Date.now() + timeoutMs;
  let lastValues: string[] = [];

  while (Date.now() < deadline) {
    const values = await Promise.all(
      pages.map(async (page) => {
        const value = (await page.getByTestId("draw-scoreboard-focus").first().textContent()) ?? "";
        return value.trim();
      })
    );
    lastValues = values;
    const first = values[0];
    if (first.length > 0 && values[1] === first && values[2] === first) {
      return first;
    }
    await pages[0].waitForTimeout(220);
  }

  throw new Error(`${label} sync failed (focus): ${lastValues.join(" / ")}`);
}

async function readSessionId(
  page: import("@playwright/test").Page,
  tournamentId: number
) {
  const result = await page.evaluate(async (id) => {
    const response = await fetch(`/api/admin/tournaments/${id}/draw`, {
      method: "GET",
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | { session?: { id?: number } | null; error?: string }
      | null;
    return {
      ok: response.ok,
      status: response.status,
      sessionId: data?.session?.id ?? null,
      error: data?.error ?? null,
    };
  }, tournamentId);

  if (!result.ok || !result.sessionId) {
    throw new Error(
      `Failed to resolve sessionId (status=${result.status}, error=${result.error ?? "unknown"})`
    );
  }

  return result.sessionId;
}

async function postDrawActionFromUi(
  page: import("@playwright/test").Page,
  tournamentId: number,
  payload: Record<string, unknown>
) {
  const result = await page.evaluate(
    async ({ id, body }) => {
      const response = await fetch(`/api/admin/tournaments/${id}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      return {
        ok: response.ok,
        status: response.status,
        error: data?.error ?? null,
      };
    },
    { id: tournamentId, body: payload }
  );

  if (!result.ok) {
    throw new Error(
      `Draw action failed (status=${result.status}, error=${result.error ?? "unknown"})`
    );
  }
}

test("live draw animation contract verification", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const participantCount = resolveFixtureCount();
  const primaryCredential: Credential = {
    email: process.env.ADMIN_EMAIL || "playwright.admin@testmail.com",
    password: process.env.ADMIN_PASSWORD || "Playwright123!",
  };

  const fixture = await ensurePlayableFixture(primaryCredential, participantCount);

  const credentials: Credential[] = [primaryCredential].filter(
    (credential) => credential.email.trim().length > 0 && credential.password.length > 0
  );

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || text.includes("PixiJS Warning")) {
      consoleErrors.push(`[${msg.type()}] ${text}`);
    }
  });

  await loginAsAdmin(page, credentials);
  await openLiveDrawPage(page, fixture.tournamentId, fixture.participantCount);
  const ensureAdminDrawPage = async () => {
    if (!page.url().includes(`/admin/tournaments/${fixture.tournamentId}/draw`)) {
      await openLiveDrawPage(page, fixture.tournamentId, fixture.participantCount);
    }
  };
  const authStorageState = await page.context().storageState();
  const adminMobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: authStorageState,
  });
  const adminMobilePage = await adminMobileContext.newPage();
  await adminMobilePage.goto(`/admin/tournaments/${fixture.tournamentId}/draw`, {
    waitUntil: "networkidle",
  });
  const viewerContext = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    storageState: authStorageState,
  });
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(`/t/${fixture.tournamentId}/draw`, { waitUntil: "networkidle" });
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: authStorageState,
  });
  const mobileViewerPage = await mobileContext.newPage();
  await mobileViewerPage.goto(`/t/${fixture.tournamentId}/draw`, { waitUntil: "networkidle" });

  const shotDir = `artifacts/live-draw/${stampNow()}`;
  fs.mkdirSync(shotDir, { recursive: true });
  const screenshots: Record<string, string> = {};
  const saveShot = async (name: string) => {
    const filePath = `${shotDir}/${name}.png`;
    await page.screenshot({ path: filePath, fullPage: true });
    screenshots[name] = filePath;
    await testInfo.attach(name, {
      body: fs.readFileSync(filePath),
      contentType: "image/png",
    });
  };
  const saveAnimatorShot = async (name: string) => {
    await ensureAdminDrawPage();
    const stageWrap = page.getByTestId("draw-animator-stage-wrap").first();
    await expect(stageWrap).toBeVisible({ timeout: 10_000 });
    const filePath = `${shotDir}/${name}.png`;
    await stageWrap.screenshot({ path: filePath });
    screenshots[name] = filePath;
    await testInfo.attach(name, {
      body: fs.readFileSync(filePath),
      contentType: "image/png",
    });
  };
  const saveViewerShot = async (name: string) => {
    const filePath = `${shotDir}/${name}.png`;
    await viewerPage.screenshot({ path: filePath, fullPage: true });
    screenshots[name] = filePath;
    await testInfo.attach(name, {
      body: fs.readFileSync(filePath),
      contentType: "image/png",
    });
  };
  const saveMobileViewerShot = async (name: string) => {
    const filePath = `${shotDir}/${name}.png`;
    await mobileViewerPage.screenshot({ path: filePath, fullPage: true });
    screenshots[name] = filePath;
    await testInfo.attach(name, {
      body: fs.readFileSync(filePath),
      contentType: "image/png",
    });
  };
  const saveAdminMobileShot = async (name: string) => {
    const filePath = `${shotDir}/${name}.png`;
    await adminMobilePage.screenshot({ path: filePath, fullPage: true });
    screenshots[name] = filePath;
    await testInfo.attach(name, {
      body: fs.readFileSync(filePath),
      contentType: "image/png",
    });
  };

  await page.waitForTimeout(900);
  await ensureAdminDrawPage();
  await saveShot("01_initial");
  await saveAnimatorShot("01a_initial_animator");
  await viewerPage.waitForTimeout(900);
  await saveViewerShot("01_viewer_initial");
  await mobileViewerPage.waitForTimeout(900);
  await saveMobileViewerShot("01_viewer_mobile_initial");
  await adminMobilePage.waitForTimeout(900);
  await saveAdminMobileShot("01_admin_mobile_initial");
  const adminMobileShuffleButton = adminMobilePage
    .getByRole("button", { name: "덱 섞기" })
    .first();
  await expect(adminMobileShuffleButton).toBeVisible();
  await expect(adminMobileShuffleButton).toBeEnabled();
  await adminMobileShuffleButton.click();
  const adminMobileShuffleToast = adminMobilePage.getByText("덱 섞는중입니다.").first();
  await expect(adminMobileShuffleToast).toBeVisible({ timeout: 5000 });
  const viewerShuffleToast = viewerPage.getByText("덱 섞는중입니다.").first();
  const mobileViewerShuffleToast = mobileViewerPage.getByText("덱 섞는중입니다.").first();
  await expect(viewerShuffleToast).toBeVisible({ timeout: 7000 });
  await expect(mobileViewerShuffleToast).toBeVisible({ timeout: 7000 });
  await saveAdminMobileShot("01_admin_mobile_shuffle_toast");
  await saveViewerShot("01_viewer_shuffle_toast");
  await saveMobileViewerShot("01_viewer_mobile_shuffle_toast");
  const mobileInitialCandidateCount = await mobileViewerPage
    .getByTestId("draw-scoreboard-candidate")
    .count();
  const mobileCurrentLine = mobileViewerPage.getByTestId("draw-scoreboard-current-line").first();
  await expect(mobileCurrentLine).toBeVisible();
  const mobileCurrentLineText = ((await mobileCurrentLine.textContent()) ?? "").trim();
  expect(mobileInitialCandidateCount).toBe(fixture.participantCount);
  expect(mobileCurrentLineText.length).toBeGreaterThan(2);

  await ensureAdminDrawPage();
  const sessionId = await readSessionId(page, fixture.tournamentId);
  await postDrawActionFromUi(page, fixture.tournamentId, {
    action: "start_step",
    sessionId,
    mode: "ROUND_ROBIN",
    targetGroupNo: null,
    durationMs: 1800,
  });
  await page.waitForTimeout(1200);
  await saveShot("02_configured");
  await saveAnimatorShot("02a_configured_animator");
  await viewerPage.waitForTimeout(1200);
  await saveViewerShot("02_viewer_configured");
  await mobileViewerPage.waitForTimeout(1200);
  await saveMobileViewerShot("02_viewer_mobile_configured");
  const mobileConfiguredCompactCard = mobileViewerPage
    .getByTestId("draw-scoreboard-mobile-focus-card")
    .first();
  await expect(mobileConfiguredCompactCard).toBeVisible();
  const mobileConfiguredFace = await mobileConfiguredCompactCard.getAttribute("data-candidate-face");
  expect(["front", "back"]).toContain(mobileConfiguredFace ?? "");
  const mobileConfiguredCompactText = (
    (await mobileConfiguredCompactCard.textContent()) ?? ""
  ).trim();
  expect(mobileConfiguredCompactText).toContain("추첨중입니다.");
  const mobileConfiguredFocusChipText = (
    (await mobileViewerPage.getByTestId("draw-scoreboard-focus").first().textContent()) ?? ""
  ).trim();
  expect(mobileConfiguredFocusChipText).not.toContain("pw-draw-");
  const adminConfiguredFrontCount = await page
    .locator('[data-testid="draw-scoreboard-candidate"][data-candidate-face="front"]')
    .count();
  const adminConfiguredBackCount = await page
    .locator('[data-testid="draw-scoreboard-candidate"][data-candidate-face="back"]')
    .count();
  expect(adminConfiguredBackCount).toBeGreaterThan(0);
  expect(adminConfiguredFrontCount).toBeLessThanOrEqual(2);
  const viewerConfiguredFrontCount = await viewerPage
    .locator('[data-testid="draw-scoreboard-candidate"][data-candidate-face="front"]')
    .count();
  const viewerConfiguredBackCount = await viewerPage
    .locator('[data-testid="draw-scoreboard-candidate"][data-candidate-face="back"]')
    .count();
  expect(viewerConfiguredBackCount).toBeGreaterThan(0);
  expect(viewerConfiguredFrontCount).toBeLessThanOrEqual(2);
  const configuredSyncId = await waitForSyncedCandidateId({
    pages: [page, viewerPage, mobileViewerPage],
    tone: "active",
    label: "configured",
  });

  const box = await getAnimatorStageBox(page);
  expect(box && box.width > 100 && box.height > 100).toBeTruthy();
  const adminStageTopY = box?.y ?? 9999;
  expect(adminStageTopY).toBeLessThan(520);

  const winnerTextAdmin = page
    .locator("p")
    .filter({ hasText: new RegExp(`^${LABEL.winnerPrefix}`) })
    .first();
  const winnerTextViewer = viewerPage
    .locator("p")
    .filter({ hasText: new RegExp(`^${LABEL.winnerPrefix}`) })
    .first();
  const winnerTextMobileViewer = mobileViewerPage
    .locator("p")
    .filter({ hasText: new RegExp(`^${LABEL.winnerPrefix}`) })
    .first();
  await ensureAdminDrawPage();
  await postDrawActionFromUi(page, fixture.tournamentId, {
    action: "pick_result",
    sessionId,
  });
  await page.waitForTimeout(180);

  await expect(winnerTextAdmin).toHaveCount(0);
  await expect(winnerTextViewer).toHaveCount(0);
  await expect(winnerTextMobileViewer).toHaveCount(0);

  await saveShot("03_picked_locking");
  await saveAnimatorShot("03a_picked_locking_animator");
  await saveViewerShot("03_viewer_picked_locking");
  await saveMobileViewerShot("03_viewer_mobile_picked_locking");

  await expect(winnerTextAdmin).toBeVisible({ timeout: 7000 });
  await expect(winnerTextViewer).toBeVisible({ timeout: 7000 });
  await expect(winnerTextMobileViewer).toBeVisible({ timeout: 7000 });
  const winnerAfterPickedAdmin = ((await winnerTextAdmin.textContent()) ?? "").trim();
  const winnerAfterPickedViewer = ((await winnerTextViewer.textContent()) ?? "").trim();
  const winnerAfterPickedMobileViewer = (
    (await winnerTextMobileViewer.textContent()) ?? ""
  ).trim();
  expect(winnerAfterPickedAdmin.startsWith(LABEL.winnerPrefix)).toBeTruthy();
  expect(winnerAfterPickedViewer).toBe(winnerAfterPickedAdmin);
  expect(winnerAfterPickedMobileViewer).toBe(winnerAfterPickedAdmin);

  await saveShot("03b_picked_settled");
  await saveAnimatorShot("03b_picked_settled_animator");
  await saveViewerShot("03b_viewer_picked_settled");
  await saveMobileViewerShot("03b_viewer_mobile_picked_settled");

  await ensureAdminDrawPage();
  await postDrawActionFromUi(page, fixture.tournamentId, {
    action: "assign_confirm",
    sessionId,
  });
  await page.waitForTimeout(900);
  await saveShot("04_confirmed");
  await saveAnimatorShot("04a_confirmed_animator");
  await viewerPage.waitForTimeout(900);
  await saveViewerShot("04_viewer_confirmed");
  await mobileViewerPage.waitForTimeout(900);
  await saveMobileViewerShot("04_viewer_mobile_confirmed");

  await expect(winnerTextAdmin).toBeVisible();
  await expect(winnerTextViewer).toBeVisible();
  await expect(winnerTextMobileViewer).toBeVisible();
  const winnerAfterConfirmAdmin = ((await winnerTextAdmin.textContent()) ?? "").trim();
  const winnerAfterConfirmViewer = ((await winnerTextViewer.textContent()) ?? "").trim();
  const winnerAfterConfirmMobileViewer = (
    (await winnerTextMobileViewer.textContent()) ?? ""
  ).trim();
  expect(winnerAfterConfirmAdmin).toBe(winnerAfterPickedAdmin);
  expect(winnerAfterConfirmViewer).toBe(winnerAfterPickedAdmin);
  expect(winnerAfterConfirmMobileViewer).toBe(winnerAfterPickedAdmin);
  await expect(page.getByText(LABEL.spinning).first()).not.toBeVisible();
  const confirmedFocusSyncText = await waitForSyncedFocusText({
    pages: [page, viewerPage, mobileViewerPage],
    label: "confirmed",
  });

  await ensureAdminDrawPage();
  await postDrawActionFromUi(page, fixture.tournamentId, {
    action: "start_step",
    sessionId,
    mode: "ROUND_ROBIN",
    targetGroupNo: null,
    durationMs: 1800,
  });
  await page.waitForTimeout(1100);
  await saveShot("05_next_step_configured");
  await saveAnimatorShot("05a_next_step_configured_animator");
  await viewerPage.waitForTimeout(1100);
  await saveViewerShot("05_viewer_next_step_configured");
  await mobileViewerPage.waitForTimeout(1100);
  await saveMobileViewerShot("05_viewer_mobile_next_step_configured");
  const boxAfterNext = await getAnimatorStageBox(page);
  expect(boxAfterNext && boxAfterNext.width > 100 && boxAfterNext.height > 100).toBeTruthy();
  const viewerStage = await getAnimatorStageBox(viewerPage);
  expect(viewerStage && viewerStage.width > 100 && viewerStage.height > 100).toBeTruthy();
  const mobileViewerStage = await getAnimatorStageBox(mobileViewerPage);
  expect(mobileViewerStage && mobileViewerStage.width > 100 && mobileViewerStage.height > 100).toBeTruthy();
  const nextConfiguredSyncId = await waitForSyncedCandidateId({
    pages: [page, viewerPage, mobileViewerPage],
    tone: "active",
    label: "next-configured",
  });
  const mobileNextConfiguredCompactCard = mobileViewerPage
    .getByTestId("draw-scoreboard-mobile-focus-card")
    .first();
  await expect(mobileNextConfiguredCompactCard).toBeVisible();
  const mobileNextConfiguredFace = await mobileNextConfiguredCompactCard.getAttribute(
    "data-candidate-face"
  );
  expect(["front", "back"]).toContain(mobileNextConfiguredFace ?? "");
  const mobileNextConfiguredCompactText = (
    (await mobileNextConfiguredCompactCard.textContent()) ?? ""
  ).trim();
  expect(mobileNextConfiguredCompactText).toContain("추첨중입니다.");
  const mobileNextConfiguredFocusChipText = (
    (await mobileViewerPage.getByTestId("draw-scoreboard-focus").first().textContent()) ?? ""
  ).trim();
  expect(mobileNextConfiguredFocusChipText).not.toContain("pw-draw-");

  await viewerPage.setViewportSize({ width: 1100, height: 900 });
  await viewerPage.goto(`/t/${fixture.tournamentId}/participants`, { waitUntil: "networkidle" });
  await viewerPage.waitForTimeout(900);
  await saveViewerShot("06_viewer_participants_anchor_top");
  await expect(viewerPage.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(viewerPage.getByText("목차").first()).toHaveCount(0);
  await viewerPage.evaluate(() => window.scrollTo({ top: 900, behavior: "auto" }));
  await viewerPage.waitForTimeout(300);
  await saveViewerShot("06b_viewer_participants_anchor_scrolled");
  const participantsHeaderTop = await viewerPage
    .getByRole("heading", { level: 1 })
    .first()
    .evaluate((node) => node.getBoundingClientRect().top);
  expect(participantsHeaderTop).toBeLessThan(120);

  expect(consoleErrors).toEqual([]);

  const reportPath = `${shotDir}/report.json`;
  const report = {
    tournamentId: fixture.tournamentId,
    participantCount: fixture.participantCount,
    checks: {
      stageVisible: !!box && box.width > 100 && box.height > 100,
      adminStageTopPlacementOk: adminStageTopY < 520,
      winnerHiddenDuringPicked: true,
      winnerVisibleAfterPickedSettle:
        winnerAfterPickedAdmin.startsWith(LABEL.winnerPrefix) &&
        winnerAfterPickedViewer === winnerAfterPickedAdmin &&
        winnerAfterPickedMobileViewer === winnerAfterPickedAdmin,
      winnerTextSyncedAfterConfirm:
        winnerAfterConfirmAdmin.startsWith(LABEL.winnerPrefix) &&
        winnerAfterConfirmViewer === winnerAfterConfirmAdmin &&
        winnerAfterConfirmMobileViewer === winnerAfterConfirmAdmin,
      noSpinTextAfterConfirm: true,
      stageVisibleAfterNextStep: !!boxAfterNext && boxAfterNext.width > 100 && boxAfterNext.height > 100,
      viewerStageVisible: !!viewerStage && viewerStage.width > 100 && viewerStage.height > 100,
      mobileViewerStageVisible:
        !!mobileViewerStage &&
        mobileViewerStage.width > 100 &&
        mobileViewerStage.height > 100,
      adminMobileShuffleToastVisible: true,
      viewerShuffleToastVisible: true,
      mobileViewerShuffleToastVisible: true,
      configuredSyncAcrossAdminViewerMobile: Boolean(configuredSyncId),
      confirmedWinnerSyncAcrossAdminViewerMobile: Boolean(confirmedFocusSyncText),
      nextConfiguredSyncAcrossAdminViewerMobile: Boolean(nextConfiguredSyncId),
      mobileFullSlotVisible: mobileInitialCandidateCount === fixture.participantCount,
      mobileFocusCandidateVisible: true,
      adminConfiguredMostlyHidden:
        adminConfiguredBackCount > 0 && adminConfiguredFrontCount <= 2,
      viewerConfiguredMostlyHidden:
        viewerConfiguredBackCount > 0 && viewerConfiguredFrontCount <= 2,
      mobileConfiguredCompactCardVisible: true,
      mobileNextConfiguredCompactCardVisible: true,
      mobileConfiguredNoNicknameLeak: !mobileConfiguredFocusChipText.includes("pw-draw-"),
      mobileNextConfiguredNoNicknameLeak: !mobileNextConfiguredFocusChipText.includes("pw-draw-"),
      mobileCurrentLineReadable: mobileCurrentLineText.length > 2,
      participantsAnchorNoRightOverlay: true,
      participantsStickyHeaderVisibleAfterScroll: participantsHeaderTop < 120,
      noConsoleErrors: consoleErrors.length === 0,
    },
    syncIds: {
      configured: configuredSyncId,
      confirmedWinner: confirmedFocusSyncText,
      nextConfigured: nextConfiguredSyncId,
    },
    screenshots,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  await testInfo.attach("report", {
    body: fs.readFileSync(reportPath),
    contentType: "application/json",
  });
  await adminMobileContext.close();
  await viewerContext.close();
  await mobileContext.close();
});
