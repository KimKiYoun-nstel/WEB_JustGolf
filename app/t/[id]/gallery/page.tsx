import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import GalleryClient from "./gallery-client";

async function getTournamentInfo(tournamentId: number) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, title, event_date, status")
    .eq("id", tournamentId)
    .maybeSingle();

  return { user, tournament };
}

export default async function TournamentGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = parseInt(id, 10);
  if (!Number.isFinite(tournamentId) || tournamentId <= 0) {
    redirect("/tournaments");
  }

  const result = await getTournamentInfo(tournamentId);
  if (!result?.user) {
    redirect(`/login?next=/t/${tournamentId}/gallery`);
  }

  const { tournament, user } = result;
  if (!tournament || tournament.status !== "done") {
    redirect(`/t/${tournamentId}`);
  }

  return (
    <GalleryClient
      tournamentId={tournamentId}
      tournamentTitle={tournament.title}
      eventDate={tournament.event_date ?? ""}
      currentUserId={user.id}
    />
  );
}
