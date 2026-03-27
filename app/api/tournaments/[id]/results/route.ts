import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "../../../../../lib/apiGuard";
import {
  getTournamentResultsForUser,
  parseTournamentId,
  TournamentResultsError,
} from "../../../../../lib/results/tournamentResults";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = parseTournamentId(id);
    if (!tournamentId) {
      return NextResponse.json({ error: "유효하지 않은 대회 ID입니다." }, { status: 400 });
    }

    const guard = await requireApiUser();
    if ("error" in guard) return guard.error;

    const payload = await getTournamentResultsForUser(tournamentId, guard.user.id);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof TournamentResultsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Tournament results API error:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
