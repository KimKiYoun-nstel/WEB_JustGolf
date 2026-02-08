"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export const getUser = async (): Promise<User | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
};

export const onAuthStateChange = (
  cb: (user: User | null) => void
): (() => void) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getUser().then((u) => {
      if (!mounted) return;
      setUser(u);
      setLoading(false);
    });

    const unsubscribe = onAuthStateChange((u) => {
      if (!mounted) return;
      setUser(u);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return { user, loading };
};