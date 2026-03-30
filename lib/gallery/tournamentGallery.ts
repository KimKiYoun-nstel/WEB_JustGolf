/**
 * 갤러리 서버 측 데이터 조회 함수
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export type GalleryItem = {
  id: number;
  tournament_id: number;
  user_id: string;
  media_type: "image" | "video_link";
  cloudinary_public_id: string | null;
  public_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  video_title: string | null;
  caption: string | null;
  is_hidden: boolean;
  created_at: string;
  uploader_nickname: string;
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
};

export type GalleryComment = {
  id: number;
  item_id: number;
  user_id: string;
  content: string;
  created_at: string;
  commenter_nickname: string;
};

export async function getGalleryItems(
  tournamentId: number,
  userId: string,
  page = 0,
  pageSize = 20
): Promise<GalleryItem[]> {
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

  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from("tournament_gallery_items")
    .select(
      `
      id, tournament_id, user_id, media_type,
      cloudinary_public_id, public_url,
      video_url, thumbnail_url, video_title,
      caption, is_hidden, created_at,
      tournament_gallery_likes (count),
      tournament_gallery_comments (count)
    `
    )
    .eq("tournament_id", tournamentId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error || !data) return [];

  // profiles 별도 쿼리 (PostgREST가 auth.users 경유 간접 FK 인식 못함)
  const uploaderIds = [...new Set(data.map((r) => r.user_id as string))];
  const { data: profileRows } = uploaderIds.length > 0
    ? await supabase.from("profiles").select("id, nickname").in("id", uploaderIds)
    : { data: [] };
  const profileMap = new Map<string, string>(
    (profileRows ?? []).map((p: { id: string; nickname: string }) => [p.id, p.nickname])
  );

  // 내가 좋아요한 아이템 ID 목록
  const itemIds = data.map((r) => r.id);
  const { data: myLikes } = await supabase
    .from("tournament_gallery_likes")
    .select("item_id")
    .eq("user_id", userId)
    .in("item_id", itemIds);
  const likedSet = new Set((myLikes ?? []).map((l) => l.item_id));

  return data.map((row) => {
    const likes = Array.isArray(row.tournament_gallery_likes)
      ? row.tournament_gallery_likes
      : [];
    const comments = Array.isArray(row.tournament_gallery_comments)
      ? row.tournament_gallery_comments
      : [];
    return {
      id: row.id,
      tournament_id: row.tournament_id,
      user_id: row.user_id,
      media_type: row.media_type as "image" | "video_link",
      cloudinary_public_id: row.cloudinary_public_id ?? null,
      public_url: row.public_url ?? null,
      video_url: row.video_url ?? null,
      thumbnail_url: row.thumbnail_url ?? null,
      video_title: row.video_title ?? null,
      caption: row.caption ?? null,
      is_hidden: row.is_hidden,
      created_at: row.created_at,
      uploader_nickname: profileMap.get(row.user_id as string) ?? "알 수 없음",
      like_count: (likes[0] as { count?: number })?.count ?? 0,
      comment_count: (comments[0] as { count?: number })?.count ?? 0,
      is_liked_by_me: likedSet.has(row.id),
    };
  });
}

export async function getGalleryItemCount(tournamentId: number): Promise<number> {
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

  const { count } = await supabase
    .from("tournament_gallery_items")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("is_hidden", false);

  return count ?? 0;
}

/** 사용자가 해당 대회에 업로드한 아이템 수 */
export async function getUserUploadCount(
  tournamentId: number,
  userId: string
): Promise<number> {
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

  const { count } = await supabase
    .from("tournament_gallery_items")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId);

  return count ?? 0;
}
