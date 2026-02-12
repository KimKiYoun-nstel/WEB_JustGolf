"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompleteProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/onboarding");
  }, [router]);

  return null;
}
