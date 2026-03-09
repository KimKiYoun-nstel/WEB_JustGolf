"use client";

import { useState } from "react";
import { MapPin, Pencil, Trash2, ExternalLink } from "lucide-react";
import LikeButton from "./LikeButton";
import CommentSection from "./CommentSection";
import RestaurantForm from "./RestaurantForm";

const CATEGORY_EMOJI: Record<string, string> = {
  한식: "🍚", 중식: "🥢", 일식: "🍱", 양식: "🍝",
  카페: "☕", 분식: "🥚", 해산물: "🦞", 기타: "🍽️",
};

export interface Restaurant {
  id: string;
  name: string;
  category: string;
  address: string | null;
  description: string | null;
  map_url: string | null;
  like_count: number;
  is_liked: boolean;
  added_by_nickname: string | null;
  updated_by_nickname: string | null;
  updated_at: string;
  user_id: string | null;
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  currentUserId: string;
  isAdmin: boolean;
  onDeleted: (id: string) => void;
  onUpdated: (r: Restaurant) => void;
}

export default function RestaurantCard({
  restaurant: r,
  currentUserId,
  isAdmin,
  onDeleted,
  onUpdated,
}: RestaurantCardProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = r.user_id === currentUserId || isAdmin;

  const handleDelete = async () => {
    if (!confirm(`"${r.name}"을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    const res = await fetch(`/api/jeju/restaurants/${r.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(r.id);
    else setDeleting(false);
  };

  const handleUpdate = async (data: { name: string; category: string; address: string; description: string; map_url: string }) => {
    const res = await fetch(`/api/jeju/restaurants/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? "수정 실패");
    }
    const json = await res.json();
    onUpdated(json);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-dalkkot-cream-dark bg-white shadow-sm overflow-hidden">
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{CATEGORY_EMOJI[r.category] ?? "🍽️"}</span>
            <div>
              <h3 className="font-semibold text-dalkkot-wood-dark">{r.name}</h3>
              <span className="text-xs text-dalkkot-wood-mid">{r.category}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <LikeButton
              restaurantId={r.id}
              initialLiked={r.is_liked}
              initialCount={r.like_count}
            />
            {canEdit && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="rounded p-1 text-dalkkot-wood-mid/60 hover:text-dalkkot-sage-dark hover:bg-dalkkot-cream transition-colors"
                  title="수정"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded p-1 text-dalkkot-wood-mid/60 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                  title="삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {r.description && (
          <p className="text-sm text-dalkkot-wood-dark/80">{r.description}</p>
        )}

        {r.address && (
          <p className="flex items-center gap-1 text-xs text-dalkkot-wood-mid">
            <MapPin className="h-3 w-3" />
            {r.address}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {r.map_url && (
              <a
                href={r.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-dalkkot-sage-dark hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                지도
              </a>
            )}
          </div>
          <span className="text-xs text-dalkkot-wood-mid/50">
            {r.added_by_nickname ?? "알 수 없음"}
          </span>
        </div>

        <CommentSection
          restaurantId={r.id}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      </div>

      {/* 인라인 편집 패널 */}
      {editing && (
        <div className="border-t border-dalkkot-cream-dark bg-dalkkot-cream p-4">
          <p className="text-xs font-medium text-dalkkot-wood-dark/70 mb-3">맛집 정보 수정</p>
          <RestaurantForm
            initial={{ name: r.name, category: r.category, address: r.address ?? "", description: r.description ?? "", map_url: r.map_url ?? "" }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            submitLabel="수정 완료"
          />
        </div>
      )}
    </div>
  );
}
