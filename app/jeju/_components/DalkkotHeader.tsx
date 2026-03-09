"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarRange, BookOpen, UtensilsCrossed, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/jeju",             label: "홈",         icon: Home },
  { href: "/jeju/calendar",    label: "예약 캘린더", icon: CalendarRange },
  { href: "/jeju/info",        label: "이용 수칙",   icon: BookOpen },
  { href: "/jeju/restaurants", label: "맛집",        icon: UtensilsCrossed },
];

const ADMIN_NAV: NavItem = {
  href: "/jeju/admin",
  label: "관리",
  icon: Settings,
  adminOnly: true,
};

interface DalkkotHeaderProps {
  isDalkkotAdmin?: boolean;
  userNickname?: string | null;
}

export default function DalkkotHeader({ isDalkkotAdmin = false, userNickname }: DalkkotHeaderProps) {
  const pathname = usePathname();

  const allItems = isDalkkotAdmin ? [...NAV_ITEMS, ADMIN_NAV] : NAV_ITEMS;

  return (
    <header className="sticky top-0 z-50 bg-dalkkot-wood-dark text-dalkkot-cream shadow-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
        {/* 로고 */}
        <Link
          href="/jeju"
          className="flex items-center gap-2 text-dalkkot-cream font-semibold text-lg hover:opacity-90 transition-opacity"
        >
          🌿 달콧
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden sm:flex items-center gap-1">
          {allItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/jeju"
                ? pathname === "/jeju"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-dalkkot-wood-mid text-dalkkot-cream"
                    : "text-dalkkot-cream/80 hover:bg-dalkkot-wood-mid/60 hover:text-dalkkot-cream"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* 우측: 유저 정보 */}
        {userNickname && (
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-dalkkot-wood-mid text-dalkkot-cream text-sm font-bold"
              aria-hidden="true"
            >
              {userNickname[0]}
            </div>
            <span className="text-sm font-medium text-dalkkot-cream/90">{userNickname}</span>
          </div>
        )}

        {/* 모바일 네비게이션은 하단 탭바로 처리 */}
      </div>

      {/* 모바일 하단 탭바 */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-dalkkot-wood-mid bg-dalkkot-wood-dark px-2 py-2">
        {allItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/jeju"
              ? pathname === "/jeju"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
                isActive
                  ? "text-dalkkot-cream"
                  : "text-dalkkot-cream/60 hover:text-dalkkot-cream"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
