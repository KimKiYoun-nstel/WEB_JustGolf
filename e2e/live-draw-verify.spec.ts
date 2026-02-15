import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const LABEL = {
  login: "\uB85C\uADF8\uC778",
  saveAndStart: "\uC800\uC7A5\uD558\uACE0 \uC2DC\uC791\uD558\uAE30",
  progressControl: "\uC9C4\uD589 \uCEE8\uD2B8\uB864",
  sessionStart: "\uC138\uC158 \uC2DC\uC791",
  nextStep: "\uB2E4\uC74C \uC2A4\uD15D \uC2DC\uC791",
  pickWinner: "\uB2F9\uCCA8\uC790 \uBF51\uAE30",
  assignConfirm: "\uBC30\uC815 \uD655\uC815",
  winnerPrefix: "\uB2F9\uCCA8:",
  spinning: "\uB85C\uB610 \uCD94\uCCA8 \uC911...",
};

type Credential = { email: string; password: string };

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

async function ensurePlayableFixture(credential: Credential) {
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

  const rows = Array.from({ length: 40 }, (_, i) => ({
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

  return { tournamentId };
}

async function loginAsAdmin(page: import("@playwright/test").Page, credentials: Credential[]) {
  for (const credential of credentials) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const emailInput = page.getByPlaceholder("example@company.com").first();
    const passwordInput = page.locator('input[type="password"]').first();
    await expect(emailInput).toBeEnabled();
    await expect(passwordInput).toBeEnabled();
    await emailInput.fill(credential.email);
    await passwordInput.fill(credential.password);

    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.getByRole("button", { name: LABEL.login }).first().click(),
    ]);

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

async function openLiveDrawPage(page: import("@playwright/test").Page, tournamentId: number) {
  await page.goto(`/admin/tournaments/${tournamentId}/draw`, { waitUntil: "networkidle" });
  const sessionStartBtn = page.getByRole("button", { name: LABEL.sessionStart }).first();
  if (await sessionStartBtn.isVisible().catch(() => false)) {
    await Promise.all([page.waitForLoadState("networkidle"), sessionStartBtn.click()]);
  }
  await expect(page.getByText(LABEL.progressControl).first()).toBeVisible();
}

async function getLargestCanvasBox(page: import("@playwright/test").Page) {
  const canvases = page.locator("canvas");
  const count = await canvases.count();
  let best:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | null = null;
  for (let i = 0; i < count; i += 1) {
    const box = await canvases.nth(i).boundingBox();
    if (!box || box.width < 2 || box.height < 2) continue;
    if (!best || box.width * box.height > best.width * best.height) {
      best = box;
    }
  }
  return best;
}

test("live draw animation contract verification", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const primaryCredential: Credential = {
    email: process.env.ADMIN_EMAIL || "playwright.admin@testmail.com",
    password: process.env.ADMIN_PASSWORD || "Playwright123!",
  };

  const fixture = await ensurePlayableFixture(primaryCredential);

  const credentials: Credential[] = [
    primaryCredential,
    { email: "prodigyrcn@gmail.com", password: "123456" },
    { email: "man@man.com", password: "qwer1234!" },
  ].filter((credential) => credential.email.trim().length > 0 && credential.password.length > 0);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || text.includes("PixiJS Warning")) {
      consoleErrors.push(`[${msg.type()}] ${text}`);
    }
  });

  await loginAsAdmin(page, credentials);
  await openLiveDrawPage(page, fixture.tournamentId);
  const stageWrap = page.getByTestId("draw-animator-stage-wrap").first();

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
    await expect(stageWrap).toBeVisible();
    const filePath = `${shotDir}/${name}.png`;
    await stageWrap.screenshot({ path: filePath });
    screenshots[name] = filePath;
    await testInfo.attach(name, {
      body: fs.readFileSync(filePath),
      contentType: "image/png",
    });
  };

  await page.waitForTimeout(900);
  await saveShot("01_initial");
  await saveAnimatorShot("01a_initial_animator");

  await page.getByRole("button", { name: LABEL.nextStep }).first().click();
  await page.waitForTimeout(1200);
  await saveShot("02_configured");
  await saveAnimatorShot("02a_configured_animator");

  const box = await getLargestCanvasBox(page);
  expect(box && box.width > 100 && box.height > 100).toBeTruthy();

  const pickButton = page.getByRole("button", { name: LABEL.pickWinner }).first();
  const winnerText = page.locator("p").filter({ hasText: new RegExp(`^${LABEL.winnerPrefix}`) }).first();
  const initialPickEnabled = await pickButton.isEnabled().catch(() => false);
  if (initialPickEnabled) {
    await pickButton.click();
  } else {
    await Promise.race([
      winnerText.waitFor({ state: "visible", timeout: 7000 }),
      (async () => {
        await page.waitForTimeout(4200);
        const enabledLater = await pickButton.isEnabled().catch(() => false);
        if (enabledLater) {
          await pickButton.click();
        }
      })(),
    ]);
  }
  await page.waitForTimeout(1000);
  await saveShot("03_picked");
  await saveAnimatorShot("03a_picked_animator");

  await expect(winnerText).toBeVisible();
  const winnerBeforeConfirm = ((await winnerText.textContent()) ?? "").trim();
  expect(winnerBeforeConfirm.startsWith(LABEL.winnerPrefix)).toBeTruthy();

  await page.getByRole("button", { name: LABEL.assignConfirm }).first().click();
  await page.waitForTimeout(900);
  await saveShot("04_confirmed");
  await saveAnimatorShot("04a_confirmed_animator");

  const winnerAfterConfirm = ((await winnerText.textContent()) ?? "").trim();
  expect(winnerAfterConfirm).toBe(winnerBeforeConfirm);
  await expect(page.getByText(LABEL.spinning).first()).not.toBeVisible();

  await page.getByRole("button", { name: LABEL.nextStep }).first().click();
  await page.waitForTimeout(1100);
  await saveShot("05_next_step_configured");
  await saveAnimatorShot("05a_next_step_configured_animator");
  const boxAfterNext = await getLargestCanvasBox(page);
  expect(boxAfterNext && boxAfterNext.width > 100 && boxAfterNext.height > 100).toBeTruthy();

  expect(consoleErrors).toEqual([]);

  const reportPath = `${shotDir}/report.json`;
  const report = {
    tournamentId: fixture.tournamentId,
    checks: {
      canvasVisible: !!box && box.width > 100 && box.height > 100,
      winnerTextStable: winnerAfterConfirm === winnerBeforeConfirm,
      noSpinTextAfterConfirm: true,
      canvasVisibleAfterNextStep: !!boxAfterNext && boxAfterNext.width > 100 && boxAfterNext.height > 100,
      noConsoleErrors: consoleErrors.length === 0,
    },
    screenshots,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  await testInfo.attach("report", {
    body: fs.readFileSync(reportPath),
    contentType: "application/json",
  });
});
