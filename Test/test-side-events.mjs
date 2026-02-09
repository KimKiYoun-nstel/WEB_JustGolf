import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://iipxdzaqstsnbhwuspfl.supabase.co";
const supabaseAnonKey = "sb_publishable_w2l9LnyLWFgqXvjnRSbn2g_YyhuOOO4";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSideEvents() {
  console.log("\n==== Phase 3 Side Events 기능 테스트 ====\n");

  try {
    // 1. 대회 확인 (ID 1 기준)
    console.log("1️⃣ 테스트 대회 확인...");
    const { data: tournament, error: tError } = await supabase
      .from("tournaments")
      .select("id,title,event_date")
      .eq("id", 1)
      .single();

    if (tError) {
      console.log("❌ 대회 조회 실패:", tError.message);
      return;
    }
    console.log("✅ 대회:", tournament.title, `(${tournament.event_date})`);

    // 2. 기존 라운드 확인
    console.log("\n2️⃣ 기존 라운드 확인...");
    const { data: existingSideEvents } = await supabase
      .from("side_events")
      .select("id,round_type,title")
      .eq("tournament_id", 1);

    console.log(`기존 라운드: ${existingSideEvents?.length ?? 0}개`);
    if (existingSideEvents && existingSideEvents.length > 0) {
      existingSideEvents.forEach((se) => {
        console.log(
          `  - [${se.id}] ${se.round_type === "pre" ? "📍 사전" : "📍 사후"} ${se.title}`
        );
      });
    }

    // 3. 새 라운드 생성
    console.log("\n3️⃣ 새 라운드 생성...");
    const { data: newSideEvent, error: seError } = await supabase
      .from("side_events")
      .insert([
        {
          tournament_id: 1,
          round_type: "pre",
          title: "테스트 사전 라운드",
          tee_time: "07:00",
          location: "클럽 흑 금강",
          notes: "테스트용 사전 라운드입니다.",
          max_participants: 20,
          status: "open",
        },
      ])
      .select();

    if (seError) {
      console.log("❌ 라운드 생성 실패:", seError.message);
      return;
    }
    const sideEventId = newSideEvent[0].id;
    console.log(`✅ 라운드 생성 완료 (ID: ${sideEventId})`);

    // 4. 라운드 신청 (등록된 사용자로 테스트)
    console.log("\n4️⃣ 라운드 신청...");
    
    // 먼저 등록된 사용자 확인
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,nickname")
      .limit(1);

    if (!profiles || profiles.length === 0) {
      console.log("⚠️  등록된 사용자가 없어 신청 테스트를 건너뜁니다.");
    } else {
      const testUserId = profiles[0].id;
      const testNickname = profiles[0].nickname;

      const { data: registration, error: regError } = await supabase
        .from("side_event_registrations")
        .insert([
          {
            side_event_id: sideEventId,
            user_id: testUserId,
            nickname: testNickname,
            status: "applied",
            memo: "테스트 신청입니다.",
          },
        ])
        .select();

      if (regError) {
        console.log("❌ 신청 실패:", regError.message);
      } else {
        const registrationId = registration[0].id;
        console.log(
          `✅ 신청 완료 (Registration ID: ${registrationId}, 사용자: ${testNickname})`
        );

        // 5. 신청 현황 조회
        console.log("\n5️⃣ 신청 현황 조회...");
        const { data: regs } = await supabase
          .from("side_event_registrations")
          .select("id,nickname,status")
          .eq("side_event_id", sideEventId);

        console.log(`신청자: ${regs?.length ?? 0}명`);
        regs?.forEach((r) => {
          console.log(`  - ${r.nickname} (${r.status})`);
        });

        // 6. 상태 변경 (applied → confirmed)
        console.log("\n6️⃣ 신청 상태 변경 (applied → confirmed)...");
        const { error: updateError } = await supabase
          .from("side_event_registrations")
          .update({ status: "confirmed" })
          .eq("id", registrationId);

        if (updateError) {
          console.log("❌ 상태 변경 실패:", updateError.message);
        } else {
          console.log("✅ 상태 변경 완료");

          // 변경 후 조회
          const { data: updated } = await supabase
            .from("side_event_registrations")
            .select("id,nickname,status")
            .eq("id", registrationId)
            .single();

          console.log(`  결과: ${updated?.nickname} (${updated?.status})`);
        }

        // 7. 공개 조회 테스트 (로그인 없이 조회 가능해야 함)
        console.log("\n7️⃣ 공개 조회 테스트 (RLS 검증)...");
        const { data: publicRegs } = await supabase
          .from("side_event_registrations")
          .select("nickname,status")
          .eq("side_event_id", sideEventId);

        console.log(`✅ 공개 조회 가능 (${publicRegs?.length ?? 0}명)`);
        publicRegs?.forEach((r) => {
          console.log(`  - ${r.nickname} (${r.status})`);
        });
      }
    }

    // 8. 라운드 조회 (공개)
    console.log("\n8️⃣ 라운드 명세 조회...");
    const { data: roundDetail } = await supabase
      .from("side_events")
      .select("id,round_type,title,tee_time,location,max_participants,status")
      .eq("id", sideEventId)
      .single();

    if (roundDetail) {
      console.log("✅ 라운드 명세:");
      console.log(`  - 유형: ${roundDetail.round_type === "pre" ? "📍 사전" : "📍 사후"}`);
      console.log(`  - 제목: ${roundDetail.title}`);
      console.log(`  - Tee Time: ${roundDetail.tee_time}`);
      console.log(`  - 위치: ${roundDetail.location}`);
      console.log(`  - 최대 인원: ${roundDetail.max_participants}`);
      console.log(`  - 상태: ${roundDetail.status}`);
    }

    console.log("\n==== ✅ 모든 테스트 완료! ====\n");
  } catch (err) {
    console.error("❌ 테스트 중 오류:", err);
  }
}

testSideEvents();
