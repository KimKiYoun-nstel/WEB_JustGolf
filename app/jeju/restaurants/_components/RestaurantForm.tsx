"use client";

import { useState } from "react";

interface RestaurantFormData {
  name: string;
  category: string;
  address: string;
  description: string;
  map_url: string;
}

const CATEGORIES = ["한식", "중식", "일식", "양식", "카페", "분식", "해산물", "기타"];

interface RestaurantFormProps {
  initial?: Partial<RestaurantFormData>;
  onSubmit: (data: RestaurantFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export default function RestaurantForm({ initial, onSubmit, onCancel, submitLabel = "등록" }: RestaurantFormProps) {
  const [form, setForm] = useState<RestaurantFormData>({
    name: initial?.name ?? "",
    category: initial?.category ?? "한식",
    address: initial?.address ?? "",
    description: initial?.description ?? "",
    map_url: initial?.map_url ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof RestaurantFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.category) { setError("이름과 카테고리는 필수입니다."); return; }
    setLoading(true); setError(null);
    try { await onSubmit(form); }
    catch (e) { setError(e instanceof Error ? e.message : "오류가 발생했습니다."); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full rounded-lg border border-dalkkot-cream-dark px-3 py-2 text-sm focus:border-dalkkot-sage-dark focus:outline-none";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 space-y-1">
          <span className="text-xs font-medium text-dalkkot-wood-dark/70">이름 *</span>
          <input type="text" placeholder="식당 이름" value={form.name} onChange={set("name")} className={inputCls} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-dalkkot-wood-dark/70">카테고리 *</span>
          <select value={form.category} onChange={set("category")} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-dalkkot-wood-dark/70">지도 링크</span>
          <input type="url" placeholder="https://naver.me/..." value={form.map_url} onChange={set("map_url")} className={inputCls} />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="text-xs font-medium text-dalkkot-wood-dark/70">주소</span>
          <input type="text" placeholder="서귀포시 ..." value={form.address} onChange={set("address")} className={inputCls} />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="text-xs font-medium text-dalkkot-wood-dark/70">한 줄 설명</span>
          <textarea rows={2} placeholder="추천 이유, 메뉴 등" value={form.description} onChange={set("description")} className={`${inputCls} resize-none`} />
        </label>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="rounded-lg border border-dalkkot-cream-dark px-4 py-1.5 text-sm hover:bg-dalkkot-cream transition-colors">취소</button>
        <button onClick={handleSubmit} disabled={loading} className="rounded-lg bg-dalkkot-sage-dark px-4 py-1.5 text-sm text-white hover:bg-dalkkot-sage disabled:opacity-60 transition-colors">
          {loading ? "처리 중..." : submitLabel}
        </button>
      </div>
    </div>
  );
}
