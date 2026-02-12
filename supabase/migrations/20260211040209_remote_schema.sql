


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."audit_registration_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.approval_status IS DISTINCT FROM OLD.approval_status OR NEW.approved_by IS DISTINCT FROM OLD.approved_by) THEN
    INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, before, after)
    VALUES (
      'registrations',
      NEW.id,
      'approval_change',
      COALESCE(auth.uid(), NEW.approved_by),
      jsonb_build_object('approval_status', OLD.approval_status),
      jsonb_build_object('approval_status', NEW.approval_status, 'approved_by', NEW.approved_by)
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_registration_approval"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_side_events"("p_user_id" "uuid", "p_tournament_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  -- 관리자이면 항상 true
  IF (SELECT is_admin FROM profiles WHERE id = p_user_id) THEN
    RETURN TRUE;
  END IF;
  
  -- 해당 토너먼트의 라운드 관리 권한이 있는지 확인
  RETURN EXISTS (
    SELECT 1
    FROM manager_permissions
    WHERE user_id = p_user_id
      AND tournament_id = p_tournament_id
      AND can_manage_side_events = TRUE
      AND revoked_at IS NULL
  );
END;
$$;


ALTER FUNCTION "public"."can_manage_side_events"("p_user_id" "uuid", "p_tournament_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_approval_status_summary"("p_tournament_id" bigint) RETURNS TABLE("pending_count" bigint, "approved_count" bigint, "rejected_count" bigint, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE approval_status = 'pending')::BIGINT,
    COUNT(*) FILTER (WHERE approval_status = 'approved')::BIGINT,
    COUNT(*) FILTER (WHERE approval_status = 'rejected')::BIGINT,
    COUNT(*)::BIGINT
  FROM registrations
  WHERE tournament_id = p_tournament_id;
END;
$$;


ALTER FUNCTION "public"."get_approval_status_summary"("p_tournament_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_carpool_public"("p_tournament_id" bigint) RETURNS TABLE("registration_id" bigint, "nickname" "text", "carpool_available" boolean, "carpool_seats" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    r.id as registration_id,
    r.nickname,
    e.carpool_available,
    e.carpool_seats
  from public.registrations r
  join public.registration_extras e on e.registration_id = r.id
  where r.tournament_id = p_tournament_id
    and r.status <> 'canceled'
    and e.carpool_available = true;
$$;


ALTER FUNCTION "public"."get_carpool_public"("p_tournament_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_approvals_count"("p_tournament_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM registrations
    WHERE tournament_id = p_tournament_id 
      AND approval_status = 'pending'
  );
END;
$$;


ALTER FUNCTION "public"."get_pending_approvals_count"("p_tournament_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, full_name, email, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', '익명'),
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.is_admin = true
  );
$$;


ALTER FUNCTION "public"."is_admin"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_secure"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.is_admin = true
  );
$$;


ALTER FUNCTION "public"."is_admin_secure"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_approved_user"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.is_approved = true
  );
$$;


ALTER FUNCTION "public"."is_approved_user"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_registration_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_logs(entity_type, entity_id, action, actor_id, before, after)
    values ('registration', new.id, 'insert', auth.uid(), null, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_logs(entity_type, entity_id, action, actor_id, before, after)
    values ('registration', new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs(entity_type, entity_id, action, actor_id, before, after)
    values ('registration', old.id, 'delete', auth.uid(), to_jsonb(old), null);
    return old;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."log_registration_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_side_event_registration_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if (tg_op = 'INSERT') then
    insert into public.audit_logs(entity_type, entity_id, action, actor_id, before, after)
    values ('side_event_registration', new.id, 'insert', auth.uid(), null, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_logs(entity_type, entity_id, action, actor_id, before, after)
    values ('side_event_registration', new.id, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    insert into public.audit_logs(entity_type, entity_id, action, actor_id, before, after)
    values ('side_event_registration', old.id, 'delete', auth.uid(), to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."log_side_event_registration_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_feedbacks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_feedbacks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tournament_prize_supports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tournament_prize_supports_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" bigint NOT NULL,
    "action" "text" NOT NULL,
    "actor_id" "uuid",
    "before" "jsonb",
    "after" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


ALTER TABLE "public"."audit_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."feedbacks" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nickname" "text"
);


ALTER TABLE "public"."feedbacks" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedbacks" IS '사용자 피드백 게시판';



COMMENT ON COLUMN "public"."feedbacks"."title" IS '피드백 제목';



COMMENT ON COLUMN "public"."feedbacks"."content" IS '피드백 내용';



COMMENT ON COLUMN "public"."feedbacks"."category" IS '카테고리: bug(버그), feature(기능요청), general(일반)';



COMMENT ON COLUMN "public"."feedbacks"."status" IS '처리상태: pending(대기), in_progress(진행중), completed(완료)';



CREATE SEQUENCE IF NOT EXISTS "public"."feedbacks_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."feedbacks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."feedbacks_id_seq" OWNED BY "public"."feedbacks"."id";



CREATE TABLE IF NOT EXISTS "public"."manager_permissions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tournament_id" bigint NOT NULL,
    "can_manage_side_events" boolean DEFAULT false,
    "granted_at" timestamp without time zone DEFAULT "now"(),
    "granted_by" "uuid" NOT NULL,
    "revoked_at" timestamp without time zone,
    "revoked_by" "uuid"
);


ALTER TABLE "public"."manager_permissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."manager_permissions" IS '라운드 관리자 권한 관리';



COMMENT ON COLUMN "public"."manager_permissions"."can_manage_side_events" IS '라운드(사전/사후 라운드) 관리 권한';



COMMENT ON COLUMN "public"."manager_permissions"."revoked_at" IS '권한 취소 시간 (NULL=활성)';



CREATE SEQUENCE IF NOT EXISTS "public"."manager_permissions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."manager_permissions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."manager_permissions_id_seq" OWNED BY "public"."manager_permissions"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "nickname" "text" NOT NULL,
    "full_name" "text",
    "is_admin" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_approved" boolean DEFAULT false NOT NULL,
    "email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."email" IS '사용자 이메일 (auth.users에서 동기화)';



CREATE TABLE IF NOT EXISTS "public"."registration_activity_selections" (
    "id" bigint NOT NULL,
    "registration_id" bigint NOT NULL,
    "extra_id" bigint NOT NULL,
    "selected" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."registration_activity_selections" OWNER TO "postgres";


COMMENT ON TABLE "public"."registration_activity_selections" IS '참가자가 선택한 활동들';



COMMENT ON COLUMN "public"."registration_activity_selections"."selected" IS '선택 여부 (true=선택, false=비선택)';



CREATE SEQUENCE IF NOT EXISTS "public"."registration_activity_selections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."registration_activity_selections_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."registration_activity_selections_id_seq" OWNED BY "public"."registration_activity_selections"."id";



CREATE TABLE IF NOT EXISTS "public"."registration_extras" (
    "id" bigint NOT NULL,
    "registration_id" bigint NOT NULL,
    "carpool_available" boolean DEFAULT false,
    "carpool_seats" integer,
    "transportation" "text",
    "departure_location" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."registration_extras" OWNER TO "postgres";


COMMENT ON COLUMN "public"."registration_extras"."carpool_available" IS '카풀 제공 여부: null=미정, true=제공, false=불제공';



ALTER TABLE "public"."registration_extras" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."registration_extras_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."registrations" (
    "id" bigint NOT NULL,
    "tournament_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nickname" "text" NOT NULL,
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meal_option_id" bigint,
    "approval_status" character varying(20) DEFAULT 'approved'::character varying,
    "approved_at" timestamp without time zone DEFAULT "now"(),
    "approved_by" "uuid",
    "relation" "text",
    CONSTRAINT "registrations_approval_status_check" CHECK ((("approval_status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "registrations_status_check" CHECK (("status" = ANY (ARRAY['applied'::"text", 'waitlisted'::"text", 'approved'::"text", 'canceled'::"text", 'undecided'::"text"])))
);


ALTER TABLE "public"."registrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."registrations"."status" IS '신청 상태: applied(신청), undecided(미정), waitlisted(대기), approved(승인), canceled(취소)';



COMMENT ON COLUMN "public"."registrations"."approval_status" IS '가입 승인 상태: pending(대기), approved(승인), rejected(거절)';



COMMENT ON COLUMN "public"."registrations"."approved_at" IS '승인/거절 처리 시간';



COMMENT ON COLUMN "public"."registrations"."approved_by" IS '가입 승인 처리 관리자 UID';



COMMENT ON COLUMN "public"."registrations"."relation" IS '참가자와 신청자의 관계 (예: 본인, 가족, 지인)';



ALTER TABLE "public"."registrations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."registrations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."side_event_registrations" (
    "id" bigint NOT NULL,
    "side_event_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "nickname" "text" NOT NULL,
    "status" "text" DEFAULT 'applied'::"text" NOT NULL,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meal_selected" boolean DEFAULT false,
    "lodging_selected" boolean DEFAULT false,
    CONSTRAINT "side_event_registrations_status_check" CHECK (("status" = ANY (ARRAY['applied'::"text", 'confirmed'::"text", 'waitlisted'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."side_event_registrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."side_event_registrations"."meal_selected" IS '라운드 식사 참여 여부';



COMMENT ON COLUMN "public"."side_event_registrations"."lodging_selected" IS '라운드 숙박 참여 여부';



ALTER TABLE "public"."side_event_registrations" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."side_event_registrations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."side_events" (
    "id" bigint NOT NULL,
    "tournament_id" bigint NOT NULL,
    "round_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "tee_time" "text",
    "location" "text",
    "notes" "text",
    "open_at" timestamp with time zone,
    "close_at" timestamp with time zone,
    "max_participants" integer,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "meal_option_id" bigint,
    "lodging_available" boolean DEFAULT false,
    "lodging_required" boolean DEFAULT false,
    CONSTRAINT "side_events_round_type_check" CHECK (("round_type" = ANY (ARRAY['pre'::"text", 'post'::"text"]))),
    CONSTRAINT "side_events_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'closed'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."side_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."side_events"."meal_option_id" IS '라운드에 포함된 식사 옵션';



COMMENT ON COLUMN "public"."side_events"."lodging_available" IS '숙박 옵션 제공 여부';



COMMENT ON COLUMN "public"."side_events"."lodging_required" IS '숙박 필수 여부';



ALTER TABLE "public"."side_events" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."side_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tournament_extras" (
    "id" bigint NOT NULL,
    "tournament_id" bigint NOT NULL,
    "activity_name" character varying(100) NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."tournament_extras" OWNER TO "postgres";


COMMENT ON TABLE "public"."tournament_extras" IS '토너먼트별 추가 활동 (식사, 와인바우 등)';



COMMENT ON COLUMN "public"."tournament_extras"."activity_name" IS '활동명';



COMMENT ON COLUMN "public"."tournament_extras"."display_order" IS '화면 표시 순서';



CREATE SEQUENCE IF NOT EXISTS "public"."tournament_extras_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tournament_extras_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tournament_extras_id_seq" OWNED BY "public"."tournament_extras"."id";



CREATE TABLE IF NOT EXISTS "public"."tournament_files" (
    "id" bigint NOT NULL,
    "tournament_id" bigint NOT NULL,
    "file_type" "text" DEFAULT 'other'::"text" NOT NULL,
    "file_name" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "is_public" boolean DEFAULT true NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tournament_files_file_type_check" CHECK (("file_type" = ANY (ARRAY['groups'::"text", 'notice'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."tournament_files" OWNER TO "postgres";


ALTER TABLE "public"."tournament_files" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tournament_files_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tournament_group_members" (
    "id" bigint NOT NULL,
    "group_id" bigint NOT NULL,
    "registration_id" bigint NOT NULL,
    "position" integer NOT NULL,
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tournament_group_members_position_check" CHECK ((("position" >= 1) AND ("position" <= 4)))
);


ALTER TABLE "public"."tournament_group_members" OWNER TO "postgres";


ALTER TABLE "public"."tournament_group_members" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tournament_group_members_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tournament_groups" (
    "id" bigint NOT NULL,
    "tournament_id" bigint NOT NULL,
    "group_no" integer NOT NULL,
    "tee_time" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_groups" OWNER TO "postgres";


ALTER TABLE "public"."tournament_groups" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tournament_groups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tournament_meal_options" (
    "id" bigint NOT NULL,
    "tournament_id" bigint NOT NULL,
    "menu_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tournament_meal_options" OWNER TO "postgres";


ALTER TABLE "public"."tournament_meal_options" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tournament_meal_options_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tournament_prize_supports" (
    "id" integer NOT NULL,
    "tournament_id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_name" "text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "supporter_nickname" "text"
);


ALTER TABLE "public"."tournament_prize_supports" OWNER TO "postgres";


COMMENT ON TABLE "public"."tournament_prize_supports" IS '대회별 경품 지원 내역';



COMMENT ON COLUMN "public"."tournament_prize_supports"."item_name" IS '경품명';



COMMENT ON COLUMN "public"."tournament_prize_supports"."note" IS '비고 (선택)';



CREATE SEQUENCE IF NOT EXISTS "public"."tournament_prize_supports_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."tournament_prize_supports_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."tournament_prize_supports_id_seq" OWNED BY "public"."tournament_prize_supports"."id";



CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "course_name" "text",
    "location" "text",
    "event_date" "date" NOT NULL,
    "tee_time" "text",
    "notes" "text",
    "open_at" timestamp with time zone,
    "close_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tournaments_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'closed'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


ALTER TABLE "public"."tournaments" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tournaments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."feedbacks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."feedbacks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."manager_permissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."manager_permissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."registration_activity_selections" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."registration_activity_selections_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tournament_extras" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tournament_extras_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."tournament_prize_supports" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tournament_prize_supports_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_permissions"
    ADD CONSTRAINT "manager_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_activity_selections"
    ADD CONSTRAINT "registration_activity_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_extras"
    ADD CONSTRAINT "registration_extras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_extras"
    ADD CONSTRAINT "registration_extras_registration_id_key" UNIQUE ("registration_id");



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_tournament_id_user_id_key" UNIQUE ("tournament_id", "user_id");



ALTER TABLE ONLY "public"."side_event_registrations"
    ADD CONSTRAINT "side_event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."side_event_registrations"
    ADD CONSTRAINT "side_event_registrations_side_event_id_user_id_key" UNIQUE ("side_event_id", "user_id");



ALTER TABLE ONLY "public"."side_events"
    ADD CONSTRAINT "side_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_extras"
    ADD CONSTRAINT "tournament_extras_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_files"
    ADD CONSTRAINT "tournament_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_group_members"
    ADD CONSTRAINT "tournament_group_members_group_id_position_key" UNIQUE ("group_id", "position");



ALTER TABLE ONLY "public"."tournament_group_members"
    ADD CONSTRAINT "tournament_group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_group_members"
    ADD CONSTRAINT "tournament_group_members_registration_id_key" UNIQUE ("registration_id");



ALTER TABLE ONLY "public"."tournament_groups"
    ADD CONSTRAINT "tournament_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_groups"
    ADD CONSTRAINT "tournament_groups_tournament_id_group_no_key" UNIQUE ("tournament_id", "group_no");



ALTER TABLE ONLY "public"."tournament_meal_options"
    ADD CONSTRAINT "tournament_meal_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_prize_supports"
    ADD CONSTRAINT "tournament_prize_supports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_feedbacks_created" ON "public"."feedbacks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedbacks_status" ON "public"."feedbacks" USING "btree" ("status");



CREATE INDEX "idx_feedbacks_user" ON "public"."feedbacks" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_manager_perm_unique" ON "public"."manager_permissions" USING "btree" ("user_id", "tournament_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_manager_permissions_tournament_id" ON "public"."manager_permissions" USING "btree" ("tournament_id");



CREATE INDEX "idx_manager_permissions_user_id" ON "public"."manager_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_prize_supports_tournament" ON "public"."tournament_prize_supports" USING "btree" ("tournament_id");



CREATE INDEX "idx_prize_supports_user" ON "public"."tournament_prize_supports" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_email" ON "public"."profiles" USING "btree" ("email");



CREATE INDEX "idx_reg_activity_extra_id" ON "public"."registration_activity_selections" USING "btree" ("extra_id");



CREATE INDEX "idx_reg_activity_registration_id" ON "public"."registration_activity_selections" USING "btree" ("registration_id");



CREATE UNIQUE INDEX "idx_reg_activity_unique" ON "public"."registration_activity_selections" USING "btree" ("registration_id", "extra_id");



CREATE INDEX "idx_registration_extras_registration_id" ON "public"."registration_extras" USING "btree" ("registration_id");



CREATE INDEX "idx_registrations_meal_option_id" ON "public"."registrations" USING "btree" ("meal_option_id");



CREATE INDEX "idx_tournament_extras_display_order" ON "public"."tournament_extras" USING "btree" ("tournament_id", "display_order");



CREATE INDEX "idx_tournament_extras_tournament_id" ON "public"."tournament_extras" USING "btree" ("tournament_id");



CREATE UNIQUE INDEX "idx_tournament_extras_unique" ON "public"."tournament_extras" USING "btree" ("tournament_id", "activity_name") WHERE ("is_active" = true);



CREATE INDEX "idx_tournament_group_members_group_id" ON "public"."tournament_group_members" USING "btree" ("group_id");



CREATE INDEX "idx_tournament_group_members_registration_id" ON "public"."tournament_group_members" USING "btree" ("registration_id");



CREATE INDEX "idx_tournament_groups_published" ON "public"."tournament_groups" USING "btree" ("tournament_id", "is_published");



CREATE INDEX "idx_tournament_groups_tournament_id" ON "public"."tournament_groups" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournament_meal_options_active" ON "public"."tournament_meal_options" USING "btree" ("tournament_id", "is_active", "display_order");



CREATE INDEX "idx_tournament_meal_options_tournament_id" ON "public"."tournament_meal_options" USING "btree" ("tournament_id");



CREATE OR REPLACE TRIGGER "trg_audit_registration_approval" AFTER UPDATE ON "public"."registrations" FOR EACH ROW EXECUTE FUNCTION "public"."audit_registration_approval"();



CREATE OR REPLACE TRIGGER "trg_log_registration_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."registrations" FOR EACH ROW EXECUTE FUNCTION "public"."log_registration_changes"();



CREATE OR REPLACE TRIGGER "trg_log_side_event_registration_changes" AFTER INSERT OR DELETE OR UPDATE ON "public"."side_event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."log_side_event_registration_changes"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_registration_extras_updated_at" BEFORE UPDATE ON "public"."registration_extras" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_registrations_updated_at" BEFORE UPDATE ON "public"."registrations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_side_event_registrations_updated_at" BEFORE UPDATE ON "public"."side_event_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_side_events_updated_at" BEFORE UPDATE ON "public"."side_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tournament_group_members_updated_at" BEFORE UPDATE ON "public"."tournament_group_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tournament_groups_updated_at" BEFORE UPDATE ON "public"."tournament_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tournament_meal_options_updated_at" BEFORE UPDATE ON "public"."tournament_meal_options" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tournaments_updated_at" BEFORE UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_feedbacks_updated_at" BEFORE UPDATE ON "public"."feedbacks" FOR EACH ROW EXECUTE FUNCTION "public"."update_feedbacks_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_tournament_prize_supports_updated_at" BEFORE UPDATE ON "public"."tournament_prize_supports" FOR EACH ROW EXECUTE FUNCTION "public"."update_tournament_prize_supports_updated_at"();



CREATE OR REPLACE TRIGGER "update_activity_selections_timestamp" BEFORE UPDATE ON "public"."registration_activity_selections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_tournament_extras_timestamp" BEFORE UPDATE ON "public"."tournament_extras" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."feedbacks"
    ADD CONSTRAINT "feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_permissions"
    ADD CONSTRAINT "manager_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."manager_permissions"
    ADD CONSTRAINT "manager_permissions_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."manager_permissions"
    ADD CONSTRAINT "manager_permissions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_permissions"
    ADD CONSTRAINT "manager_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_activity_selections"
    ADD CONSTRAINT "registration_activity_selections_extra_id_fkey" FOREIGN KEY ("extra_id") REFERENCES "public"."tournament_extras"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_activity_selections"
    ADD CONSTRAINT "registration_activity_selections_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_extras"
    ADD CONSTRAINT "registration_extras_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_meal_option_id_fkey" FOREIGN KEY ("meal_option_id") REFERENCES "public"."tournament_meal_options"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registrations"
    ADD CONSTRAINT "registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."side_event_registrations"
    ADD CONSTRAINT "side_event_registrations_side_event_id_fkey" FOREIGN KEY ("side_event_id") REFERENCES "public"."side_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."side_event_registrations"
    ADD CONSTRAINT "side_event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."side_events"
    ADD CONSTRAINT "side_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."side_events"
    ADD CONSTRAINT "side_events_meal_option_id_fkey" FOREIGN KEY ("meal_option_id") REFERENCES "public"."tournament_meal_options"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."side_events"
    ADD CONSTRAINT "side_events_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_extras"
    ADD CONSTRAINT "tournament_extras_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_files"
    ADD CONSTRAINT "tournament_files_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_files"
    ADD CONSTRAINT "tournament_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tournament_group_members"
    ADD CONSTRAINT "tournament_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."tournament_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_group_members"
    ADD CONSTRAINT "tournament_group_members_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_groups"
    ADD CONSTRAINT "tournament_groups_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_meal_options"
    ADD CONSTRAINT "tournament_meal_options_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_prize_supports"
    ADD CONSTRAINT "tournament_prize_supports_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_prize_supports"
    ADD CONSTRAINT "tournament_prize_supports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admins can delete group members" ON "public"."tournament_group_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can delete groups" ON "public"."tournament_groups" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can delete meal options" ON "public"."tournament_meal_options" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can delete side_events" ON "public"."side_events" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can delete tournament_files" ON "public"."tournament_files" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can delete tournaments" ON "public"."tournaments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can insert group members" ON "public"."tournament_group_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can insert groups" ON "public"."tournament_groups" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can insert meal options" ON "public"."tournament_meal_options" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can insert side_events" ON "public"."side_events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can insert tournament_files" ON "public"."tournament_files" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can insert tournaments" ON "public"."tournaments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update feedback status" ON "public"."feedbacks" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update group members" ON "public"."tournament_group_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can update groups" ON "public"."tournament_groups" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))));



CREATE POLICY "Admins can update meal options" ON "public"."tournament_meal_options" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update side_events" ON "public"."side_events" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update tournament_files" ON "public"."tournament_files" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update tournaments" ON "public"."tournaments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Anyone can view feedbacks" ON "public"."feedbacks" FOR SELECT USING (true);



CREATE POLICY "Anyone can view prize supports" ON "public"."tournament_prize_supports" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can insert their own feedback" ON "public"."feedbacks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can view meal options" ON "public"."tournament_meal_options" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view published group members" ON "public"."tournament_group_members" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."tournament_groups" "g"
  WHERE (("g"."id" = "tournament_group_members"."group_id") AND ("g"."is_published" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))))));



CREATE POLICY "Authenticated users can view published groups" ON "public"."tournament_groups" FOR SELECT USING ((("auth"."role"() = 'authenticated'::"text") AND (("is_published" = true) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true)))))));



CREATE POLICY "Authenticated users can view registrations" ON "public"."registrations" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view side_event_registrations" ON "public"."side_event_registrations" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view side_events" ON "public"."side_events" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view tournament_files" ON "public"."tournament_files" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can view tournaments" ON "public"."tournaments" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Owners can insert registration extras" ON "public"."registration_extras" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."registrations" "r"
  WHERE (("r"."id" = "registration_extras"."registration_id") AND ("r"."user_id" = "auth"."uid"())))) AND "public"."is_approved_user"("auth"."uid"())));



