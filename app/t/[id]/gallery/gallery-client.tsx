"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";

// ─── 타입 ──────────────────────────────────────────────────────────────────────

type GalleryItem = {
  id: number;
  user_id: string;
  media_type: "image" | "video_link";
  public_url: string | null;
  cloudinary_public_id: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  video_title: string | null;
  caption: string | null;
  created_at: string;
  uploader_nickname: string;
  like_count: number;
  comment_count: number;
  is_liked_by_me: boolean;
  is_mine: boolean;
};

type Comment = {
  id: number;
  user_id: string;
  content: string;
  created_at: string;
  commenter_nickname: string;
};

type Props = {
  tournamentId: number;
  tournamentTitle: string;
  eventDate: string;
  currentUserId: string;
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function buildCloudinaryThumb(publicId: string, width = 600): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_${width}/${publicId}`;
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── 아이템 카드 ───────────────────────────────────────────────────────────────

function GalleryCard({
  item,
  onLike,
  onDelete,
  onOpenComment,
}: {
  item: GalleryItem;
  onLike: (id: number, liked: boolean) => void;
  onDelete: (id: number) => void;
  onOpenComment: (item: GalleryItem) => void;
}) {
  const thumbSrc =
    item.media_type === "image" && item.cloudinary_public_id
      ? buildCloudinaryThumb(item.cloudinary_public_id, 600)
      : item.thumbnail_url ?? null;

  const ytId = item.video_url ? extractYouTubeId(item.video_url) : null;

  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* 썸네일 영역 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {thumbSrc ? (
          <Image
            src={thumbSrc}
            alt={item.caption ?? "갤러리 이미지"}
            fill
            className="object-cover transition-transform duration-300 hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            <span className="text-4xl">🎬</span>
          </div>
        )}
        {item.media_type === "video_link" && ytId && (
          <a
            href={item.video_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/20"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg">
              ▶
            </span>
          </a>
        )}
      </div>

      {/* 내용 */}
      <CardContent className="space-y-2 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">{item.uploader_nickname}</p>
          <p className="text-xs text-slate-400">{formatDate(item.created_at)}</p>
        </div>

        {item.video_title && (
          <p className="text-sm font-medium text-slate-700 line-clamp-1">{item.video_title}</p>
        )}

        {item.caption && (
          <p className="text-sm text-slate-600 line-clamp-2">{item.caption}</p>
        )}

        {/* 좋아요 / 댓글 / 삭제 */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => onLike(item.id, item.is_liked_by_me)}
            className={`flex items-center gap-1 text-sm transition-colors ${
              item.is_liked_by_me
                ? "font-semibold text-rose-500"
                : "text-slate-500 hover:text-rose-400"
            }`}
          >
            {item.is_liked_by_me ? "❤️" : "🤍"} {item.like_count}
          </button>
          <button
            type="button"
            onClick={() => onOpenComment(item)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            💬 {item.comment_count}
          </button>
          {item.is_mine && (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="ml-auto text-xs text-slate-400 hover:text-rose-500"
            >
              삭제
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 댓글 패널 ─────────────────────────────────────────────────────────────────

function CommentPanel({
  tournamentId,
  item,
  currentUserId,
  onClose,
}: {
  tournamentId: number;
  item: GalleryItem;
  currentUserId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/tournaments/${tournamentId}/gallery/${item.id}/comments`
    );
    if (res.ok) {
      const data = (await res.json()) as { comments: Comment[] };
      setComments(data.comments);
    }
    setLoading(false);
  }, [tournamentId, item.id]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  const handlePost = async () => {
    if (!input.trim()) return;
    setPosting(true);
    const res = await fetch(
      `/api/tournaments/${tournamentId}/gallery/${item.id}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      }
    );
    if (res.ok) {
      setInput("");
      await fetchComments();
    }
    setPosting(false);
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm("댓글을 삭제할까요?")) return;
    await fetch(
      `/api/tournaments/${tournamentId}/gallery/${item.id}/comments?commentId=${commentId}`,
      { method: "DELETE" }
    );
    await fetchComments();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-white sm:rounded-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-900">댓글</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {/* 댓글 목록 */}
        <div className="max-h-[50vh] overflow-y-auto px-5 py-3 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-4">로딩 중...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">첫 번째 댓글을 남겨보세요.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <span className="text-sm font-semibold text-slate-800 mr-2">
                    {c.commenter_nickname}
                  </span>
                  <span className="text-sm text-slate-700">{c.content}</span>
                  <p className="mt-0.5 text-xs text-slate-400">{formatDate(c.created_at)}</p>
                </div>
                {c.user_id === currentUserId && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.id)}
                    className="text-xs text-slate-400 hover:text-rose-500 shrink-0"
                  >
                    삭제
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* 댓글 입력 */}
        <div className="flex gap-2 border-t border-slate-200 px-4 py-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handlePost(); } }}
            placeholder="댓글 입력..."
            className="flex-1 rounded-2xl border-slate-200 text-sm"
            maxLength={500}
            disabled={posting}
          />
          <Button size="sm" onClick={() => void handlePost()} disabled={posting || !input.trim()}>
            게시
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── 업로드 모달 ───────────────────────────────────────────────────────────────

function UploadModal({
  tournamentId,
  uploadCount,
  uploadLimit,
  onClose,
  onUploaded,
}: {
  tournamentId: number;
  uploadCount: number;
  uploadLimit: number;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [tab, setTab] = useState<"image" | "video">("image");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const remaining = uploadLimit - uploadCount;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("파일 크기는 10MB 이하만 허용됩니다.");
      return;
    }
    setError("");
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleImageUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      // 1) 서명 요청
      const sigRes = await fetch(
        `/api/tournaments/${tournamentId}/gallery/upload-signature`,
        { method: "POST" }
      );
      if (!sigRes.ok) {
        const d = (await sigRes.json()) as { error?: string };
        setError(d.error ?? "서명 생성 실패");
        return;
      }
      const sig = (await sigRes.json()) as {
        signature: string;
        timestamp: number;
        folder: string;
        public_id: string;
        cloud_name: string;
        api_key: string;
      };

      // 2) Cloudinary 직접 업로드
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sig.api_key);
      formData.append("timestamp", String(sig.timestamp));
      formData.append("signature", sig.signature);
      formData.append("folder", sig.folder);
      formData.append("public_id", sig.public_id);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`,
        { method: "POST", body: formData }
      );
      if (!uploadRes.ok) {
        setError("Cloudinary 업로드 실패");
        return;
      }
      const uploaded = (await uploadRes.json()) as {
        public_id: string;
        secure_url: string;
      };

      // 3) DB 저장
      const saveRes = await fetch(`/api/tournaments/${tournamentId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "image",
          cloudinary_public_id: uploaded.public_id,
          public_url: uploaded.secure_url,
          caption: caption.trim() || null,
        }),
      });
      if (!saveRes.ok) {
        const d = (await saveRes.json()) as { error?: string };
        setError(d.error ?? "저장 실패");
        return;
      }

      onUploaded();
      onClose();
    } catch {
      setError("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoSubmit = async () => {
    if (!videoUrl.trim()) return;
    setUploading(true);
    setError("");

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/gallery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "video_link",
          video_url: videoUrl.trim(),
          caption: caption.trim() || null,
        }),
      });

      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "링크 저장 실패");
        return;
      }

      onUploaded();
      onClose();
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-900">
            추억 공유하기
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({uploadCount}/{uploadLimit}장)
            </span>
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {remaining <= 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            업로드 한도({uploadLimit}장)에 도달했습니다.
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* 탭 */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  tab === "image" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                }`}
                onClick={() => setTab("image")}
              >
                📷 사진
              </button>
              <button
                type="button"
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  tab === "video" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                }`}
                onClick={() => setTab("video")}
              >
                🎬 영상 링크
              </button>
            </div>

            {tab === "image" ? (
              <>
                <div
                  className="relative flex h-48 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100"
                  onClick={() => fileRef.current?.click()}
                >
                  {preview ? (
                    <Image src={preview} alt="미리보기" fill className="object-contain" />
                  ) : (
                    <div className="text-center">
                      <p className="text-3xl">📁</p>
                      <p className="mt-1 text-sm text-slate-500">클릭하여 사진 선택</p>
                      <p className="text-xs text-slate-400">최대 10MB</p>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="설명 입력 (선택)"
                  className="rounded-2xl border-slate-200 text-sm"
                  maxLength={300}
                />
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <Button
                  className="w-full"
                  onClick={() => void handleImageUpload()}
                  disabled={!file || uploading}
                >
                  {uploading ? "업로드 중..." : "업로드"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">YouTube 또는 Vimeo URL을 입력하세요.</p>
                  <Input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="rounded-2xl border-slate-200 text-sm"
                  />
                </div>
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="설명 입력 (선택)"
                  className="rounded-2xl border-slate-200 text-sm"
                  maxLength={300}
                />
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <Button
                  className="w-full"
                  onClick={() => void handleVideoSubmit()}
                  disabled={!videoUrl.trim() || uploading}
                >
                  {uploading ? "저장 중..." : "링크 저장"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 메인 클라이언트 컴포넌트 ─────────────────────────────────────────────────

export default function GalleryClient({
  tournamentId,
  tournamentTitle,
  eventDate,
  currentUserId,
}: Props) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploadLimit, setUploadLimit] = useState(10);
  const [showUpload, setShowUpload] = useState(false);
  const [commentTarget, setCommentTarget] = useState<GalleryItem | null>(null);

  const fetchItems = useCallback(
    async (p: number, append = false) => {
      setLoading(true);
      const res = await fetch(
        `/api/tournaments/${tournamentId}/gallery?page=${p}`
      );
      if (res.ok) {
        const data = (await res.json()) as {
          items: GalleryItem[];
          total: number;
          has_more: boolean;
          upload_count: number;
          upload_limit: number;
        };
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        setHasMore(data.has_more);
        setUploadCount(data.upload_count);
        setUploadLimit(data.upload_limit);
      }
      setLoading(false);
    },
    [tournamentId]
  );

  useEffect(() => {
    void fetchItems(0);
  }, [fetchItems]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    void fetchItems(next, true);
  };

  const handleLike = async (id: number, isLiked: boolean) => {
    const method = isLiked ? "DELETE" : "POST";
    await fetch(`/api/tournaments/${tournamentId}/gallery/${id}/like`, { method });
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              is_liked_by_me: !isLiked,
              like_count: item.like_count + (isLiked ? -1 : 1),
            }
          : item
      )
    );
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 게시물을 삭제할까요?")) return;
    const res = await fetch(
      `/api/tournaments/${tournamentId}/gallery/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((t) => t - 1);
    }
  };

  const handleUploaded = () => {
    setPage(0);
    void fetchItems(0);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      {/* 헤더 */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Gallery
            </p>
            <h1 className="text-xl font-bold text-slate-900">{tournamentTitle}</h1>
            <p className="text-sm text-slate-500">{eventDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowUpload(true)}
              disabled={uploadCount >= uploadLimit}
            >
              📷 올리기
              <span className="ml-1 text-xs opacity-70">
                ({uploadCount}/{uploadLimit})
              </span>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/t/${tournamentId}/results`}>← 결과 보기</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {loading && items.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-400">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
            <p className="text-3xl">📷</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">아직 공유된 사진이 없어요</p>
            <p className="text-sm text-slate-500">첫 번째 추억을 올려보세요!</p>
            <Button className="mt-4" size="sm" onClick={() => setShowUpload(true)}>
              사진/영상 올리기
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">총 {total}개의 추억</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  onLike={handleLike}
                  onDelete={handleDelete}
                  onOpenComment={setCommentTarget}
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? "불러오는 중..." : "더 보기"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 업로드 모달 */}
      {showUpload && (
        <UploadModal
          tournamentId={tournamentId}
          uploadCount={uploadCount}
          uploadLimit={uploadLimit}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {/* 댓글 패널 */}
      {commentTarget && (
        <CommentPanel
          tournamentId={tournamentId}
          item={commentTarget}
          currentUserId={currentUserId}
          onClose={() => setCommentTarget(null)}
        />
      )}
    </main>
  );
}
