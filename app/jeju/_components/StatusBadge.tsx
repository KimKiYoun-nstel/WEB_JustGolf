import { cn } from "@/lib/utils";

export type ReservationStatus = "pending" | "waiting_deposit" | "confirmed" | "rejected" | "cancelled";
export type VisitStatus = "not_checked" | "checked_in" | "checked_out" | "no_show";

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending:         "검토 대기",
  waiting_deposit: "입금 대기",
  confirmed:       "확정",
  rejected:        "반려",
  cancelled:       "취소",
};

const STATUS_CLASSES: Record<ReservationStatus, string> = {
  pending:         "bg-yellow-100 text-yellow-800",
  waiting_deposit: "bg-orange-100 text-orange-800",
  confirmed:       "bg-green-100 text-green-800",
  rejected:        "bg-red-100 text-red-800",
  cancelled:       "bg-gray-100 text-gray-500",
};

const VISIT_LABELS: Record<VisitStatus, string> = {
  not_checked: "체크인 전",
  checked_in:  "사용 중 🟢",
  checked_out: "체크아웃",
  no_show:     "미방문",
};

const VISIT_CLASSES: Record<VisitStatus, string> = {
  not_checked: "bg-slate-100 text-slate-600",
  checked_in:  "bg-emerald-100 text-emerald-800 font-semibold",
  checked_out: "bg-blue-100 text-blue-700",
  no_show:     "bg-red-100 text-red-700",
};

interface StatusBadgeProps {
  status: ReservationStatus;
  className?: string;
}

interface VisitBadgeProps {
  visitStatus: VisitStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-500",
        className
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function VisitBadge({ visitStatus, className }: VisitBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        VISIT_CLASSES[visitStatus] ?? "bg-gray-100 text-gray-500",
        className
      )}
    >
      {VISIT_LABELS[visitStatus] ?? visitStatus}
    </span>
  );
}