CREATE POLICY "Owners or admins can delete registration extras" ON "public"."registration_extras" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."registrations" "r"
  WHERE (("r"."id" = "registration_extras"."registration_id") AND ("r"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true))))));



CREATE POLICY "Owners or admins can update registration extras" ON "public"."registration_extras" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."registrations" "r"
  WHERE (("r"."id" = "registration_extras"."registration_id") AND ("r"."user_id" = "auth"."uid"())))) OR "public"."is_admin_secure"("auth"."uid"()))) WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."registrations" "r"
  WHERE (("r"."id" = "registration_extras"."registration_id") AND ("r"."user_id" = "auth"."uid"())))) AND "public"."is_approved_user"("auth"."uid"())) OR "public"."is_admin_secure"("auth"."uid"())));



CREATE POLICY "Owners or admins can view registration extras" ON "public"."registration_extras" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."registrations" "r"
  WHERE (("r"."id" = "registration_extras"."registration_id") AND ("r"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_admin" = true))))));



CREATE POLICY "Users can delete own registration" ON "public"."registrations" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Users can delete own side_event_registration" ON "public"."side_event_registrations" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Users can delete their own feedback" ON "public"."feedbacks" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own registration" ON "public"."registrations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own side_event_registration" ON "public"."side_event_registrations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own prize supports" ON "public"."tournament_prize_supports" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own registration" ON "public"."registrations" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Users can update own side_event_registration" ON "public"."side_event_registrations" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "Users can update their own feedback" ON "public"."feedbacks" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_admin_only" ON "public"."audit_logs" FOR SELECT USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "delete_activity_selections" ON "public"."registration_activity_selections" FOR DELETE USING ((( SELECT "registrations"."user_id"
   FROM "public"."registrations"
  WHERE ("registrations"."id" = "registration_activity_selections"."registration_id")) = "auth"."uid"()));



CREATE POLICY "delete_tournament_extras" ON "public"."tournament_extras" FOR DELETE USING ((( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) OR (( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_extras"."tournament_id")) = "auth"."uid"())));



ALTER TABLE "public"."feedbacks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_activity_selections" ON "public"."registration_activity_selections" FOR INSERT WITH CHECK ((( SELECT "registrations"."user_id"
   FROM "public"."registrations"
  WHERE ("registrations"."id" = "registration_activity_selections"."registration_id")) = "auth"."uid"()));



CREATE POLICY "insert_tournament_extras" ON "public"."tournament_extras" FOR INSERT WITH CHECK ((( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) OR (( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_extras"."tournament_id")) = "auth"."uid"())));



CREATE POLICY "manage_permissions" ON "public"."manager_permissions" USING (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) WITH CHECK (( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())));



ALTER TABLE "public"."manager_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_admin_update" ON "public"."profiles" FOR UPDATE USING ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "profiles_select_authenticated" ON "public"."profiles" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "profiles_select_own_or_admin" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."is_admin"("auth"."uid"())));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."registration_activity_selections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."registration_extras" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "registrations_admin_update" ON "public"."registrations" FOR UPDATE USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "select_activity_selections" ON "public"."registration_activity_selections" FOR SELECT USING (((( SELECT "registrations"."user_id"
   FROM "public"."registrations"
  WHERE ("registrations"."id" = "registration_activity_selections"."registration_id")) = "auth"."uid"()) OR ( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "select_tournament_extras" ON "public"."tournament_extras" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."side_event_registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "side_event_registrations_admin_update" ON "public"."side_event_registrations" FOR UPDATE USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."side_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "side_events_write_admin" ON "public"."side_events" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."tournament_extras" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournament_files_write_admin" ON "public"."tournament_files" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



ALTER TABLE "public"."tournament_group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_meal_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_prize_supports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tournaments_write_admin" ON "public"."tournaments" USING ("public"."is_admin"("auth"."uid"())) WITH CHECK ("public"."is_admin"("auth"."uid"()));



CREATE POLICY "update_activity_selections" ON "public"."registration_activity_selections" FOR UPDATE USING ((( SELECT "registrations"."user_id"
   FROM "public"."registrations"
  WHERE ("registrations"."id" = "registration_activity_selections"."registration_id")) = "auth"."uid"()));



CREATE POLICY "update_tournament_extras" ON "public"."tournament_extras" FOR UPDATE USING ((( SELECT "profiles"."is_admin"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) OR (( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_extras"."tournament_id")) = "auth"."uid"())));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."audit_registration_approval"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_registration_approval"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_registration_approval"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_manage_side_events"("p_user_id" "uuid", "p_tournament_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."can_manage_side_events"("p_user_id" "uuid", "p_tournament_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_side_events"("p_user_id" "uuid", "p_tournament_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_status_summary"("p_tournament_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_status_summary"("p_tournament_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_status_summary"("p_tournament_id" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_carpool_public"("p_tournament_id" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_carpool_public"("p_tournament_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_carpool_public"("p_tournament_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_carpool_public"("p_tournament_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_approvals_count"("p_tournament_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_approvals_count"("p_tournament_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_approvals_count"("p_tournament_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("uid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin_secure"("uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin_secure"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_secure"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_secure"("uid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_approved_user"("uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_approved_user"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_approved_user"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_approved_user"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_registration_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_registration_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_registration_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_side_event_registration_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_side_event_registration_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_side_event_registration_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_feedbacks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_feedbacks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_feedbacks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tournament_prize_supports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tournament_prize_supports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tournament_prize_supports_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."feedbacks" TO "anon";
GRANT ALL ON TABLE "public"."feedbacks" TO "authenticated";
GRANT ALL ON TABLE "public"."feedbacks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."feedbacks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."feedbacks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."feedbacks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."manager_permissions" TO "anon";
GRANT ALL ON TABLE "public"."manager_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."manager_permissions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."manager_permissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."manager_permissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."manager_permissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."registration_activity_selections" TO "anon";
GRANT ALL ON TABLE "public"."registration_activity_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."registration_activity_selections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."registration_activity_selections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."registration_activity_selections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."registration_activity_selections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."registration_extras" TO "anon";
GRANT ALL ON TABLE "public"."registration_extras" TO "authenticated";
GRANT ALL ON TABLE "public"."registration_extras" TO "service_role";



GRANT ALL ON SEQUENCE "public"."registration_extras_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."registration_extras_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."registration_extras_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."registrations" TO "anon";
GRANT ALL ON TABLE "public"."registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."registrations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."registrations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."side_event_registrations" TO "anon";
GRANT ALL ON TABLE "public"."side_event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."side_event_registrations" TO "service_role";



GRANT ALL ON SEQUENCE "public"."side_event_registrations_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."side_event_registrations_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."side_event_registrations_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."side_events" TO "anon";
GRANT ALL ON TABLE "public"."side_events" TO "authenticated";
GRANT ALL ON TABLE "public"."side_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."side_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."side_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."side_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_extras" TO "anon";
GRANT ALL ON TABLE "public"."tournament_extras" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_extras" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournament_extras_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournament_extras_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournament_extras_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_files" TO "anon";
GRANT ALL ON TABLE "public"."tournament_files" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_files" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournament_files_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournament_files_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournament_files_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_group_members" TO "anon";
GRANT ALL ON TABLE "public"."tournament_group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_group_members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournament_group_members_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournament_group_members_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournament_group_members_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_groups" TO "anon";
GRANT ALL ON TABLE "public"."tournament_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournament_groups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournament_groups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournament_groups_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_meal_options" TO "anon";
GRANT ALL ON TABLE "public"."tournament_meal_options" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_meal_options" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournament_meal_options_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournament_meal_options_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournament_meal_options_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_prize_supports" TO "anon";
GRANT ALL ON TABLE "public"."tournament_prize_supports" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_prize_supports" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournament_prize_supports_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournament_prize_supports_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournament_prize_supports_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tournaments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tournaments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tournaments_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































