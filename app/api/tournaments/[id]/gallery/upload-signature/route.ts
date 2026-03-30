/**
 * POST /api/tournaments/[id]/gallery/upload-signature
 * Cloudinary Signed Upload용 서명 생성
 * - 클라이언트가 이 서명을 받아 Cloudinary에 직접 업로드
 * - 서버가 업로드 한도(10장) 체크
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "../../../../../../lib/apiGuard";
import { generateUploadSignature } from "../../../../../../lib/cloudinary";
import { getUserUploadCount } from "../../../../../../lib/gallery/tournamentGallery";
import { createRequestSupabaseClient } from "../../../../../../lib/apiGuard";

const UPLOAD_LIMIT_PER_USER = parseInt(
  process.env.GALLERY_UPLOAD_LIMIT_PER_USER ?? "10",
  10
);

function parseTournamentId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = parseTournamentId(id);
  if (!tournamentId) {
    return NextResponse.json({ error: "유효하지 않은 대회 ID입니다." }, { status: 400 });
  }

  const guard = await requireApiUser({ requireApproved: true });
  if ("error" in guard) return guard.error;
  const { user } = guard;

  // 대회가 done 상태인지 확인
  const supabase = await createRequestSupabaseClient();
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("status")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tournament || tournament.status !== "done") {
    return NextResponse.json(
      { error: "종료된 대회에서만 갤러리를 이용할 수 있습니다." },
      { status: 403 }
    );
  }

  // 인당 업로드 한도 체크
  const uploadCount = await getUserUploadCount(tournamentId, user.id);
  if (uploadCount >= UPLOAD_LIMIT_PER_USER) {
    return NextResponse.json(
      {
        error: `업로드 한도(${UPLOAD_LIMIT_PER_USER}장)를 초과했습니다.`,
        current: uploadCount,
        limit: UPLOAD_LIMIT_PER_USER,
      },
      { status: 429 }
    );
  }

  // 서명 생성
  // eager로 업로드 시 변환을 미리 처리해 첫 요청 시 지연을 없앰
  const EAGER_TRANSFORM = "w_800,f_auto,q_auto|w_400,f_auto,q_auto";
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `just-golf/gallery/${tournamentId}`;
  const publicId = `${user.id.slice(0, 8)}-${crypto.randomUUID()}`;

  const signature = generateUploadSignature({
    folder,
    public_id: publicId,
    timestamp,
    eager: EAGER_TRANSFORM,
  });

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    public_id: publicId,
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    eager: EAGER_TRANSFORM,
    remaining: UPLOAD_LIMIT_PER_USER - uploadCount - 1,
  });
}
