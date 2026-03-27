import { notFound, redirect } from "next/navigation";
import { createRequestSupabaseClient } from "../../../../lib/apiGuard";
import {
  getTournamentResultsForUser,
  parseTournamentId,
  TournamentResultsError,
} from "../../../../lib/results/tournamentResults";
import TournamentResultsClient from "./results-client";

type TournamentResultsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TournamentResultsPage({
  params,
}: TournamentResultsPageProps) {
  const { id } = await params;
  const tournamentId = parseTournamentId(id);

  if (!tournamentId) {
    notFound();
  }

  const supabase = await createRequestSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(`/t/${tournamentId}/results`)}`);
  }

  let initialData;
  try {
    initialData = await getTournamentResultsForUser(tournamentId, user.id);
  } catch (error) {
    if (error instanceof TournamentResultsError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return (
    <TournamentResultsClient
      initialData={initialData}
      tournamentId={tournamentId}
    />
  );
}
