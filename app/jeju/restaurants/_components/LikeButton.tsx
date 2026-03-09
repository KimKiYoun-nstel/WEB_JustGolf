"use client";

import { useState, useOptimistic, startTransition } from "react";
import { Heart } from "lucide-react";

interface LikeButtonProps {
  restaurantId: string;
  initialLiked: boolean;
  initialCount: number;
}

export default function LikeButton({ restaurantId, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    // 낙관적 업데이트
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => c + (newLiked ? 1 : -1));

    try {
      const res = await fetch(`/api/jeju/restaurants/${restaurantId}/likes`, { method: "POST" });
      if (!res.ok) {
        // 롤백
        setLiked(liked);
        setCount(count);
      } else {
        const json = await res.json();
        setLiked(json.liked);
        setCount(json.like_count);
      }
    } catch {
      setLiked(liked);
      setCount(count);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        liked
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-dalkkot-cream text-dalkkot-wood-mid hover:bg-dalkkot-cream-dark"
      }`}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
    >
      <Heart className={`h-3.5 w-3.5 ${liked ? "fill-red-500" : ""}`} />
      {count}
    </button>
  );
}
