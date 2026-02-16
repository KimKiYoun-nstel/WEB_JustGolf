"use client";

import { useEffect, useState } from "react";

export interface TOCItem {
  id: string;
  label: string;
  icon?: string;
  level?: number;
}

interface TableOfContentsProps {
  items: TOCItem[];
  activeSection?: string;
}

export function TableOfContents({ items, activeSection }: TableOfContentsProps) {
  const [open, setOpen] = useState(false);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setOpen(false);
    }
  };

  return (
    <>
      {/* 모바일: 드로어 메뉴 */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-left font-medium text-slate-900 hover:bg-slate-50"
        >
          📑 목차 {open ? "▼" : "▶"}
        </button>

        {open && (
          <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-4">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className={`block w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  activeSection === item.id
                    ? "bg-blue-100 font-semibold text-blue-900"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                style={{ paddingLeft: `${(item.level || 0) * 1 + 0.75}rem` }}
              >
                {item.icon && <span className="mr-2">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PC: 고정 사이드바 */}
      <div className="hidden md:block fixed right-4 top-24 w-64 max-h-[calc(100vh-120px)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-4 font-bold text-slate-900">📑 목차</h3>
        <nav className="space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className={`block w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                activeSection === item.id
                  ? "bg-blue-100 font-semibold text-blue-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              style={{ paddingLeft: `${(item.level || 0) * 1 + 0.75}rem` }}
            >
              {item.icon && <span className="mr-2">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 스크린 reader를 위한 스킵 링크 */}
      <div className="sr-only">
        <h2>목차</h2>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`}>{item.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * 활성 섹션을 감지하고 업데이트하는 Hook
 * Intersection Observer를 사용하여 뷰포트에 보이는 섹션 감지
 */
export function useTableOfContents(
  itemIds: string[]
): string | undefined {
  const [activeId, setActiveId] = useState<string | undefined>();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // 뷰포트 상단에 가장 가까운 섹션 찾기
        let closestEntry = entries[0];
        let closestDistance = Math.abs(
          closestEntry.boundingClientRect.top - 80 // 헤더 높이
        );

        entries.forEach((entry) => {
          const distance = Math.abs(entry.boundingClientRect.top - 80);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestEntry = entry;
          }
        });

        if (closestEntry) {
          setActiveId(closestEntry.target.id);
        }
      },
      {
        rootMargin: "-80px 0px -66% 0px",
        threshold: 0,
      }
    );

    // 모든 섹션을 observer에 등록
    itemIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      itemIds.forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [itemIds]);

  return activeId;
}
