-- 단체 스코어 적재 SQL (2026-03-21)
-- 사용법:
--   1) 아래 v_tournament_id 값을 실제 대상 대회 ID로 변경
--   2) Supabase SQL Editor에서 실행
-- 참고:
--   - 동일 대회의 section='단체 스코어' 기존 행은 삭제 후 재적재됩니다.
--   - summary_text는 null로 두어 API fallback(summary.txt)이 동작하도록 했습니다.

DO $$
DECLARE
  v_tournament_id bigint := 0; -- TODO: 실제 대회 ID로 변경
BEGIN
  IF v_tournament_id <= 0 THEN
    RAISE EXCEPTION 'v_tournament_id 값을 실제 대회 ID로 변경해주세요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tournaments t WHERE t.id = v_tournament_id
  ) THEN
    RAISE EXCEPTION '대회 ID(%)를 찾을 수 없습니다.', v_tournament_id;
  END IF;

  DELETE FROM public.tournament_result_rows
  WHERE tournament_id = v_tournament_id
    AND section = '단체 스코어';

  INSERT INTO public.tournament_result_rows (
    tournament_id,
    section,
    row_order,
    display_name,
    score_label,
    score_value,
    note,
    payload,
    created_by
  )
  VALUES
    (v_tournament_id, '단체 스코어', 1, '이동수', '합계', '74', '순위 1위 · OUT 38 / IN 36 · NET 74', '{"rank":1,"tee_time":"13:30","course":"비토","out_total":38,"in_total":36,"gross_total":74,"net":74,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 2, '주창연', '합계', '78', '순위 2위 · OUT 39 / IN 39 · NET 78', '{"rank":2,"tee_time":"13:23","course":"비토","out_total":39,"in_total":39,"gross_total":78,"net":78,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 3, '박영규', '합계', '79', '순위 3위 · OUT 40 / IN 39 · NET 79', '{"rank":3,"tee_time":"13:30","course":"비토","out_total":40,"in_total":39,"gross_total":79,"net":79,"award":null,"near":1.1,"long":270.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 4, '박소영', '합계', '80', '순위 4위 · OUT 39 / IN 41 · NET 80', '{"rank":4,"tee_time":"13:16","course":"비룡","out_total":39,"in_total":41,"gross_total":80,"net":80,"award":null,"near":1.7,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 5, '박순철', '합계', '81', '순위 5위 · OUT 43 / IN 38 · NET 81', '{"rank":5,"tee_time":"13:30","course":"비토","out_total":43,"in_total":38,"gross_total":81,"net":81,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 6, '김태영', '합계', '82', '순위 6위 · OUT 40 / IN 42 · NET 82', '{"rank":6,"tee_time":"13:16","course":"다솔","out_total":40,"in_total":42,"gross_total":82,"net":82,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 7, '최영준', '합계', '82', '순위 7위 · OUT 40 / IN 42 · NET 82', '{"rank":7,"tee_time":"13:16","course":"비룡","out_total":40,"in_total":42,"gross_total":82,"net":82,"award":null,"near":0.0,"long":227.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 8, '이용식', '합계', '83', '순위 8위 · OUT 43 / IN 40 · NET 83', '{"rank":8,"tee_time":"13:30","course":"비토","out_total":43,"in_total":40,"gross_total":83,"net":83,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 9, '이경미', '합계', '83', '순위 9위 · OUT 43 / IN 40 · NET 83', '{"rank":9,"tee_time":"13:23","course":"비토","out_total":43,"in_total":40,"gross_total":83,"net":83,"award":null,"near":1.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 10, '안성진', '합계', '83', '순위 10위 · OUT 42 / IN 41 · NET 83', '{"rank":10,"tee_time":"13:16","course":"다솔","out_total":42,"in_total":41,"gross_total":83,"net":83,"award":null,"near":200.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 11, '장용훈', '합계', '84', '순위 11위 · OUT 42 / IN 42 · NET 84', '{"rank":11,"tee_time":"13:37","course":"비룡","out_total":42,"in_total":42,"gross_total":84,"net":84,"award":null,"near":0.0,"long":230.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 12, '김준호', '합계', '84', '순위 12위 · OUT 42 / IN 42 · NET 84', '{"rank":12,"tee_time":"13:23","course":"비룡","out_total":42,"in_total":42,"gross_total":84,"net":84,"award":null,"near":0.0,"long":243.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 13, '전용균', '합계', '84', '순위 13위 · OUT 41 / IN 43 · NET 84', '{"rank":13,"tee_time":"13:30","course":"다솔","out_total":41,"in_total":43,"gross_total":84,"net":84,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 14, '이호명', '합계', '86', '순위 14위 · OUT 46 / IN 40 · NET 86', '{"rank":14,"tee_time":"13:30","course":"다솔","out_total":46,"in_total":40,"gross_total":86,"net":86,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 15, '안경식', '합계', '86', '순위 15위 · OUT 45 / IN 41 · NET 86', '{"rank":15,"tee_time":"13:23","course":"비룡","out_total":45,"in_total":41,"gross_total":86,"net":86,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 16, '류기천', '합계', '86', '순위 16위 · OUT 44 / IN 42 · NET 86', '{"rank":16,"tee_time":"13:30","course":"비룡","out_total":44,"in_total":42,"gross_total":86,"net":86,"award":null,"near":0.0,"long":230.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 17, '박윤일', '합계', '86', '순위 17위 · OUT 41 / IN 45 · NET 86', '{"rank":17,"tee_time":"13:37","course":"다솔","out_total":41,"in_total":45,"gross_total":86,"net":86,"award":null,"near":0.0,"long":230.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 18, '이지연', '합계', '86', '순위 18위 · OUT 40 / IN 46 · NET 86', '{"rank":18,"tee_time":"13:16","course":"비토","out_total":40,"in_total":46,"gross_total":86,"net":86,"award":null,"near":0.0,"long":170.0,"source":"단체 스코어.pdf p1"}'::jsonb, null),

    (v_tournament_id, '단체 스코어', 19, '장병철', '합계', '87', '순위 19위 · OUT 43 / IN 44 · NET 87', '{"rank":19,"tee_time":"13:37","course":"비룡","out_total":43,"in_total":44,"gross_total":87,"net":87,"award":null,"near":4.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 20, '김지웅', '합계', '87', '순위 20위 · OUT 43 / IN 44 · NET 87', '{"rank":20,"tee_time":"13:30","course":"다솔","out_total":43,"in_total":44,"gross_total":87,"net":87,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 21, '정연봉', '합계', '88', '순위 21위 · OUT 48 / IN 40 · NET 88', '{"rank":21,"tee_time":"13:37","course":"다솔","out_total":48,"in_total":40,"gross_total":88,"net":88,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 22, '김현욱', '합계', '88', '순위 22위 · OUT 43 / IN 45 · NET 88', '{"rank":22,"tee_time":"13:23","course":"비토","out_total":43,"in_total":45,"gross_total":88,"net":88,"award":"롱기","near":0.0,"long":300.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 23, '민혜경', '합계', '89', '순위 23위 · OUT 46 / IN 43 · NET 89', '{"rank":23,"tee_time":"13:37","course":"다솔","out_total":46,"in_total":43,"gross_total":89,"net":89,"award":null,"near":3.0,"long":180.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 24, '박선화', '합계', '89', '순위 24위 · OUT 46 / IN 43 · NET 89', '{"rank":24,"tee_time":"13:23","course":"비룡","out_total":46,"in_total":43,"gross_total":89,"net":89,"award":null,"near":7.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 25, '정완진', '합계', '89', '순위 25위 · OUT 44 / IN 45 · NET 89', '{"rank":25,"tee_time":"13:30","course":"다솔","out_total":44,"in_total":45,"gross_total":89,"net":89,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 26, '전홍범', '합계', '89', '순위 26위 · OUT 43 / IN 46 · NET 89', '{"rank":26,"tee_time":"13:30","course":"비룡","out_total":43,"in_total":46,"gross_total":89,"net":89,"award":null,"near":2.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 27, '최정우', '합계', '89', '순위 27위 · OUT 43 / IN 46 · NET 89', '{"rank":27,"tee_time":"13:23","course":"비토","out_total":43,"in_total":46,"gross_total":89,"net":89,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 28, '김소영', '합계', '89', '순위 28위 · OUT 43 / IN 46 · NET 89', '{"rank":28,"tee_time":"13:16","course":"비룡","out_total":43,"in_total":46,"gross_total":89,"net":89,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 29, '조경노', '합계', '90', '순위 29위 · OUT 46 / IN 44 · NET 90', '{"rank":29,"tee_time":"13:23","course":"다솔","out_total":46,"in_total":44,"gross_total":90,"net":90,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 30, '이경희', '합계', '91', '순위 30위 · OUT 45 / IN 46 · NET 91', '{"rank":30,"tee_time":"13:16","course":"비룡","out_total":45,"in_total":46,"gross_total":91,"net":91,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 31, '차세훈', '합계', '92', '순위 31위 · OUT 50 / IN 42 · NET 92', '{"rank":31,"tee_time":"13:23","course":"비룡","out_total":50,"in_total":42,"gross_total":92,"net":92,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 32, '이창훈', '합계', '93', '순위 32위 · OUT 45 / IN 48 · NET 93', '{"rank":32,"tee_time":"13:16","course":"다솔","out_total":45,"in_total":48,"gross_total":93,"net":93,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 33, '정종현', '합계', '94', '순위 33위 · OUT 47 / IN 47 · NET 94', '{"rank":33,"tee_time":"13:23","course":"다솔","out_total":47,"in_total":47,"gross_total":94,"net":94,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 34, '김상범', '합계', '94', '순위 34위 · OUT 46 / IN 48 · NET 94', '{"rank":34,"tee_time":"13:16","course":"비토","out_total":46,"in_total":48,"gross_total":94,"net":94,"award":null,"near":3.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 35, '이윤주', '합계', '95', '순위 35위 · OUT 49 / IN 46 · NET 95', '{"rank":35,"tee_time":"13:37","course":"비토","out_total":49,"in_total":46,"gross_total":95,"net":95,"award":null,"near":2.0,"long":180.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 36, '나영민', '합계', '95', '순위 36위 · OUT 49 / IN 46 · NET 95', '{"rank":36,"tee_time":"13:23","course":"다솔","out_total":49,"in_total":46,"gross_total":95,"net":95,"award":null,"near":10.0,"long":200.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 37, '임수현', '합계', '95', '순위 37위 · OUT 48 / IN 47 · NET 95', '{"rank":37,"tee_time":"13:37","course":"다솔","out_total":48,"in_total":47,"gross_total":95,"net":95,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 38, '이현찬', '합계', '95', '순위 38위 · OUT 47 / IN 48 · NET 95', '{"rank":38,"tee_time":"13:23","course":"다솔","out_total":47,"in_total":48,"gross_total":95,"net":95,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p2"}'::jsonb, null),

    (v_tournament_id, '단체 스코어', 39, '신기현', '합계', '95', '순위 39위 · OUT 46 / IN 49 · NET 95', '{"rank":39,"tee_time":"13:16","course":"다솔","out_total":46,"in_total":49,"gross_total":95,"net":95,"award":"니어","near":0.8,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 40, '이도훈', '합계', '96', '순위 40위 · OUT 51 / IN 45 · NET 96', '{"rank":40,"tee_time":"13:16","course":"비토","out_total":51,"in_total":45,"gross_total":96,"net":96,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 41, '이제빈', '합계', '97', '순위 41위 · OUT 51 / IN 46 · NET 97', '{"rank":41,"tee_time":"13:37","course":"비토","out_total":51,"in_total":46,"gross_total":97,"net":97,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 42, '김형권', '합계', '97', '순위 42위 · OUT 48 / IN 49 · NET 97', '{"rank":42,"tee_time":"13:30","course":"비룡","out_total":48,"in_total":49,"gross_total":97,"net":97,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 43, '문성욱', '합계', '98', '순위 43위 · OUT 51 / IN 47 · NET 98', '{"rank":43,"tee_time":"13:37","course":"비토","out_total":51,"in_total":47,"gross_total":98,"net":98,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 44, '이주희', '합계', '98', '순위 44위 · OUT 51 / IN 47 · NET 98', '{"rank":44,"tee_time":"13:16","course":"비토","out_total":51,"in_total":47,"gross_total":98,"net":98,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 45, '김기연', '합계', '98', '순위 45위 · OUT 47 / IN 51 · NET 98', '{"rank":45,"tee_time":"13:37","course":"비룡","out_total":47,"in_total":51,"gross_total":98,"net":98,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 46, '차현욱', '합계', '99', '순위 46위 · OUT 53 / IN 46 · NET 99', '{"rank":46,"tee_time":"13:37","course":"비토","out_total":53,"in_total":46,"gross_total":99,"net":99,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 47, '백경기', '합계', '102', '순위 47위 · OUT 52 / IN 50 · NET 102', '{"rank":47,"tee_time":"13:30","course":"비룡","out_total":52,"in_total":50,"gross_total":102,"net":102,"award":null,"near":0.0,"long":0.0,"source":"단체 스코어.pdf p3"}'::jsonb, null),
    (v_tournament_id, '단체 스코어', 48, '김정미', '합계', '107', '순위 48위 · OUT 51 / IN 56 · NET 107', '{"rank":48,"tee_time":"13:37","course":"비룡","out_total":51,"in_total":56,"gross_total":107,"net":107,"award":null,"near":0.0,"long":160.0,"source":"단체 스코어.pdf p3"}'::jsonb, null);

  INSERT INTO public.tournament_result_assets (
    tournament_id,
    summary_title,
    summary_text,
    pdf_url,
    created_by,
    updated_at
  )
  VALUES (
    v_tournament_id,
    '단체 스코어 (2026-03-21)',
    null,
    '/api/tournaments/' || v_tournament_id || '/results/pdf',
    null,
    now()
  )
  ON CONFLICT (tournament_id)
  DO UPDATE SET
    summary_title = EXCLUDED.summary_title,
    summary_text = EXCLUDED.summary_text,
    pdf_url = EXCLUDED.pdf_url,
    updated_at = now();

  RAISE NOTICE '단체 스코어 적재 완료: tournament_id=%', v_tournament_id;
END $$;
