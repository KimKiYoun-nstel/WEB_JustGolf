"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";

type Feedback = {
  id: number;
  user_id: string;
  title: string;
  content: string;
  category: "bug" | "feature" | "general";
  status: "pending" | "in_progress" | "completed";
  created_at: string;
  nickname?: string;
};

export default function BoardPage() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<"bug" | "feature" | "general">("general");
  const [filter, setFilter] = useState<string>("all");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFeedbacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadFeedbacks = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("feedbacks")
      .select("id,user_id,title,content,category,status,created_at")
      .order("created_at", { ascending: false });

    if (error || !data) return;

    let nicknameById: Record<string, string> = {};
    const userIds = Array.from(
      new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean))
    );

    if (userIds.length > 0 && user?.id) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id,nickname")
        .in("id", userIds);

      if (!profileError && profiles) {
        nicknameById = profiles.reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.nickname ?? "익명";
          return acc;
        }, {});
      }
    }

    const mapped = data.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      category: row.category,
      status: row.status,
      created_at: row.created_at,
      nickname: nicknameById[row.user_id] ?? "익명",
    }));
    setFeedbacks(mapped as Feedback[]);
  };

  const submitFeedback = async () => {
    if (!user?.id) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    if (!title.trim() || !content.trim()) {
      setMsg("제목과 내용을 입력해주세요.");
      return;
    }

    setLoading(true);
    setMsg("");

    const supabase = createClient();
    const { error } = await supabase.from("feedbacks").insert({
      user_id: user.id,
      title: title.trim(),
      content: content.trim(),
      category,
      status: "pending",
    });

    setLoading(false);

    if (error) {
      setMsg(`등록 실패: ${error.message}`);
    } else {
      setMsg("피드백이 등록되었습니다!");
      setTitle("");
      setContent("");
      setCategory("general");
      loadFeedbacks();
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "bug":
        return "버그";
      case "feature":
        return "기능요청";
      case "general":
        return "일반";
      default:
        return cat;
    }
  };

  const getStatusLabel = (stat: string) => {
    switch (stat) {
      case "pending":
        return "대기";
      case "in_progress":
        return "진행중";
      case "completed":
        return "완료";
      default:
        return stat;
    }
  };

  const getStatusVariant = (stat: string): "default" | "secondary" | "outline" => {
    switch (stat) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      default:
        return "outline";
    }
  };

  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (filter === "all") return true;
    return fb.category === filter;
  });

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">피드백 게시판</h1>
          <p className="text-sm text-slate-600">
            버그 신고, 기능 제안, 문의사항을 자유롭게 남겨주세요.
          </p>
        </div>

        {user && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>피드백 작성</CardTitle>
              <CardDescription>
                서비스 개선을 위한 의견을 남겨주세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">카테고리</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as "bug" | "feature" | "general")
                  }
                  disabled={loading}
                >
                  <option value="general">일반</option>
                  <option value="bug">버그</option>
                  <option value="feature">기능요청</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">제목</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">내용</label>
                <textarea
                  className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="내용을 입력하세요"
                  disabled={loading}
                />
              </div>

              <Button onClick={submitFeedback} disabled={loading}>
                {loading ? "등록 중..." : "피드백 등록"}
              </Button>

              {msg && (
                <p
                  className={`text-sm ${
                    msg.includes("실패") ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {msg}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!user && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-6">
              <p className="text-sm text-slate-700">
                피드백을 작성하려면{" "}
                <Link href="/login" className="font-medium text-blue-600 underline">
                  로그인
                </Link>
                이 필요합니다.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            전체
          </Button>
          <Button
            size="sm"
            variant={filter === "general" ? "default" : "outline"}
            onClick={() => setFilter("general")}
          >
            일반
          </Button>
          <Button
            size="sm"
            variant={filter === "bug" ? "default" : "outline"}
            onClick={() => setFilter("bug")}
          >
            버그
          </Button>
          <Button
            size="sm"
            variant={filter === "feature" ? "default" : "outline"}
            onClick={() => setFilter("feature")}
          >
            기능요청
          </Button>
        </div>

        <div className="space-y-4">
          {filteredFeedbacks.length === 0 ? (
            <Card className="border-slate-200/70">
              <CardContent className="py-10 text-center text-slate-500">
                등록된 피드백이 없습니다.
              </CardContent>
            </Card>
          ) : (
            filteredFeedbacks.map((fb) => (
              <Card key={fb.id} className="border-slate-200/70">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <CardTitle className="text-lg">{fb.title}</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{fb.nickname}</span>
                        <span>·</span>
                        <span>
                          {new Date(fb.created_at).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getCategoryLabel(fb.category)}</Badge>
                      <Badge variant={getStatusVariant(fb.status)}>
                        {getStatusLabel(fb.status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {fb.content}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
