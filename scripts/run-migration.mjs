/**
 * Migration 실행 스크립트
 * 
 * Usage:
 *   node scripts/run-migration.mjs db/migrations/009_kakao_login_support.sql
 * 
 * 환경변수:
 *   - SUPABASE_SERVICE_ROLE_KEY 필요 (.env.local에서 자동 로드)
 */

import { readFile } from 'fs/promises';
import { resolve, basename } from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// .env.local 로드
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 환경변수 누락:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗');
  console.error('\n.env.local 파일을 확인해주세요.');
  process.exit(1);
}

// Supabase Admin 클라이언트 (서비스 롤 키 사용)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Migration SQL 파일 실행
 * @param {string} filePath - Migration 파일 경로
 */
async function runMigration(filePath) {
  try {
    console.log('\n========================================');
    console.log('🚀 Migration 실행 시작');
    console.log('========================================\n');

    // 파일 경로 확인
    const absolutePath = resolve(process.cwd(), filePath);
    console.log(`📄 파일: ${basename(absolutePath)}`);
    console.log(`📂 경로: ${absolutePath}\n`);

    // SQL 파일 읽기
    console.log('📖 SQL 파일 읽는 중...');
    const sqlContent = await readFile(absolutePath, 'utf-8');
    console.log(`✓ 파일 크기: ${(sqlContent.length / 1024).toFixed(2)} KB\n`);

    // SQL 실행
    console.log('⚙️  SQL 실행 중...\n');
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent,
    });

    if (error) {
      // RPC 함수가 없으면 직접 실행 시도
      if (error.message.includes('exec_sql') || error.code === '42883') {
        console.log('⚠️  exec_sql RPC 함수가 없습니다. 직접 실행을 시도합니다...\n');
        
        // SQL을 세미콜론으로 분리하여 순차 실행
        const statements = sqlContent
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 총 ${statements.length}개의 SQL 문 실행\n`);

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (!statement) continue;

          // DO 블록이나 CREATE FUNCTION은 그대로 실행
          const isBlock = statement.toUpperCase().startsWith('DO') || 
                         statement.toUpperCase().startsWith('CREATE OR REPLACE FUNCTION') ||
                         statement.toUpperCase().startsWith('CREATE FUNCTION');

          try {
            // Supabase의 Postgres REST API 사용
            const response = await fetch(
              `${supabaseUrl}/rest/v1/rpc/exec_raw_sql`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ query: statement + ';' }),
              }
            );

            if (!response.ok) {
              // REST API가 안 되면 pg_dump 스타일로 실행
              console.log(`   [${i + 1}/${statements.length}] 실행: ${statement.substring(0, 50)}...`);
              
              // 대안: supabase.from('_migrations').insert() 사용 불가
              // 직접 SQL 실행은 Supabase에서 제한됨
              console.log('   ⚠️  직접 SQL 실행 제한됨 - Supabase Dashboard에서 수동 실행 필요');
            }
          } catch (err) {
            console.error(`   ❌ [${i + 1}/${statements.length}] 실패:`, err.message);
          }
        }

        console.log('\n⚠️  자동 실행 제한 안내:');
        console.log('   Supabase는 보안상 서비스 롤 키로도 임의 SQL 실행을 제한합니다.');
        console.log('   다음 방법으로 Migration을 실행해주세요:\n');
        console.log('   1. Supabase Dashboard 접속');
        console.log('      → https://supabase.com/dashboard/project/[PROJECT_ID]/editor');
        console.log('   2. SQL Editor 열기');
        console.log(`   3. ${basename(absolutePath)} 파일 내용 복사/붙여넣기`);
        console.log('   4. "Run" 버튼 클릭\n');
        
        console.log('   또는 Supabase CLI 사용:');
        console.log(`   $ supabase db push --file ${filePath}\n`);

        process.exit(2); // 수동 실행 필요
      }

      throw error;
    }

    console.log('✅ Migration 실행 완료!\n');
    
    if (data) {
      console.log('📊 결과:', data);
    }

    console.log('\n========================================');
    console.log('✨ 완료!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n========================================');
    console.error('❌ Migration 실행 실패');
    console.error('========================================\n');
    console.error('에러:', error.message);
    
    if (error.details) {
      console.error('상세:', error.details);
    }
    
    if (error.hint) {
      console.error('힌트:', error.hint);
    }

    console.error('\n다음 방법으로 해결하세요:');
    console.error('1. Supabase Dashboard → SQL Editor에서 수동 실행');
    console.error('2. SQL 문법 오류 확인');
    console.error('3. 권한 문제 확인\n');

    process.exit(1);
  }
}

// 실행
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('\n❌ Migration 파일 경로를 지정해주세요.\n');
  console.error('사용법:');
  console.error('  node scripts/run-migration.mjs db/migrations/009_kakao_login_support.sql\n');
  process.exit(1);
}

runMigration(migrationFile);
