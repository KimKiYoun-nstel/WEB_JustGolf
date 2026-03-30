/**
 * GET  /api/tournaments/[id]/gallery        — 갤러리 목록 조회
 * POST /api/tournaments/[id]/gallery        — 갤러리 아이템 등록 (Cloudinary 업로드 완료 후)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, createRequestSupabaseClient } from "../../../../../lib/apiGuard";
import { getUserUploadCount } from "../../../../../lib/gallery/tournamentGallery";

const UPLOAD_LIMIT_PER_USER = parseInt(
  process.env.GALLERY_UPLOAD_LIMIT_PER_USER ?? "10",
  10
);
const PAGE_SIZE = 20;

function parseTournamentId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** YouTube/Vimeo URL에서 oEmbed 썸네일 추출 */
async function fetchVideoMeta(
  videoUrl: string
): Promise<{ thumbnail_url: string | null; title: string | null }> {
  try {
    const ytMatch = videoUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
    );
    if (ytMatch) {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytMatch[1]}&format=json`,
        { next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = (await res.json()) as { thumbnail_url?: string; title?: string };
        return {
          thumbnail_url: data.thumbnail_url ?? null,
          title: data.title ?? null,
        };
      }
    }

    const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      const res = await fetch(
        `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vimeoMatch[1]}`,
        { next: { revalidate: 86400 } }
      );
      if (res.ok) {
        const data = (await res.json()) as { thumbnail_url?: string; title?: string };
        return {
          thumbnail_url: data.thumbnail_url ?? null,
          title: data.title ?? null,
        };
      }
    }
  } catch {
    // oEmbed 실패 시 조용히 무시
  }
  return { thumbnail_url: null, title: null };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = parseTournamentId(id);
  if (!tournamentId) {
    return NextResponse.json({ error: "유효하지 않은 대회 ID입니다." }, { status: 400 });
  }

  const guard = await requireApiUser();
  if ("error" in guard) return guard.error;
  const { user, supabase } = guard;

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10));
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("tournament_gallery_items")
    .select(
      `id, tournament_id, user_id, media_type,
       cloudinary_public_id, public_url,
       video_url, thumbnail_url, video_title,
       caption, is_hidden, created_at`,
      { count: "exact" }
    )
    .eq("tournament_id", tournamentId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const itemIds = (data ?? []).map((r: Record<string, unknown>) => r.id as number);

  // profiles는 별도 쿼리 (PostgREST가 auth.users 경유 간접 FK를 인식 못함)
  const uploaderIds = [...new Set((data ?? []).map((r: Record<string, unknown>) => r.user_id as string))];
  const { data: profileRows } = uploaderIds.length > 0
    ? await supabase.from("profiles").select("id, nickname").in("id", uploaderIds)
    : { data: [] };
  const profileMap = new Map<string, string>((profileRows ?? []).map((p: { id: string; nickname: string }) => [p.id, p.nickname]));
  const [likesRes, commentsRes, myLikesRes] = await Promise.all([
    itemIds.length > 0
      ? supabase
          .from("tournament_gallery_likes")
          .select("item_id")
          .in("item_id", itemIds)
      : Promise.resolve({ data: [] }),
    itemIds.length > 0
      ? supabase
          .from("tournament_gallery_comments")
          .select("item_id")
          .in("item_id", itemIds)
          .eq("is_hidden", false)
      : Promise.resolve({ data: [] }),
    itemIds.length > 0
      ? supabase
          .from("tournament_gallery_likes")
          .select("item_id")
          .eq("user_id", user.id)
          .in("item_id", itemIds)
      : Promise.resolve({ data: [] }),
  ]);

  const likeCountMap = new Map<number, number>();
  const commentCountMap = new Map<number, number>();
  const likedSet = new Set<number>();

  for (const l of (likesRes.data ?? []) as Array<{ item_id: number }>) {
    likeCountMap.set(l.item_id, (likeCountMap.get(l.item_id) ?? 0) + 1);
  }
  for (const c of (commentsRes.data ?? []) as Array<{ item_id: number }>) {
    commentCountMap.set(c.item_id, (commentCountMap.get(c.item_id) ?? 0) + 1);
  }
  for (const l of (myLikesRes.data ?? []) as Array<{ item_id: number }>) {
    likedSet.add(l.item_id);
  }

  const items = (data ?? []).map((row: Record<string, unknown>) => {
    return {
      id: row.id,
      tournament_id: row.tournament_id,
      user_id: row.user_id,
      media_type: row.media_type,
      cloudinary_public_id: row.cloudinary_public_id ?? null,
      public_url: row.public_url ?? null,
      video_url: row.video_url ?? null,
      thumbnail_url: row.thumbnail_url ?? null,
      video_title: row.video_title ?? null,
      caption: row.caption ?? null,
      created_at: row.created_at,
      uploader_nickname: profileMap.get(row.user_id as string) ?? "알 수 없음",
      like_count: likeCountMap.get(row.id as number) ?? 0,
      comment_count: commentCountMap.get(row.id as number) ?? 0,
      is_liked_by_me: likedSet.has(row.id as number),
      is_mine: row.user_id === user.id,
    };
  });

  const uploadCount = await getUserUploadCount(tournamentId, user.id);

  return NextResponse.json({
    items,
    total: count ?? 0,
    page,
    has_more: (count ?? 0) > to + 1,
    upload_count: uploadCount,
    upload_limit: UPLOAD_LIMIT_PER_USER,
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournamentId = parseTournamentId(id);
  if (!tournamentId) {
    return NextResponse.json({ error: "유효하지 않은 대회 ID입니다." }, { status: 400 });
  }

  const guard = await requireApiUser({ requireApproved: true });
  if ("error" in guard) return guard.error;
  const { user, supabase } = guard;

  // 대회 done 상태 확인
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

  // 인당 업로드 한도 최종 확인
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const mediaType = b.media_type as string | undefined;

  if (mediaType === "image") {
    const cloudinaryPublicId = typeof b.cloudinary_public_id === "string" ? b.cloudinary_public_id.trim() : "";
    const publicUrl = typeof b.public_url === "string" ? b.public_url.trim() : "";

    if (!cloudinaryPublicId || !publicUrl) {
      return NextResponse.json(
        { error: "이미지 정보(cloudinary_public_id, public_url)가 필요합니다." },
        { status: 400 }
      );
    }

    // public_url이 우리 Cloudinary 도메인인지 검증
    if (!publicUrl.includes("cloudinary.com")) {
      return NextResponse.json({ error: "유효하지 않은 이미지 URL입니다." }, { status: 400 });
    }

    const caption = typeof b.caption === "string" ? b.caption.trim().slice(0, 300) : null;

    const { data: item, error } = await supabase
      .from("tournament_gallery_items")
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        media_type: "image",
        cloudinary_public_id: cloudinaryPublicId,
        public_url: publicUrl,
        caption: caption || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: item.id }, { status: 201 });
  }

  if (mediaType === "video_link") {
    const videoUrl = typeof b.video_url === "string" ? b.video_url.trim() : "";

    if (!videoUrl) {
      return NextResponse.json({ error: "영상 URL이 필요합니다." }, { status: 400 });
    }

    const isYoutube = /youtu(\.be|be\.com)/.test(videoUrl);
    const isVimeo = /vimeo\.com/.test(videoUrl);
    if (!isYoutube && !isVimeo) {
      return NextResponse.json(
        { error: "YouTube 또는 Vimeo URL만 지원합니다." },
        { status: 400 }
      );
    }

    const { thumbnail_url, title } = await fetchVideoMeta(videoUrl);
    const caption = typeof b.caption === "string" ? b.caption.trim().slice(0, 300) : null;

    const { data: item, error } = await supabase
      .from("tournament_gallery_items")
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        media_type: "video_link",
        video_url: videoUrl,
        thumbnail_url,
        video_title: title,
        caption: caption || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: item.id }, { status: 201 });
  }

  return NextResponse.json({ error: "media_type은 'image' 또는 'video_link'여야 합니다." }, { status: 400 });
}
