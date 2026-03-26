import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../lib/apiGuard";

function parseTournamentId(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

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

    const pdfPath = path.join(process.cwd(), "DevGuide", "20260326", "단체 스코어.pdf");
    const fileBuffer = await fs.readFile(pdfPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="tournament-${tournamentId}-result.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Tournament result pdf route error:", error);
    return NextResponse.json(
      { error: "결과 PDF를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
