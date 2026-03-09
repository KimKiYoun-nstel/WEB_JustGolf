"use client";

import { useState, useCallback, useEffect } from "react";
import ReservationCalendar, { type CalendarReservation } from "../_components/ReservationCalendar";
import ReservationModal from "../_components/ReservationModal";
import Toast from "../_components/Toast";

interface CalendarClientProps {
  currentUserId: string;
  villaId: string;
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "예약 확정", pending: "신청 중", waiting_deposit: "입금 대기",
  rejected: "거절됨", cancelled: "취소됨",
};
const STATUS_CLASS: Record<string, string> = {
  confirmed: "dal-badge dal-badge-confirmed", pending: "dal-badge dal-badge-pending",
  waiting_deposit: "dal-badge dal-badge-waiting", rejected: "dal-badge dal-badge-rejected",
  cancelled: "dal-badge dal-badge-cancelled",
};

export default function CalendarClient({ currentUserId, villaId }: CalendarClientProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [loading, setLoading] = useState(false);

  // 모달 state
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [detailReservation, setDetailReservation] = useState<CalendarReservation | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
  };

  const fetchReservations = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jeju/reservations?year=${y}&month=${m}`);
      if (res.ok) {
        const data = await res.json();
        setReservations(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations(year, month);
  }, [year, month, fetchReservations]);

  const handleMonthChange = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  const handleDateClick = (date: string) => {
    // 오늘 이전 날짜는 신청 불가
    if (date < new Date().toISOString().slice(0, 10)) return;
    setCreateDate(date);
  };

  const handleReservationClick = (r: CalendarReservation) => {
    setDetailReservation(r);
  };

  const handleClose = () => {
    setCreateDate(null);
    setDetailReservation(null);
  };

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

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="dal-page-header">
        <h1 className="dal-page-title">
          <span style={{ color: "#8B5E3C" }}>📅</span> 예약 캘린더
        </h1>
        <button className="dal-btn dal-btn-primary" onClick={() => setCreateDate(new Date().toISOString().slice(0, 10))}>
          + 새 예약 추가
        </button>
      </div>

      {/* 캘린더 패널 */}
      <div className="dal-panel">
        <div className="dal-panel-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="dal-icon-btn" onClick={() => {
              const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
              handleMonthChange(prev.y, prev.m);
            }}>‹</button>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", minWidth: 120, textAlign: "center" }}>
              {year}년 {month}월
            </span>
            <button className="dal-icon-btn" onClick={() => {
              const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
              handleMonthChange(next.y, next.m);
            }}>›</button>
          </div>
          <div className="dal-panel-actions">
            {loading && <span style={{ fontSize: 12, color: "#9CA3AF" }}>불러오는 중…</span>}
          </div>
        </div>
        <div style={{ padding: "0 4px 4px" }}>
          <ReservationCalendar
            reservations={reservations}
            year={year}
            month={month}
            currentUserId={currentUserId}
            onDateClick={handleDateClick}
            onReservationClick={handleReservationClick}
            onMonthChange={handleMonthChange}
            hideHeader
          />
        </div>
      </div>

      {/* 이번 달 예약 목록 패널 */}
      <div className="dal-panel" style={{ marginTop: 20 }}>
        <div className="dal-panel-header">
          <h2 className="dal-panel-title">
            <span style={{ fontSize: 16 }}>≡</span> 이번 달 예약
          </h2>
        </div>
        <table className="dal-table">
          <thead>
            <tr>
              <th>예약자</th>
              <th>체크인</th>
              <th>체크아웃</th>
              <th>인원</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 ? (
              <tr><td colSpan={6} className="dal-empty-row">이번 달 예약이 없습니다.</td></tr>
            ) : (
              reservations.map((r) => (
                <tr key={r.id} className="dal-tr" onClick={() => handleReservationClick(r)}>
                  <td><span className="dal-guest-name">{r.nickname}</span></td>
                  <td>{r.check_in}</td>
                  <td>{r.check_out}</td>
                  <td>{r.guests != null ? `${r.guests}명` : "-"}</td>
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
          <button className="dal-page-btn active">1</button>
        </div>
      </div>

      {/* 신규 예약 모달 */}
      {createDate && (
        <ReservationModal
          mode="create"
          villaId={villaId}
          initialDate={createDate}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      )}

      {/* 상세 보기 모달 */}
      {detailReservation && (
        <ReservationModal
          mode="detail"
          reservation={{
            id: detailReservation.id,
            nickname: detailReservation.nickname,
            check_in: detailReservation.check_in,
            check_out: detailReservation.check_out,
            color: detailReservation.color,
            status: detailReservation.status as import("../_components/StatusBadge").ReservationStatus,
            visit_status: detailReservation.visit_status as import("../_components/StatusBadge").VisitStatus,
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
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
