import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      return [key, value.replace(/^"|"$/g, "")];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const adminEmail = "admin@test.com";
const adminPassword = "TestAdmin123!";
const userEmail = "user1@test.com";
const userPassword = "TestUser123!";

const makeClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const admin = makeClient();
const user = makeClient();

const results = [];
const log = (label, ok, detail = "") => {
  results.push({ label, ok, detail });
  console.log(`${ok ? "[OK]" : "[FAIL]"} ${label}${detail ? ` - ${detail}` : ""}`);
};

let tournamentId = null;

try {
  // Admin sign-in
  const adminSignIn = await admin.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (adminSignIn.error) throw adminSignIn.error;
  log("Admin 로그인", true);

  const adminProfile = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", adminSignIn.data.user?.id)
    .single();
  log("Admin 권한 확인", adminProfile.data?.is_admin === true);

  // User sign-in
  const userSignIn = await user.auth.signInWithPassword({
    email: userEmail,
    password: userPassword,
  });
  if (userSignIn.error) throw userSignIn.error;
  log("User 로그인", true);

  const userProfile = await user
    .from("profiles")
    .select("is_admin")
    .eq("id", userSignIn.data.user?.id)
    .single();
  log("User 권한 확인", userProfile.data?.is_admin === false);

  // Admin: create tournament
  const title = `TEST_VERIFY_${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const tInsert = await admin
    .from("tournaments")
    .insert({
      title,
      event_date: today,
      status: "draft",
    })
    .select("id")
    .single();

  if (tInsert.error) throw tInsert.error;
  tournamentId = tInsert.data.id;
  log("Admin 대회 생성", Boolean(tournamentId));

  // Admin: update status
  const tUpdate = await admin
    .from("tournaments")
    .update({ status: "open" })
    .eq("id", tournamentId);
  log("Admin 대회 상태 변경", !tUpdate.error, tUpdate.error?.message);

  // Admin: create meal option
  const mealInsert = await admin.from("tournament_meal_options").insert({
    tournament_id: tournamentId,
    menu_name: "테스트 메뉴",
    display_order: 1,
    is_active: true,
  });
  log("Admin 식사 메뉴 추가", !mealInsert.error, mealInsert.error?.message);

  // User: list tournaments
  const listRes = await user.from("tournaments").select("id").limit(1);
  log("User 대회 목록 조회", !listRes.error, listRes.error?.message);

  // User: register for tournament
  const regInsert = await user
    .from("registrations")
    .insert({
      tournament_id: tournamentId,
      user_id: userSignIn.data.user?.id,
      nickname: "테스트유저",
      status: "applied",
    })
    .select("id")
    .single();

  if (regInsert.error) throw regInsert.error;
  const registrationId = regInsert.data.id;
  log("User 대회 신청", Boolean(registrationId));

  // User: update own registration memo
  const regUpdate = await user
    .from("registrations")
    .update({ memo: "테스트 메모" })
    .eq("id", registrationId);
  log("User 신청 수정", !regUpdate.error, regUpdate.error?.message);

  // User: upsert extras
  const extrasUpsert = await user.from("registration_extras").upsert(
    {
      registration_id: registrationId,
      carpool_available: true,
      carpool_seats: 2,
      transportation: "자차",
      departure_location: "강남",
      notes: "테스트",
    },
    { onConflict: "registration_id" }
  );
  log("User 추가정보 저장", !extrasUpsert.error, extrasUpsert.error?.message);

  // Admin: confirm registration
  const regAdminUpdate = await admin
    .from("registrations")
    .update({ status: "confirmed" })
    .eq("id", registrationId);
  log("Admin 신청 상태 변경", !regAdminUpdate.error, regAdminUpdate.error?.message);

  // User: attempt to create group (should fail)
  const userGroupInsert = await user.from("tournament_groups").insert({
    tournament_id: tournamentId,
    group_no: 1,
  });
  log("User 조 생성 차단", Boolean(userGroupInsert.error));

  // Admin: create group
  const groupInsert = await admin
    .from("tournament_groups")
    .insert({
      tournament_id: tournamentId,
      group_no: 1,
      is_published: true,
      tee_time: "08:10",
    })
    .select("id")
    .single();

  if (groupInsert.error) throw groupInsert.error;
  const groupId = groupInsert.data.id;
  log("Admin 조 생성", Boolean(groupId));

  // Admin: assign member
  const memberInsert = await admin.from("tournament_group_members").insert({
    group_id: groupId,
    registration_id: registrationId,
    position: 1,
  });
  log("Admin 조 멤버 배정", !memberInsert.error, memberInsert.error?.message);

  // User: view published groups
  const groupList = await user
    .from("tournament_groups")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("is_published", true);
  log("User 공개 조 조회", !groupList.error && groupList.data?.length > 0);

  // User: carpool public view
  const carpoolPublic = await user.rpc("get_carpool_public", {
    p_tournament_id: tournamentId,
  });
  log(
    "User 카풀 공개 조회",
    !carpoolPublic.error && (carpoolPublic.data?.length ?? 0) > 0
  );

  // User: attempt to insert tournament (should fail)
  const userTournamentInsert = await user.from("tournaments").insert({
    title: "USER_SHOULD_FAIL",
    event_date: today,
    status: "draft",
  });
  log("User 대회 생성 차단", Boolean(userTournamentInsert.error));
} catch (err) {
  log("테스트 실행 중 오류", false, err?.message ?? String(err));
} finally {
  if (tournamentId) {
    await admin.from("tournaments").delete().eq("id", tournamentId);
    log("테스트 데이터 정리", true, `tournament_id=${tournamentId}`);
  }
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.log(`\nFAILED: ${failed.length} checks`);
  process.exit(1);
}

console.log("\nAll checks passed");
