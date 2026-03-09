"use client";

import { useState, useCallback } from "react";
import { Send, Trash2, Pencil } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  author_nickname: string;
  author_id: string;
  created_at: string;
}

interface CommentSectionProps {
  restaurantId: string;
  currentUserId: string;
  isAdmin: boolean;
}

export default function CommentSection({ restaurantId, currentUserId, isAdmin }: CommentSectionProps) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const loadComments = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    const res = await fetch(`/api/jeju/restaurants/${restaurantId}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data);
      setLoaded(true);
    }
    setLoading(false);
  }, [restaurantId, loaded]);

  const handleToggle = async () => {
    setOpen((prev) => !prev);
    if (!open && !loaded) await loadComments();
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/jeju/restaurants/${restaurantId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newComment.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setComments((prev) => [data, ...prev]);
      setNewComment("");
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    const res = await fetch(`/api/jeju/restaurants/${restaurantId}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleEdit = async (commentId: string) => {
    if (!editValue.trim()) return;
    const res = await fetch(`/api/jeju/restaurants/${restaurantId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editValue.trim() }),
    });
    if (res.ok) {
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, content: editValue.trim() } : c));
      setEditId(null);
    }
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className="text-xs text-dalkkot-sage-dark hover:underline"
      >
        💬 댓글 {open ? "접기" : "보기"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* 댓글 입력 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="댓글 입력 (최대 500자)"
              maxLength={500}
              className="flex-1 rounded-lg border border-dalkkot-cream-dark px-3 py-1.5 text-sm focus:border-dalkkot-sage-dark focus:outline-none"
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
              className="rounded-lg bg-dalkkot-sage-dark px-3 py-1.5 text-dalkkot-cream hover:bg-dalkkot-sage disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* 댓글 목록 */}
          {loading && <p className="text-xs text-dalkkot-wood-mid animate-pulse">불러오는 중…</p>}
          {comments.length === 0 && !loading && (
            <p className="text-xs text-dalkkot-wood-mid/60 py-2">댓글이 없습니다.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg bg-dalkkot-cream px-3 py-2 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-dalkkot-wood-mid">{c.author_nickname}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-dalkkot-wood-mid/50">
                    {new Date(c.created_at).toLocaleDateString("ko-KR")}
                  </span>
                  {(c.author_id === currentUserId || isAdmin) && (
                    <>
                      {c.author_id === currentUserId && (
                        <button
                          onClick={() => { setEditId(c.id); setEditValue(c.content); }}
                          className="ml-1 text-dalkkot-wood-mid/60 hover:text-dalkkot-sage-dark"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(c.id)} className="text-dalkkot-wood-mid/60 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editId === c.id ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 rounded border border-dalkkot-cream-dark px-2 py-0.5 text-sm focus:outline-none"
                  />
                  <button onClick={() => handleEdit(c.id)} className="text-xs text-dalkkot-sage-dark hover:underline">저장</button>
                  <button onClick={() => setEditId(null)} className="text-xs text-dalkkot-wood-mid/60 hover:underline">취소</button>
                </div>
              ) : (
                <p className="text-dalkkot-wood-dark">{c.content}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
