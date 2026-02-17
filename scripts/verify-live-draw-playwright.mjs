import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function nowTag() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

async function existsVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function clickIfEnabled(locator) {
  const enabled = await locator.isEnabled().catch(() => false);
  if (!enabled) return false;
  await locator.click();
  return true;
}

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const adminEmail = process.env.ADMIN_EMAIL ?? "prodigyrcn@gmail.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "123456";
const outputDir = path.join(process.cwd(), "artifacts", "live-draw", nowTag());
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1800 },
});
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (msg.type() === "error" || text.includes("PixiJS Warning")) {
    consoleErrors.push(`[${msg.type()}] ${text}`);
  }
});

const report = {
  baseURL,
  drawUrl: "",
  screenshots: {},
  checks: {},
  consoleErrors,
};

try {
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').first().fill(adminEmail);
  await page.locator('input[type="password"]').first().fill(adminPassword);

  const loginBtn = page.getByRole("button", { name: /로그인/ }).first();
  await Promise.all([
    page.waitForLoadState("networkidle"),
    loginBtn.click(),
  ]);

  if (page.url().includes("/login")) {
    throw new Error("관리자 로그인 실패: 로그인 페이지에 머물러 있습니다.");
  }

  await page.goto(`${baseURL}/admin/tournaments/1/draw`, { waitUntil: "networkidle" });
  const controlHeader = page.getByText("진행 컨트롤").first();

  if (!(await existsVisible(controlHeader))) {
    await page.goto(`${baseURL}/admin/tournaments`, { waitUntil: "networkidle" });
    const drawLink = page.locator('a[href*="/draw"]').first();
    if (!(await existsVisible(drawLink))) {
      throw new Error("라이브 조편성 페이지 링크를 찾지 못했습니다.");
    }
    await Promise.all([
      page.waitForLoadState("networkidle"),
      drawLink.click(),
    ]);
  }

  report.drawUrl = page.url();

  await page.waitForTimeout(800);
  const initialShot = path.join(outputDir, "01_initial.png");
  await page.screenshot({ path: initialShot, fullPage: true });
  report.screenshots.initial = initialShot;

  const startStepBtn = page.getByRole("button", { name: "다음 스텝 시작" }).first();
  await startStepBtn.click();
  await page.waitForTimeout(1200);

  const configuredShot = path.join(outputDir, "02_configured.png");
  await page.screenshot({ path: configuredShot, fullPage: true });
  report.screenshots.configured = configuredShot;

  const pickBtn = page.getByRole("button", { name: "당첨자 뽑기" }).first();
  const pickClicked = await clickIfEnabled(pickBtn);
  if (!pickClicked) {
    await page.waitForTimeout(3500);
    await clickIfEnabled(pickBtn);
  }

  await page.waitForTimeout(1000);
  const pickedShot = path.join(outputDir, "03_picked.png");
  await page.screenshot({ path: pickedShot, fullPage: true });
  report.screenshots.picked = pickedShot;

  const winnerText = page.locator("p").filter({ hasText: /^당첨:/ }).first();
  const winnerValue =
    (await winnerText.textContent().catch(() => "")).replace(/\s+/g, " ").trim() || null;

  const confirmBtn = page.getByRole("button", { name: "배정 확정" }).first();
  await confirmBtn.click();
  await page.waitForTimeout(800);

  const confirmedShot = path.join(outputDir, "04_confirmed.png");
  await page.screenshot({ path: confirmedShot, fullPage: true });
  report.screenshots.confirmed = confirmedShot;

  const winnerAfterConfirm =
    ((await winnerText.textContent().catch(() => "")) || "").replace(/\s+/g, " ").trim() || null;

  const spinningTextVisible = await existsVisible(page.getByText("추첨 연출 진행 중...").first());
  const stageWrap = page.getByTestId("draw-animator-stage-wrap").first();
  const stageBox = await stageWrap.boundingBox();

  report.checks = {
    loggedIn: true,
    controlVisible: await existsVisible(controlHeader),
    stageVisible: !!stageBox && stageBox.width > 100 && stageBox.height > 100,
    winnerShownAfterPick: !!winnerValue,
    winnerConsistentAfterConfirm:
      !!winnerValue && !!winnerAfterConfirm && winnerValue === winnerAfterConfirm,
    noSpinTextAfterConfirm: !spinningTextVisible,
  };

  const reportPath = path.join(outputDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`VERIFY_REPORT=${reportPath}`);
  console.log(JSON.stringify(report.checks, null, 2));
} catch (error) {
  const failShot = path.join(outputDir, "99_failure.png");
  await page.screenshot({ path: failShot, fullPage: true }).catch(() => {});
  const reportPath = path.join(outputDir, "report.json");
  const fail = {
    ...report,
    error: error instanceof Error ? error.message : String(error),
    screenshots: { ...report.screenshots, failure: failShot },
  };
  fs.writeFileSync(reportPath, JSON.stringify(fail, null, 2), "utf8");
  console.error(`VERIFY_REPORT=${reportPath}`);
  console.error(fail.error);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
