"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock, Users } from "lucide-react";
import ReservationCalendar, { type CalendarReservation } from "./ReservationCalendar";
import ReservationModal from "./ReservationModal";
import Toast from "./Toast";

interface Reservation {
  id: string;
  nickname: string;
  check_in: string;
  check_out: string;
  status: string;
  guests?: number;
  color?: string;
}

interface StatsProps {
  total: number;
  confirmed: number;
  pending: number;
  guests: number;
}

interface DashboardClientProps {
  stats: StatsProps;
  villaId: string;
  currentUserId: string;
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "예약 확정",
  pending: "신청 중",
  waiting_deposit: "입금 대기",
  rejected: "거절됨",
  cancelled: "취소됨",
};

const STATUS_CLASS: Record<string, string> = {
  confirmed: "dal-badge dal-badge-confirmed",
  pending: "dal-badge dal-badge-pending",
  waiting_deposit: "dal-badge dal-badge-waiting",
  rejected: "dal-badge dal-badge-rejected",
  cancelled: "dal-badge dal-badge-cancelled",
};

export default function DashboardClient({ stats, villaId, currentUserId }: DashboardClientProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calReservations, setCalReservations] = useState<CalendarReservation[]>([]);
  const [listReservations, setListReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);

  // 모달
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [detailReservation, setDetailReservation] = useState<CalendarReservation | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; status: string; check_in: string }[]>([]);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
  };

  const fetchReservations = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jeju/reservations?year=${y}&month=${m}`);
      if (res.ok) {
        const data: CalendarReservation[] = await res.json();
        setCalReservations(data);
        setListReservations(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations(year, month);
  }, [year, month, fetchReservations]);

  // 상태 변경 알림 감지 (localStorage로 "이미 본" 상태 추적)
  useEffect(() => {
    if (calReservations.length === 0) return;
    const STORAGE_KEY = "dalkkot_notif_seen";
    const seen: Record<string, string> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const alerts = calReservations.filter(
      r => r.user_id === currentUserId &&
           ["waiting_deposit", "confirmed"].includes(r.status) &&
           seen[r.id] !== r.status
    );
    setNotifications(alerts.map(r => ({ id: r.id, status: r.status, check_in: r.check_in })));
  }, [calReservations, currentUserId]);

  const handleClose = () => { setCreateDate(null); setDetailReservation(null); };
  const handleSuccess = () => {
    setCreateDate(null);
    showToast("예약 신청이 완료되었습니다. 관리자 승인을 기다려주세요.");
    fetchReservations(year, month);
  };
  const handleCancelled = () => {
    setDetailReservation(null);
    showToast("예약이 취소되었습니다.", "warning");
    fetchReservations(year, month);
  };
  const handleCheckin = () => {
    setDetailReservation(null);
    showToast("체크인이 완료되었습니다.");
    fetchReservations(year, month);
  };
  const handleCheckout = () => {
    setDetailReservation(null);
    showToast("체크아웃이 완료되었습니다.");
    fetchReservations(year, month);
  };

  const dismissNotification = (id: string, status: string) => {
    const STORAGE_KEY = "dalkkot_notif_seen";
    const seen: Record<string, string> = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    seen[id] = status;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const openReservation = (id: string, status: string) => {
    dismissNotification(id, status);
    const r = calReservations.find(c => c.id === id);
    if (r) setDetailReservation(r);
  };

  return (
    <>
      {/* 히어로 */}
      <div className="dal-hero">
        <div className="dal-hero-bg" />
        <div className="dal-hero-content">
          <h1 className="dal-hero-title">달콧 별장 예약 관리 서비스</h1>
          <p className="dal-hero-sub">편리하게 예약을 관리하세요</p>
          <button
            className="dal-btn dal-btn-primary"
            onClick={() => setCreateDate(now.toISOString().slice(0, 10))}
          >
            + 새 예약 추가
          </button>
        </div>
      </div>

      {/* 상태 변경 알림 배너 */}
      {notifications.length > 0 && (
        <div className="dal-notif-stack">
          {notifications.map(n => (
            <div key={n.id} className={`dal-notif-banner ${n.status === "confirmed" ? "dal-notif-confirmed" : "dal-notif-deposit"}`}>
              <div className="dal-notif-icon">
                {n.status === "confirmed" ? "✅" : "💰"}
              </div>
              <div className="dal-notif-body">
                <div className="dal-notif-title">
                  {n.status === "confirmed" ? "예약이 확정되었습니다!" : "입금 요청이 도착했습니다"}
                </div>
                <div className="dal-notif-desc">
                  {n.check_in} 체크인 예약 &middot;{" "}
                  {n.status === "confirmed"
                    ? "이제 체크인이 가능합니다."
                    : "관리자 계좌로 입금 후 확정을 기다려 주세요."}
                </div>
              </div>
              <button className="dal-notif-action" onClick={() => openReservation(n.id, n.status)}>상세 보기</button>
              <button className="dal-notif-close" onClick={() => dismissNotification(n.id, n.status)} aria-label="닫기">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* 통계 카드 */}
      <div className="dal-stats-grid">
        <div className="dal-stat-card">
          <div className="dal-stat-icon dal-stat-icon-total">
            <CalendarDays size={22} />
          </div>
          <div>
            <div className="dal-stat-number">{stats.total}</div>
            <div className="dal-stat-label">전체 예약</div>
          </div>
        </div>
        <div className="dal-stat-card">
          <div className="dal-stat-icon dal-stat-icon-confirmed">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="dal-stat-number">{stats.confirmed}</div>
            <div className="dal-stat-label">확정 예약</div>
          </div>
        </div>
        <div className="dal-stat-card">
          <div className="dal-stat-icon dal-stat-icon-pending">
            <Clock size={22} />
          </div>
          <div>
            <div className="dal-stat-number">{stats.pending}</div>
            <div className="dal-stat-label">대기 중</div>
          </div>
        </div>
        <div className="dal-stat-card">
          <div className="dal-stat-icon dal-stat-icon-guests">
            <Users size={22} />
          </div>
          <div>
            <div className="dal-stat-number">{stats.guests}</div>
            <div className="dal-stat-label">총 예약 인원</div>
          </div>
        </div>
      </div>

      {/* 대시보드 그리드: 캘린더 + 목록 */}
      <div className="dal-dashboard-grid">
        {/* 캘린더 패널 */}
        <div className="dal-panel">
          <div className="dal-panel-header">
            <h2 className="dal-panel-title">
              <CalendarDays size={16} style={{ color: "#8B5E3C" }} />
              예약 캘린더
            </h2>
            <div className="dal-panel-actions">
              <button className="dal-icon-btn active">◧</button>
              <button className="dal-icon-btn">≡</button>
              <button className="dal-icon-btn" onClick={() => {
                const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
                setYear(prev.y); setMonth(prev.m);
              }}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#1F2937", padding: "0 8px", whiteSpace: "nowrap" }}>
                {year}년 {month}월
              </span>
              <button className="dal-icon-btn" onClick={() => {
                const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
                setYear(next.y); setMonth(next.m);
              }}>›</button>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>불러오는 중…</div>
          ) : (
            <ReservationCalendar
              reservations={calReservations}
              year={year}
              month={month}
              currentUserId={currentUserId}
              onDateClick={(date) => {
                if (date < now.toISOString().slice(0, 10)) return;
                setCreateDate(date);
              }}
              onReservationClick={(r) => setDetailReservation(r)}
              onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
              hideHeader
            />
          )}
        </div>

        {/* 예약 목록 패널 */}
        <div className="dal-panel">
          <div className="dal-panel-header">
            <h2 className="dal-panel-title">
              <span style={{ fontSize: 16 }}>≡</span> 예약 목록
            </h2>
            <div className="dal-panel-actions">
              <button className="dal-icon-btn">◧</button>
              <button className="dal-icon-btn active">≡</button>
              <button className="dal-icon-btn" onClick={() => {
                const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
                setYear(prev.y); setMonth(prev.m);
              }}>‹</button>
              <button className="dal-icon-btn" onClick={() => {
                const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
                setYear(next.y); setMonth(next.m);
              }}>›</button>
            </div>
          </div>
          <table className="dal-table">
            <thead>
              <tr>
                <th>예약자</th>
                <th>체크인</th>
                <th>체크아웃</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listReservations.length === 0 ? (
                <tr><td colSpan={5} className="dal-empty-row">예약이 없습니다.</td></tr>
              ) : (
                listReservations.slice(0, 6).map((r) => (
                  <tr key={r.id} className="dal-tr"
                    onClick={() => {
                      const calR = calReservations.find(c => c.id === r.id);
                      if (calR) setDetailReservation(calR);
                    }}
                  >
                    <td><span className="dal-guest-name">{r.nickname}</span></td>
                    <td>{r.check_in}</td>
                    <td>{r.check_out}</td>
                    <td>
                      <span className={STATUS_CLASS[r.status] ?? "dal-badge"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td><span className="dal-text-muted">›</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="dal-pagination">
            <Link href="/jeju/calendar" className="dal-page-btn">전체 예약 보기 →</Link>
          </div>
        </div>
      </div>

      {/* 모달 */}
      {createDate && (
        <ReservationModal
          mode="create"
          villaId={villaId}
          initialDate={createDate}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      {detailReservation && (
        <ReservationModal
          mode="detail"
          reservation={{
            id: detailReservation.id,
            nickname: detailReservation.nickname,
            check_in: detailReservation.check_in,
            check_out: detailReservation.check_out,
            color: detailReservation.color,
            status: detailReservation.status as import("./StatusBadge").ReservationStatus,
            visit_status: detailReservation.visit_status as import("./StatusBadge").VisitStatus,
            guests: detailReservation.guests,
            notes: detailReservation.notes,
            user_id: detailReservation.user_id,
          }}
          currentUserId={currentUserId}
          onClose={handleClose}
          onCancelled={handleCancelled}
          onCheckin={handleCheckin}
          onCheckout={handleCheckout}
        />
      )}
    </>
  );
}
