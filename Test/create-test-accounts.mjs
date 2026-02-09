import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://iipxdzaqstsnbhwuspfl.supabase.co";
const supabaseAnonKey = "sb_publishable_w2l9LnyLWFgqXvjnRSbn2g_YyhuOOO4";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestAccounts() {
  console.log("\n==== 테스트 계정 생성 ====\n");

  const testAccounts = [
    {
      email: "admin@test.com",
      password: "TestAdmin123!",
      nickname: "관리자1",
      role: "admin",
    },
    {
      email: "user1@test.com",
      password: "TestUser123!",
      nickname: "사용자1",
      role: "user",
    },
    {
      email: "user2@test.com",
      password: "TestUser123!",
      nickname: "사용자2",
      role: "user",
    },
  ];

  const results = [];

  for (const account of testAccounts) {
    try {
      console.log(`⏳ ${account.role === "admin" ? "👨‍💼" : "👤"} ${account.nickname} 계정 생성 중...`);

      const { data, error } = await supabase.auth.signUp({
        email: account.email,
        password: account.password,
        options: {
          data: {
            nickname: account.nickname,
            full_name: account.nickname,
          },
        },
      });

      if (error) {
        console.log(`❌ 실패: ${error.message}`);
        continue;
      }

      if (!data.user) {
        console.log(`❌ 사용자 생성 실패 (user가 null)`);
        continue;
      }

      const userId = data.user.id;
      console.log(
        `✅ 생성 완료 (User ID: ${userId})`
      );

      results.push({
        email: account.email,
        password: account.password,
        nickname: account.nickname,
        userId,
        role: account.role,
      });
    } catch (err) {
      console.log(`❌ 오류: ${err.message}`);
    }
  }

  console.log("\n==== 테스트 계정 목록 ====\n");
  results.forEach((account, idx) => {
    const roleEmoji = account.role === "admin" ? "👨‍💼" : "👤";
    console.log(`${idx + 1}. ${roleEmoji} ${account.nickname}`);
    console.log(`   이메일: ${account.email}`);
    console.log(`   비밀번호: ${account.password}`);
    console.log(`   User ID: ${account.userId}`);
    console.log(`   권한: ${account.role === "admin" ? "관리자" : "일반 사용자"}`);
    console.log();
  });

  // 관리자 계정 찾기
  const adminAccount = results.find((a) => a.role === "admin");
  if (adminAccount) {
    console.log("==== 🚨 [수동-Supabase] 다음 SQL을 실행하세요 ====\n");
    console.log(`UPDATE profiles SET is_admin = true WHERE id = '${adminAccount.userId}';\n`);
    console.log(
      "설정 방법: Supabase 대시보드 → SQL Editor → 위 쿼리 복붙 → Run\n"
    );

    // 설정 확인
    console.log("⏳ 5초 대기 후 관리자 권한 자동 설정 확인...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", adminAccount.userId)
      .single();

    if (profile?.is_admin) {
      console.log("✅ 관리자 권한 이미 설정됨!");
    } else {
      console.log("⚠️  관리자 권한이 아직 미설정 상태입니다.");
      console.log("   Supabase에서 위 SQL을 실행한 후 다시 확인하세요.\n");
    }
  }

  console.log("==== ✅ 테스트 계정 생성 완료 ====\n");
  return results;
}

createTestAccounts().catch(console.error);
