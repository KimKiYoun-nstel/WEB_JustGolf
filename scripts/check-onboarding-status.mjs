/**
 * 운영 DB에서 온보딩 완료/미완료 사용자 목록 조회
 * 실행: node scripts/check-onboarding-status.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// env.production.local 로드
const envPath = resolve(process.cwd(), ".env.production.local");
const envContent = readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// auth.users 전체 목록 조회 (Service Role 필요)
const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

if (error) {
  console.error("❌ 사용자 조회 실패:", error.message);
  process.exit(1);
}

// profiles 테이블에서 닉네임 조회
const { data: profiles } = await supabase
  .from("profiles")
  .select("id, nickname, full_name, phone, email");

const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

const completed = [];
const notCompleted = [];

for (const user of users) {
  const isCompleted = user.user_metadata?.onboarding_completed === true;
  const profile = profileMap.get(user.id);
  const nickname = profile?.nickname ?? user.user_metadata?.nickname ?? "(닉네임 없음)";
  const hasPhone = !!(profile?.phone || user.user_metadata?.phone);
  const hasFullName = !!(profile?.full_name || user.user_metadata?.full_name);

  const entry = {
    nickname,
    email: profile?.email ?? user.email ?? "",
    hasPhone,
    hasFullName,
    createdAt: user.created_at?.slice(0, 10),
  };

  if (isCompleted) {
    completed.push(entry);
  } else {
    notCompleted.push(entry);
  }
}

// 닉네임 정렬
completed.sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));
notCompleted.sort((a, b) => a.nickname.localeCompare(b.nickname, "ko"));

console.log(`\n${"=".repeat(60)}`);
console.log(`✅ 온보딩 완료 (${completed.length}명)`);
console.log("=".repeat(60));
completed.forEach((u, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${u.nickname.padEnd(20)} | ${u.email}`);
});

console.log(`\n${"=".repeat(60)}`);
console.log(`❌ 온보딩 미완료 (${notCompleted.length}명)`);
console.log("=".repeat(60));
notCompleted.forEach((u, i) => {
  const flags = [
    !u.hasPhone ? "전화번호없음" : "",
    !u.hasFullName ? "이름없음" : "",
  ].filter(Boolean).join(", ");
  console.log(`  ${String(i + 1).padStart(2)}. ${u.nickname.padEnd(20)} | ${u.email}${flags ? ` [${flags}]` : ""}`);
});

console.log(`\n총 ${users.length}명 중 완료 ${completed.length}명 / 미완료 ${notCompleted.length}명\n`);
