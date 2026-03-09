"use client";

import { useState } from "react";

interface Section {
  key: "intro_md" | "rules_md" | "faq_md";
  label: string;
  emoji: string;
}

const SECTIONS: Section[] = [
  { key: "intro_md", label: "별장 소개", emoji: "🏠" },
  { key: "rules_md", label: "이용 수칙", emoji: "📋" },
  { key: "faq_md", label: "자주 묻는 질문", emoji: "💬" },
];

interface VillaInfoClientProps {
  villa: {
    id: string;
    intro_md: string | null;
    rules_md: string | null;
    faq_md: string | null;
  };
  isAdmin: boolean;
}

function renderMarkdown(text: string): string {
  // 간단한 마크다운 렌더링 (bold, h2, h3, 줄바꿈, bullet)
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-dalkkot-wood-dark mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-dalkkot-wood-dark mt-5 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^• (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

export default function VillaInfoClient({ villa, isAdmin }: VillaInfoClientProps) {
  const [editing, setEditing] = useState<Section["key"] | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState(villa);
  const [activeSection, setActiveSection] = useState<Section["key"]>("intro_md");

  const startEdit = (key: Section["key"]) => {
    setEditing(key);
    setEditValue(data[key] ?? "");
    setError(null);
  };

  const cancelEdit = () => { setEditing(null); setError(null); };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true); setError(null);
    const res = await fetch(`/api/jeju/villas`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [editing]: editValue }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "저장 실패"); return; }
    setData({ ...data, [editing]: editValue });
    setEditing(null);
  };

  const currentContent = data[activeSection];
  const currentSection = SECTIONS.find((s) => s.key === activeSection)!;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-dalkkot-wood-dark">이용수칙 · 정보</h1>

      {/* 섹션 탭 */}
      <div className="flex rounded-xl overflow-hidden border border-dalkkot-cream-dark">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeSection === s.key
                ? "bg-dalkkot-wood-dark text-dalkkot-cream"
                : "bg-white text-dalkkot-wood-mid hover:bg-dalkkot-cream"
            }`}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 영역 */}
      <div className="rounded-xl border border-dalkkot-cream-dark bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-dalkkot-cream-dark bg-dalkkot-cream px-5 py-3">
          <h2 className="font-semibold text-dalkkot-wood-dark">
            {currentSection.emoji} {currentSection.label}
          </h2>
          {isAdmin && editing !== activeSection && (
            <button
              onClick={() => startEdit(activeSection)}
              className="text-xs text-dalkkot-sage-dark hover:underline"
            >
              ✏️ 편집
            </button>
          )}
        </div>

        <div className="p-5">
          {editing === activeSection ? (
            <div className="space-y-3">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={16}
                className="w-full rounded-lg border border-dalkkot-cream-dark px-3 py-2 text-sm font-mono focus:border-dalkkot-sage-dark focus:outline-none resize-y"
                placeholder="마크다운 형식으로 입력하세요"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancelEdit}
                  className="rounded-lg border border-dalkkot-cream-dark px-4 py-1.5 text-sm hover:bg-dalkkot-cream transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-lg bg-dalkkot-sage-dark px-4 py-1.5 text-sm text-white hover:bg-dalkkot-sage disabled:opacity-60 transition-colors"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : currentContent ? (
            <div
              className="prose prose-sm max-w-none text-dalkkot-wood-dark leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(currentContent) }}
            />
          ) : (
            <div className="py-8 text-center text-sm text-dalkkot-wood-mid/60">
              {isAdmin ? (
                <button onClick={() => startEdit(activeSection)} className="hover:underline">
                  + 내용을 추가하세요
                </button>
              ) : (
                "내용이 준비 중입니다."
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
