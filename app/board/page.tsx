"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabaseClient";
import { useAuth } from "../../lib/auth";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";

type FeedbackCategory = "bug" | "feature" | "general";
type FeedbackStatus =
  | "pending"
  | "received"
  | "in_review"
  | "completed"
  | "deleted";

type Feedback = {
  id: number;
  user_id: string;
  title: string;
  content: string;
  category: FeedbackCategory;
  status: FeedbackStatus | "in_progress";
  created_at: string;
  nickname: string;
};

type FeedbackComment = {
  id: number;
  feedback_id: number;
  user_id: string;
  content: string;
  created_at: string;
  nickname: string;
};

const FEEDBACK_STATUS_FLOW: FeedbackStatus[] = [
  "pending",
  "received",
  "in_review",
  "completed",
  "deleted",
];

const categoryLabelMap: Record<FeedbackCategory, string> = {
  general: "일반",
  bug: "버그",
  feature: "기능요청",
};

const statusLabelMap: Record<FeedbackStatus, string> = {
  pending: "대기",
  received: "접수",
  in_review: "확인중",
  completed: "완료",
  deleted: "삭제",
};

function getStatusLabel(status: Feedback["status"]) {
  if (status === "in_progress") return "확인중";
  return statusLabelMap[status] ?? status;
}

function getStatusVariant(
  status: Feedback["status"]
): "default" | "secondary" | "outline" {
  if (status === "completed") return "default";
  if (status === "in_review" || status === "in_progress") return "secondary";
  return "outline";
}

