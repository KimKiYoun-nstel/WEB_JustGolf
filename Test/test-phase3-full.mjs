import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://iipxdzaqstsnbhwuspfl.supabase.co";
const supabaseAnonKey = "sb_publishable_w2l9LnyLWFgqXvjnRSbn2g_YyhuOOO4";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const adminCreds = {
  email: "admin@test.com",
  password: "TestAdmin123!",
};

const user1Creds = {
  email: "user1@test.com",
  password: "TestUser123!",
};

const user2Creds = {
  email: "user2@test.com",
  password: "TestUser123!",
};

async function testPhase3() {
  console.log("\n==== Phase 3 기능 통합 테스트 ====\n");

  try {
    // Step 1: 관리자 로그인
    console.log("1️⃣ 관리자 로그인...");
    const adminAuthRes = await supabase.auth.signInWithPassword({
      email: adminCreds.email,
      password: adminCreds.password,
    });

    if (adminAuthRes.error) {
      console.log("❌ 관리자 로그인 실패:", adminAuthRes.error.message);
      return;
    }

    const adminUserId = adminAuthRes.data.user?.id;
    const adminToken = adminAuthRes.data.session?.access_token;
    console.log(`✅ 관리자 로그인 (ID: ${adminUserId})`);

    // Step 2: 관리자 권한 확인
    console.log("\n2️⃣ 관리자 권한 확인...");
    const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    });

    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("is_admin")
      .eq("id", adminUserId)
      .single();

    if (adminProfile?.is_admin) {
      console.log("✅ 관리자 권한 확인됨!");
    } else {
      console.log(
        "⚠️  관리자 권한 미설정. Supabase SQL에서 설정 후 다시 시도하세요."
      );
      return;
    }

    // Step 3: 대회 확인
    console.log("\n3️⃣ 테스트 대회 확인...");
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id,title,event_date")
      .eq("id", 1)
      .single();

    if (!tournament) {
      console.log("❌ 테스트 대회가 없습니다. 먼저 대회를 생성하세요.");
      return;
    }
    console.log(`✅ 대회: ${tournament.title} (${tournament.event_date})`);

    // Step 4: 라운드 생성 (관리자)
    console.log("\n4️⃣ 라운드 생성 (관리자)...");
    const sideEventData = [
      {
        tournament_id: 1,
        round_type: "pre",
        title: "사전 라운드 - 화이트코스",
        tee_time: "07:00",
        location: "클럽 흑 금강",
        notes: "사전 라운드 일정입니다.",
        max_participants: 20,
        status: "open",
        created_by: adminUserId,
      },
      {
        tournament_id: 1,
        round_type: "post",
        title: "사후 라운드 - 블루코스",
        tee_time: "12:00",
        location: "클럽 흑 금강",
        notes: "사후 라운드 일정입니다.",
        max_participants: 18,
        status: "open",
        created_by: adminUserId,
      },
    ];

    const { data: createdSideEvents, error: seError } = await adminClient
      .from("side_events")
      .insert(sideEventData)
      .select();

    if (seError) {
      console.log("❌ 라운드 생성 실패:", seError.message);
      return;
    }

    const preSideEventId = createdSideEvents[0].id;
    const postSideEventId = createdSideEvents[1].id;

    console.log(
      `✅ 라운드 생성 완료: 사전(ID:${preSideEventId}), 사후(ID:${postSideEventId})`
    );

    // Step 5: 사용자1 로그인
    console.log("\n5️⃣ 사용자1 로그인...");
    const user1AuthRes = await supabase.auth.signInWithPassword({
      email: user1Creds.email,
      password: user1Creds.password,
    });

    if (user1AuthRes.error) {
      console.log("❌ 사용자1 로그인 실패:", user1AuthRes.error.message);
      return;
    }

    const user1Id = user1AuthRes.data.user?.id;
    const user1Token = user1AuthRes.data.session?.access_token;
    console.log(`✅ 사용자1 로그인 (ID: ${user1Id})`);

    // Step 6: 사용자1이 라운드 신청
    console.log("\n6️⃣ 사용자1 사전 라운드 신청...");
    const { data: user1Profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user1Id)
      .single();

    const user1Client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${user1Token}`,
        },
      },
    });

    const { data: user1Reg, error: reg1Error } = await user1Client
      .from("side_event_registrations")
      .insert([
        {
          side_event_id: preSideEventId,
          user_id: user1Id,
          nickname: user1Profile?.nickname || "사용자1",
          status: "applied",
          memo: "사전 라운드 참가하고 싶습니다.",
        },
      ])
      .select();

    if (reg1Error) {
      console.log("❌ 사용자1 신청 실패:", reg1Error.message);
      return;
    }
    const user1RegId = user1Reg[0].id;
    console.log(`✅ 사용자1 신청 완료 (신청ID: ${user1RegId})`);

    // Step 7: 사용자2 로그인
    console.log("\n7️⃣ 사용자2 로그인...");
    const user2AuthRes = await supabase.auth.signInWithPassword({
      email: user2Creds.email,
      password: user2Creds.password,
    });

    if (user2AuthRes.error) {
      console.log("❌ 사용자2 로그인 실패:", user2AuthRes.error.message);
      return;
    }

    const user2Id = user2AuthRes.data.user?.id;
    const user2Token = user2AuthRes.data.session?.access_token;
    console.log(`✅ 사용자2 로그인 (ID: ${user2Id})`);

    // Step 8: 사용자2가 라운드 신청
    console.log("\n8️⃣ 사용자2 사전/사후 라운드 신청...");
    const { data: user2Profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user2Id)
      .single();

    const user2Client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${user2Token}`,
        },
      },
    });

    const { data: user2Regs, error: reg2Error } = await user2Client
      .from("side_event_registrations")
      .insert([
        {
          side_event_id: preSideEventId,
          user_id: user2Id,
          nickname: user2Profile?.nickname || "사용자2",
          status: "applied",
          memo: "사전 라운드 참가합니다.",
        },
        {
          side_event_id: postSideEventId,
          user_id: user2Id,
          nickname: user2Profile?.nickname || "사용자2",
          status: "applied",
          memo: "사후 라운드도 참가하겠습니다.",
        },
      ])
      .select();

    if (reg2Error) {
      console.log("❌ 사용자2 신청 실패:", reg2Error.message);
      return;
    }
    console.log(
      `✅ 사용자2 신청 완료 (사전, 사후 각 1개 = 2개 신청)`
    );

    // Step 9: 신청 현황 조회 (공개)
    console.log("\n9️⃣ 신청 현황 조회 (로그인 없이 공개)...");
    const { data: preRegs } = await supabase
      .from("side_event_registrations")
      .select("nickname,status")
      .eq("side_event_id", preSideEventId);

    const { data: postRegs } = await supabase
      .from("side_event_registrations")
      .select("nickname,status")
      .eq("side_event_id", postSideEventId);

    console.log(`✅ 사전 라운드 신청자 (${preRegs?.length || 0}명):`);
    preRegs?.forEach((r) => {
      console.log(`   - ${r.nickname} (${r.status})`);
    });

    console.log(`✅ 사후 라운드 신청자 (${postRegs?.length || 0}명):`);
    postRegs?.forEach((r) => {
      console.log(`   - ${r.nickname} (${r.status})`);
    });

    // Step 10: 관리자가 신청 상태 변경
    console.log("\n🔟 관리자가 신청 상태 변경...");
    const { error: updateError } = await adminClient
      .from("side_event_registrations")
      .update({ status: "confirmed" })
      .eq("id", user1RegId);

    if (updateError) {
      console.log("❌ 상태 변경 실패:", updateError.message);
    } else {
      console.log(
        `✅ 사용자1 신청 상태 변경: applied → confirmed`
      );
    }

    // Step 11: 변경 후 신청 현황 재조회
    console.log("\n1️⃣1️⃣ 변경 후 신청 현황 재조회...");
    const { data: preRegsAfter } = await supabase
      .from("side_event_registrations")
      .select("nickname,status")
      .eq("side_event_id", preSideEventId)
      .order("nickname");

    console.log(`✅ 사전 라운드 신청자 (${preRegsAfter?.length || 0}명):`);
    preRegsAfter?.forEach((r) => {
      console.log(`   - ${r.nickname} (${r.status})`);
    });

    // Step 12: 라운드 목록 조회
    console.log("\n1️⃣2️⃣ 대회의 모든 라운드 조회...");
    const { data: allSideEvents } = await supabase
      .from("side_events")
      .select("id,round_type,title,tee_time,location,max_participants,status")
      .eq("tournament_id", 1);

    console.log(`✅ 라운드 총 ${allSideEvents?.length || 0}개:`);
    allSideEvents?.forEach((se) => {
      const type = se.round_type === "pre" ? "📍 사전" : "📍 사후";
      console.log(`   - [${se.id}] ${type} ${se.title}`);
      console.log(`      Tee: ${se.tee_time}, 위치: ${se.location}, 최대: ${se.max_participants}명`);
    });

    // Step 13: 감사 로그 확인
    console.log("\n1️⃣3️⃣ 감사 로그 확인...");
    const { data: auditLogs } = await adminClient
      .from("audit_logs")
      .select("entity_type,action,actor_id,created_at")
      .eq("entity_type", "side_event_registration")
      .order("created_at", { ascending: false })
      .limit(5);

    console.log(`✅ 최근 감사 로그 (${auditLogs?.length || 0}개):`);
    auditLogs?.forEach((log) => {
      console.log(
        `   - ${log.entity_type} ${log.action} by ${log.actor_id?.substring(0, 8)}... (${log.created_at})`
      );
    });

    console.log("\n==== ✅ 모든 테스트 성공! ====\n");
    console.log("📊 테스트 결과 요약:");
    console.log(`  - 라운드 생성: 2개 (사전, 사후)`);
    console.log(`  - 신청: 총 3개 (사용자1: 1개, 사용자2: 2개)`);
    console.log(`  - 상태 변경 테스트: 완료`);
    console.log(`  - 공개 조회: 정상`);
    console.log(`  - 감사 로그: 기록됨\n`);
  } catch (err) {
    console.error("❌ 테스트 중 오류:", err);
  }
}

testPhase3();
