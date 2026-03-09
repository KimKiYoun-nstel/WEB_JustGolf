"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import RestaurantCard, { type Restaurant } from "./_components/RestaurantCard";
import RestaurantForm from "./_components/RestaurantForm";

const CATEGORIES = ["전체", "한식", "중식", "일식", "양식", "카페", "분식", "해산물", "기타"];

interface RestaurantsClientProps {
  currentUserId: string;
  isAdmin: boolean;
}

export default function RestaurantsClient({ currentUserId, isAdmin }: RestaurantsClientProps) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("전체");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetch("/api/jeju/restaurants")
      .then((r) => r.json())
      .then((data) => setRestaurants(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (data: { name: string; category: string; address: string; description: string; map_url: string }) => {
    const res = await fetch("/api/jeju/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error ?? "등록 실패");
    }
    const json = await res.json();
    setRestaurants((prev) => [json, ...prev]);
    setShowAddForm(false);
  };

  const filtered = category === "전체" ? restaurants : restaurants.filter((r) => r.category === category);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-dalkkot-wood-dark">🍽️ 맛집 추천</h1>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-dalkkot-sage-dark px-3 py-1.5 text-sm text-white hover:bg-dalkkot-sage transition-colors"
        >
          {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showAddForm ? "취소" : "추가"}
        </button>
      </div>

      {/* 등록 폼 */}
      {showAddForm && (
        <div className="rounded-xl border border-dalkkot-cream-dark bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-dalkkot-wood-dark mb-3">새 맛집 추가</p>
          <RestaurantForm onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} submitLabel="등록" />
        </div>
      )}

      {/* 카테고리 필터 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === c
                ? "bg-dalkkot-wood-dark text-dalkkot-cream"
                : "bg-dalkkot-cream text-dalkkot-wood-mid hover:bg-dalkkot-cream-dark"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading && (
        <div className="py-8 text-center text-sm text-dalkkot-wood-mid animate-pulse">불러오는 중…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-dalkkot-cream-dark p-8 text-center">
          <p className="text-sm text-dalkkot-wood-mid">
            {category === "전체" ? "등록된 맛집이 없습니다." : `${category} 카테고리에 맛집이 없습니다.`}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((r) => (
          <RestaurantCard
            key={r.id}
            restaurant={r}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onDeleted={(id) => setRestaurants((prev) => prev.filter((x) => x.id !== id))}
            onUpdated={(updated) =>
              setRestaurants((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
            }
          />
        ))}
      </div>
    </div>
  );
}