export default function BoardPage() {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [commentsByFeedbackId, setCommentsByFeedbackId] = useState<
    Record<number, FeedbackComment[]>
  >({});

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [filter, setFilter] = useState<"all" | FeedbackCategory>("all");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});

  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadBoardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadBoardData = async () => {
    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("feedbacks")
      .select("id,user_id,title,content,category,status,created_at")
      .order("created_at", { ascending: false });

    if (feedbackError || !feedbackRows) return;

    if (user?.id) {
      const { data: me } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle<{ is_admin: boolean }>();
      setIsAdmin(Boolean(me?.is_admin));
    } else {
      setIsAdmin(false);
    }

    const feedbackIds = feedbackRows.map((row) => row.id);
    const { data: commentRows } =
      feedbackIds.length > 0
        ? await supabase
            .from("feedback_comments")
            .select("id,feedback_id,user_id,content,created_at")
            .in("feedback_id", feedbackIds)
            .order("created_at", { ascending: true })
        : { data: [] };

    const userIds = Array.from(
      new Set(
        [
          ...feedbackRows.map((row) => row.user_id),
          ...(commentRows ?? []).map((row) => row.user_id),
        ].filter(Boolean)
      )
    );

    let nicknameById: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,nickname")
        .in("id", userIds);

      nicknameById = (profiles ?? []).reduce((acc, row) => {
        acc[row.id] = row.nickname ?? "익명";
        return acc;
      }, {} as Record<string, string>);
    }

    const mappedFeedbacks: Feedback[] = feedbackRows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      category: row.category as FeedbackCategory,
      status: row.status as Feedback["status"],
      created_at: row.created_at,
      nickname: nicknameById[row.user_id] ?? "익명",
    }));

    const mappedComments: FeedbackComment[] = (commentRows ?? []).map((row) => ({
      id: row.id,
      feedback_id: row.feedback_id,
      user_id: row.user_id,
      content: row.content,
      created_at: row.created_at,
      nickname: nicknameById[row.user_id] ?? "익명",
    }));

    const grouped = mappedComments.reduce((acc, row) => {
      if (!acc[row.feedback_id]) {
        acc[row.feedback_id] = [];
      }
      acc[row.feedback_id].push(row);
      return acc;
    }, {} as Record<number, FeedbackComment[]>);

    setFeedbacks(mappedFeedbacks);
    setCommentsByFeedbackId(grouped);
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
      return;
    }

    setMsg("피드백이 등록되었습니다.");
    setTitle("");
    setContent("");
    setCategory("general");
    await loadBoardData();
  };

  const updateFeedbackStatus = async (
    feedbackId: number,
    nextStatus: FeedbackStatus
  ) => {
    if (!user?.id) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    const feedback = feedbacks.find((row) => row.id === feedbackId);
    if (!feedback) return;

    const canUpdate = feedback.user_id === user.id || isAdmin;
    if (!canUpdate) {
      setMsg("상태를 변경할 권한이 없습니다.");
      return;
    }

    setMsg("");
    const { error } = await supabase
      .from("feedbacks")
      .update({ status: nextStatus })
      .eq("id", feedbackId);

    if (error) {
      setMsg(`상태 변경 실패: ${error.message}`);
      return;
    }

    setMsg("상태가 변경되었습니다.");
    await loadBoardData();
  };

  const deleteFeedback = async (feedbackId: number) => {
    if (!user?.id) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    const feedback = feedbacks.find((row) => row.id === feedbackId);
    if (!feedback) return;

    if (!confirm(`"${feedback.title}" 글을 삭제하시겠습니까?`)) {
      return;
    }

    const { error } = await supabase.from("feedbacks").delete().eq("id", feedbackId);

    if (error) {
      setMsg(`삭제 실패: ${error.message}`);
      return;
    }

    setMsg("게시글이 삭제되었습니다.");
    await loadBoardData();
  };

  const addComment = async (feedbackId: number) => {
    if (!user?.id) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    const value = (commentDrafts[feedbackId] ?? "").trim();
    if (!value) {
      setMsg("댓글 내용을 입력해주세요.");
      return;
    }

    const { error } = await supabase.from("feedback_comments").insert({
      feedback_id: feedbackId,
      user_id: user.id,
      content: value,
    });

    if (error) {
      setMsg(`댓글 등록 실패: ${error.message}`);
      return;
    }

    setCommentDrafts((prev) => ({ ...prev, [feedbackId]: "" }));
    setMsg("댓글이 등록되었습니다.");
    await loadBoardData();
  };

  const deleteComment = async (commentId: number, feedbackId: number) => {
    if (!user?.id) {
      setMsg("로그인이 필요합니다.");
      return;
    }

    const target = (commentsByFeedbackId[feedbackId] ?? []).find(
      (row) => row.id === commentId
    );
    if (!target) return;

    const canDelete = target.user_id === user.id || isAdmin;
    if (!canDelete) {
      setMsg("댓글을 삭제할 권한이 없습니다.");
      return;
    }

    if (!confirm("댓글을 삭제하시겠습니까?")) {
      return;
    }

    const { error } = await supabase
      .from("feedback_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      setMsg(`댓글 삭제 실패: ${error.message}`);
      return;
    }

    setMsg("댓글이 삭제되었습니다.");
    await loadBoardData();
  };

  const filteredFeedbacks = feedbacks.filter((feedback) => {
    if (filter === "all") return true;
    return feedback.category === filter;
  });

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">피드백 게시판</h1>
          <p className="text-sm text-slate-600">
            버그 신고, 기능 제안, 일반 의견을 남겨주세요.
          </p>
        </div>

        <Card className="border-slate-200/70">
          <CardHeader>
            <CardTitle>피드백 상태 흐름</CardTitle>
            <CardDescription>
              대기 → 접수 → 확인중 → 완료 → 삭제
            </CardDescription>
          </CardHeader>
        </Card>

        {user && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>피드백 작성</CardTitle>
              <CardDescription>개선이 필요한 내용을 자세히 적어주세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">카테고리</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
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

        {msg && (
          <Card className="border-slate-200/70">
            <CardContent className="py-4 text-sm text-slate-700">{msg}</CardContent>
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
            filteredFeedbacks.map((feedback) => {
              const canUpdateStatus =
                !!user && (feedback.user_id === user.id || isAdmin);
              const canDeleteFeedback = !!user && feedback.user_id === user.id;
              const comments = commentsByFeedbackId[feedback.id] ?? [];

              return (
                <Card key={feedback.id} className="border-slate-200/70">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <CardTitle className="text-lg">{feedback.title}</CardTitle>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{feedback.nickname}</span>
                          <span>·</span>
                          <span>
                            {new Date(feedback.created_at).toLocaleDateString("ko-KR", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {categoryLabelMap[feedback.category] ?? feedback.category}
                        </Badge>
                        <Badge variant={getStatusVariant(feedback.status)}>
                          {getStatusLabel(feedback.status)}
                        </Badge>
                        {canDeleteFeedback && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteFeedback(feedback.id)}
                          >
                            삭제
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">
                      {feedback.content}
                    </p>

                    {canUpdateStatus && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">상태 변경</label>
                        <select
                          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                          value={
                            feedback.status === "in_progress"
                              ? "in_review"
                              : feedback.status
                          }
                          onChange={(e) =>
                            void updateFeedbackStatus(
                              feedback.id,
                              e.target.value as FeedbackStatus
                            )
                          }
                        >
                          {FEEDBACK_STATUS_FLOW.map((status) => (
                            <option key={status} value={status}>
                              {statusLabelMap[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
                      <p className="mb-3 text-sm font-medium text-slate-700">
                        댓글 {comments.length}개
                      </p>

                      <div className="space-y-2">
                        {comments.length === 0 ? (
                          <p className="text-xs text-slate-500">첫 댓글을 남겨주세요.</p>
                        ) : (
                          comments.map((comment) => {
                            const canDeleteComment =
                              !!user && (comment.user_id === user.id || isAdmin);
                            return (
                              <div
                                key={comment.id}
                                className="rounded-md border border-slate-200 bg-white p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                                  <span>
                                    {comment.nickname} ·{" "}
                                    {new Date(comment.created_at).toLocaleString("ko-KR")}
                                  </span>
                                  {canDeleteComment && (
                                    <button
                                      type="button"
                                      className="text-red-600 hover:underline"
                                      onClick={() =>
                                        void deleteComment(comment.id, feedback.id)
                                      }
                                    >
                                      삭제
                                    </button>
                                  )}
                                </div>
                                <p className="whitespace-pre-wrap text-sm text-slate-700">
                                  {comment.content}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {user && feedback.status !== "deleted" && (
                        <div className="mt-3 space-y-2">
                          <textarea
                            className="min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                            value={commentDrafts[feedback.id] ?? ""}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [feedback.id]: e.target.value,
                              }))
                            }
                            placeholder="댓글을 입력하세요"
                          />
                          <Button
                            size="sm"
                            onClick={() => void addComment(feedback.id)}
                          >
                            댓글 등록
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
