"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Tournament = {
  id: number;
  title: string;
  event_date: string;
  course_name: string | null;
  location: string | null;
  status: string;
};

export default function Home() {
  const [rows, setRows] = useState<Tournament[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("id,title,event_date,course_name,location,status")
        .order("event_date", { ascending: false });

      if (error) setError(error.message);
      else setRows((data ?? []) as Tournament[]);
    })();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>월례 골프 대회</h1>
        <Link href="/login">로그인</Link>
      </div>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      <ul>
        {rows.map((t) => (
          <li key={t.id} style={{ marginBottom: 8 }}>
            <Link href={`/t/${t.id}`}>
              {t.title} / {t.event_date} / {t.course_name ?? "-"} / {t.status}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
