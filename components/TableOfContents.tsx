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
  fabIcon?: string;
  panelTitle?: string;
  showIcons?: boolean;
}

export function TableOfContents({
  items,
  activeSection,
  fabIcon = "📑",
  panelTitle = "목차",
  showIcons = true,
}: TableOfContentsProps) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    return null;
  }

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setOpen(false);
    }
  };

  return (
    <>
      {/* 모바일: FAB (Floating Action Button) */}
      <div className="fixed bottom-6 right-6 z-40 md:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all duration-200 flex items-center justify-center font-bold text-lg"
          aria-label={`${panelTitle} 토글`}
          title={panelTitle}
        >
          {fabIcon}
        </button>

        {open && (
          <div className="fixed inset-x-4 bottom-20 max-h-[50vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl animate-fade-in">
            <h3 className="font-semibold text-slate-900 mb-3">{panelTitle}</h3>
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
                  {showIcons && item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* PC: 고정 사이드바 */}
      <div className="hidden md:block fixed right-4 top-24 w-64 max-h-[calc(100vh-120px)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-4 font-bold text-slate-900">{panelTitle}</h3>
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
              {showIcons && item.icon && <span className="mr-2">{item.icon}</span>}
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
