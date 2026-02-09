"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 웹서비스의 첫 페이지는 항상 로그인 페이지
    router.replace("/login");
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50/70 flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-slate-500">로그인 페이지로 이동 중...</p>
      </div>
    </main>
  );
}
