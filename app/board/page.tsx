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
type FeedbackStatusFilter = "all" | FeedbackStatus;

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

const TITLE_MAX_LENGTH = 50;
const CONTENT_MAX_LENGTH = 500;

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
  if (status === "in_progress") return statusLabelMap.in_review;
  return statusLabelMap[status] ?? status;
}

function getStatusVariant(
  status: Feedback["status"]
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "deleted") return "destructive";
  if (status === "completed") return "default";
  if (status === "in_review" || status === "in_progress") return "secondary";
  return "outline";
}

function normalizeStatus(status: Feedback["status"]): FeedbackStatus {
  return status === "in_progress" ? "in_review" : status;
}

function getStatusBadgeClassName(status: Feedback["status"]): string {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "completed") {
    return "border-emerald-600 bg-emerald-600 text-white";
  }
  if (normalizedStatus === "deleted") {
    return "border-red-600 bg-red-600 text-white";
  }
  return "";
}

function validateFeedbackInput(rawTitle: string, rawContent: string): string | null {
  const trimmedTitle = rawTitle.trim();
  const trimmedContent = rawContent.trim();

  if (!trimmedTitle || !trimmedContent) {
    return "제목과 내용을 입력해주세요.";
  }
  if (trimmedTitle.length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력해주세요.`;
  }
  if (trimmedContent.length > CONTENT_MAX_LENGTH) {
    return `내용은 ${CONTENT_MAX_LENGTH}자 이하로 입력해주세요.`;
  }
  return null;
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
  const [statusFilter, setStatusFilter] = useState<FeedbackStatusFilter>("all");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});

  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<number[]>([]);
  const [editingFeedbackId, setEditingFeedbackId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<FeedbackCategory>("general");

  const [isAdmin, setIsAdmin] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
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

    if (feedbackError || !feedbackRows) {
      setErrorMsg(feedbackError?.message ?? "피드백 목록을 불러오지 못했습니다.");
      return;
    }

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

  const toggleExpanded = (feedbackId: number) => {
    setExpandedFeedbackIds((prev) =>
      prev.includes(feedbackId)
        ? prev.filter((id) => id !== feedbackId)
        : [...prev, feedbackId]
    );
  };

  const openExpanded = (feedbackId: number) => {
    setExpandedFeedbackIds((prev) =>
      prev.includes(feedbackId) ? prev : [...prev, feedbackId]
    );
  };

  const resetEditState = () => {
    setEditingFeedbackId(null);
    setEditTitle("");
    setEditContent("");
    setEditCategory("general");
  };

  const submitFeedback = async () => {
    if (!user?.id) {
      setErrorMsg("로그인이 필요합니다.");
      return;
    }

    const validationMessage = validateFeedbackInput(title, content);
    if (validationMessage) {
      setErrorMsg(validationMessage);
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.from("feedbacks").insert({
      user_id: user.id,
      title: title.trim(),
      content: content.trim(),
      category,
      status: "pending",
    });

    setLoading(false);

    if (error) {
      setErrorMsg(`등록 실패: ${error.message}`);
      return;
    }

    setTitle("");
    setContent("");
    setCategory("general");
    await loadBoardData();
  };

  const startEditFeedback = (feedback: Feedback) => {
    if (!user?.id || feedback.user_id !== user.id) {
      setErrorMsg("본인 글만 수정할 수 있습니다.");
      return;
    }

    setEditingFeedbackId(feedback.id);
    setEditTitle(feedback.title);
    setEditContent(feedback.content);
    setEditCategory(feedback.category);
    setErrorMsg("");
    openExpanded(feedback.id);
  };

  const saveFeedbackEdit = async (feedbackId: number) => {
    if (!user?.id) {
      setErrorMsg("로그인이 필요합니다.");
      return;
    }
    if (editingFeedbackId !== feedbackId) return;

    const validationMessage = validateFeedbackInput(editTitle, editContent);
    if (validationMessage) {
      setErrorMsg(validationMessage);
      return;
    }

    const { error } = await supabase
      .from("feedbacks")
      .update({
        title: editTitle.trim(),
        content: editContent.trim(),
        category: editCategory,
      })
      .eq("id", feedbackId)
      .eq("user_id", user.id);

    if (error) {
      setErrorMsg(`수정 실패: ${error.message}`);
      return;
    }

    setErrorMsg("");
    resetEditState();
    await loadBoardData();
  };

  const updateFeedbackStatus = async (
    feedbackId: number,
    nextStatus: FeedbackStatus
  ) => {
    if (!user?.id) {
      setErrorMsg("로그인이 필요합니다.");
      return;
    }

    const feedback = feedbacks.find((row) => row.id === feedbackId);
    if (!feedback) return;

    const canUpdate = feedback.user_id === user.id || isAdmin;
    if (!canUpdate) {
      setErrorMsg("상태를 변경할 권한이 없습니다.");
      return;
    }

    const { error } = await supabase
      .from("feedbacks")
      .update({ status: nextStatus })
      .eq("id", feedbackId);

    if (error) {
      setErrorMsg(`상태 변경 실패: ${error.message}`);
      return;
    }

    setErrorMsg("");
    await loadBoardData();
  };

  const deleteFeedback = async (feedbackId: number) => {
    if (!user?.id) {
      setErrorMsg("로그인이 필요합니다.");
      return;
    }

    const feedback = feedbacks.find((row) => row.id === feedbackId);
    if (!feedback) return;

    if (!confirm(`"${feedback.title}" 글을 삭제하시겠습니까?`)) {
      return;
    }

    const { error } = await supabase.from("feedbacks").delete().eq("id", feedbackId);

    if (error) {
      setErrorMsg(`삭제 실패: ${error.message}`);
      return;
    }

    setErrorMsg("");
    setExpandedFeedbackIds((prev) => prev.filter((id) => id !== feedbackId));
    if (editingFeedbackId === feedbackId) {
      resetEditState();
    }
    await loadBoardData();
  };

  const addComment = async (feedbackId: number) => {
    if (!user?.id) {
      setErrorMsg("로그인이 필요합니다.");
      return;
    }

    const value = (commentDrafts[feedbackId] ?? "").trim();
    if (!value) {
      setErrorMsg("댓글 내용을 입력해주세요.");
      return;
    }

    const { error } = await supabase.from("feedback_comments").insert({
      feedback_id: feedbackId,
      user_id: user.id,
      content: value,
    });

    if (error) {
      setErrorMsg(`댓글 등록 실패: ${error.message}`);
      return;
    }

    setErrorMsg("");
    setCommentDrafts((prev) => ({ ...prev, [feedbackId]: "" }));
    await loadBoardData();
  };

  const deleteComment = async (commentId: number, feedbackId: number) => {
    if (!user?.id) {
      setErrorMsg("로그인이 필요합니다.");
      return;
    }

    const target = (commentsByFeedbackId[feedbackId] ?? []).find(
      (row) => row.id === commentId
    );
    if (!target) return;

    const canDelete = target.user_id === user.id || isAdmin;
    if (!canDelete) {
      setErrorMsg("댓글을 삭제할 권한이 없습니다.");
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
      setErrorMsg(`댓글 삭제 실패: ${error.message}`);
      return;
    }

    setErrorMsg("");
    await loadBoardData();
  };

  const filteredFeedbacks = feedbacks.filter((feedback) => {
    const categoryMatched = filter === "all" || feedback.category === filter;
    const statusMatched =
      statusFilter === "all" || normalizeStatus(feedback.status) === statusFilter;
    return categoryMatched && statusMatched;
  });

  return (
    <main className="min-h-screen bg-slate-50/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">피드백 게시판</h1>
          <p className="text-sm text-slate-600">
            카드 나열 대신 글/댓글 스레드 방식으로 빠르게 확인할 수 있도록 구성했습니다.
          </p>
        </div>

        {user && (
          <Card className="border-slate-200/70">
            <CardHeader>
              <CardTitle>피드백 작성</CardTitle>
              <CardDescription>제목 최대 50자, 내용 최대 500자입니다.</CardDescription>
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">제목</label>
                  <span className="text-xs text-slate-500">
                    {title.trim().length}/{TITLE_MAX_LENGTH}
                  </span>
                </div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  maxLength={TITLE_MAX_LENGTH}
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">내용</label>
                  <span className="text-xs text-slate-500">
                    {content.trim().length}/{CONTENT_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="내용을 입력하세요"
                  maxLength={CONTENT_MAX_LENGTH}
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

        {errorMsg && <p className="text-sm font-medium text-red-600">{errorMsg}</p>}

        <div className="flex flex-wrap items-center gap-2">
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
          <span className="ml-auto text-xs text-slate-500">
            총 {filteredFeedbacks.length}건
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
          >
            전체상태
          </Button>
          {FEEDBACK_STATUS_FLOW.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={statusFilter === status ? "default" : "outline"}
              onClick={() => setStatusFilter(status)}
            >
              {statusLabelMap[status]}
            </Button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {filteredFeedbacks.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              등록된 피드백이 없습니다.
            </p>
          ) : (
            filteredFeedbacks.map((feedback, index) => {
              const canUpdateStatus =
                !!user && (feedback.user_id === user.id || isAdmin);
              const canDeleteFeedback = !!user && feedback.user_id === user.id;
              const canEditFeedback = !!user && feedback.user_id === user.id;
              const comments = commentsByFeedbackId[feedback.id] ?? [];
              const isExpanded = expandedFeedbackIds.includes(feedback.id);
              const isEditing = editingFeedbackId === feedback.id;
              const normalizedStatus = normalizeStatus(feedback.status);
              const rowStateClassName =
                normalizedStatus === "completed"
                  ? "bg-emerald-50/50"
                  : normalizedStatus === "deleted"
                    ? "bg-red-50/60"
                    : "";

              return (
                <article
                  key={feedback.id}
                  className={[
                    "px-4 py-4 sm:px-5",
                    rowStateClassName,
                    index !== filteredFeedbacks.length - 1
                      ? "border-b border-slate-200"
                      : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => toggleExpanded(feedback.id)}
                      >
                        <h2
                          className={[
                            "truncate text-base font-semibold",
                            normalizedStatus === "deleted"
                              ? "text-slate-500 line-through"
                              : "text-slate-900",
                          ].join(" ")}
                        >
                          {feedback.title}
                        </h2>
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{feedback.nickname}</span>
                        <span>·</span>
                        <span>
                          {new Date(feedback.created_at).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <Badge variant="outline">
                          {categoryLabelMap[feedback.category] ?? feedback.category}
                        </Badge>
                        <Badge
                          variant={getStatusVariant(feedback.status)}
                          className={getStatusBadgeClassName(feedback.status)}
                        >
                          {getStatusLabel(feedback.status)}
                        </Badge>
                        <span>댓글 {comments.length}개</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canEditFeedback && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditFeedback(feedback)}
                        >
                          수정
                        </Button>
                      )}
                      {canDeleteFeedback && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteFeedback(feedback.id)}
                        >
                          삭제
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpanded(feedback.id)}
                      >
                        {isExpanded ? "접기" : "열기"}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                      {isEditing ? (
                        <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/70 p-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-700">
                              카테고리
                            </label>
                            <select
                              className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm"
                              value={editCategory}
                              onChange={(e) =>
                                setEditCategory(e.target.value as FeedbackCategory)
                              }
                            >
                              <option value="general">일반</option>
                              <option value="bug">버그</option>
                              <option value="feature">기능요청</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-slate-700">
                                제목
                              </label>
                              <span className="text-xs text-slate-500">
                                {editTitle.trim().length}/{TITLE_MAX_LENGTH}
                              </span>
                            </div>
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              maxLength={TITLE_MAX_LENGTH}
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-slate-700">
                                내용
                              </label>
                              <span className="text-xs text-slate-500">
                                {editContent.trim().length}/{CONTENT_MAX_LENGTH}
                              </span>
                            </div>
                            <textarea
                              className="min-h-[120px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              maxLength={CONTENT_MAX_LENGTH}
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => void saveFeedbackEdit(feedback.id)}
                            >
                              수정 저장
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resetEditState()}
                            >
                              취소
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                          {feedback.content}
                        </p>
                      )}

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
                            <Button size="sm" onClick={() => void addComment(feedback.id)}>
                              댓글 등록
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
