alter table "public"."registrations" drop constraint "registrations_approval_status_check";

alter table "public"."registrations" add constraint "registrations_approval_status_check" CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[]))) not valid;

alter table "public"."registrations" validate constraint "registrations_approval_status_check";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "admin_delete_tournament_files"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'tournament-files'::text) AND public.is_admin(auth.uid())));



  create policy "admin_upload_tournament_files"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'tournament-files'::text) AND public.is_admin(auth.uid())));



