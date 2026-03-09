"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Sliders, DatabaseZap } from "lucide-react";

const ADMIN_TABS = [
  { href: "/jeju/admin",          label: "대시보드",     icon: LayoutDashboard },
  { href: "/jeju/admin/history",  label: "히스토리",     icon: History },
  { href: "/jeju/admin/settings", label: "요금·계좌 설정", icon: Sliders },
  { href: "/jeju/admin/migrate",  label: "데이터 이전",   icon: DatabaseZap },
];

export default function AdminSubNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-dalkkot-cream-dark bg-dalkkot-cream/60 backdrop-blur-sm sticky top-14 z-40">
      <div className="mx-auto flex max-w-[1400px] gap-1 px-4 py-1.5">
        {ADMIN_TABS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/jeju/admin"
              ? pathname === "/jeju/admin"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dalkkot-wood-dark text-dalkkot-cream"
                  : "text-dalkkot-wood-mid hover:bg-dalkkot-cream-dark hover:text-dalkkot-wood-dark"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
