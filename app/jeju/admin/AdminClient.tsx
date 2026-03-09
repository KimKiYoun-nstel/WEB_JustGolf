"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReservationStatus, VisitStatus } from "../_components/StatusBadge";
import Toast from "../_components/Toast";

interface Reservation {
  id: string;
  nickname: string;
  real_name: string;
  phone: string;
  check_in: string;
  check_out: string;
  status: ReservationStatus;
  visit_status: VisitStatus;
  checked_in_at: string | null;
  checked_out_at: string | null;
  guests: number;
  notes: string | null;
  gas_meter_in:   number | null;
  gas_meter_out:  number | null;
  water_meter_in: number | null;
  water_meter_out: number | null;
  elec_meter_in:  number | null;
  elec_meter_out: number | null;
  settlement_completed: boolean;
  settlement_amount: number | null;
}

interface BillingSettings {
  gas_rate: number;
  water_rate: number;
  elec_rate: number;
  bank_name: string | null;
  bank_account: string | null;
  bank_holder: string | null;
}

function fmt(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function MeterDetail({ r, billing }: { r: Reservation; billing: BillingSettings | null }) {
  const gasUsage   = r.gas_meter_in   != null && r.gas_meter_out   != null ? r.gas_meter_out   - r.gas_meter_in   : null;
  const waterUsage = r.water_meter_in != null && r.water_meter_out != null ? r.water_meter_out - r.water_meter_in : null;
  const elecUsage  = r.elec_meter_in  != null && r.elec_meter_out  != null ? r.elec_meter_out  - r.elec_meter_in  : null;
  const total = billing
    ? Math.round(
        (gasUsage   ?? 0) * (billing.gas_rate   ?? 0) +
        (waterUsage ?? 0) * (billing.water_rate ?? 0) +
        (elecUsage  ?? 0) * (billing.elec_rate  ?? 0)
      )
    : 0;

  return (
    <div style={{ padding: "10px 12px", background: "#F9FAFB", borderTop: "1px solid #E5E7EB" }}>
      {/* 체크인/아웃 시간 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, marginBottom: 2 }}>입실 시간</div>
          <div style={{ fontSize: 12, color: "#374151" }}>{fmt(r.checked_in_at)}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, marginBottom: 2 }}>퇴실 시간</div>
          <div style={{ fontSize: 12, color: "#374151" }}>{fmt(r.checked_out_at)}</div>
        </div>
      </div>
      {/* 계량기 테이블 */}
      <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "#9CA3AF" }}>
            <th style={{ textAlign: "left", padding: "3px 6px", fontWeight: 600 }}>항목</th>
            <th style={{ textAlign: "right", padding: "3px 6px" }}>입실</th>
            <th style={{ textAlign: "right", padding: "3px 6px" }}>퇴실</th>
            <th style={{ textAlign: "right", padding: "3px 6px" }}>사용량</th>
            <th style={{ textAlign: "right", padding: "3px 6px" }}>금액</th>
          </tr>
        </thead>
        <tbody>
          {[[
            "🔥 가스", r.gas_meter_in, r.gas_meter_out, gasUsage, billing?.gas_rate, "㎥",
          ],[
            "⚡ 전기", r.elec_meter_in, r.elec_meter_out, elecUsage, billing?.elec_rate, "kWh",
          ],[
            "💧 수도", r.water_meter_in, r.water_meter_out, waterUsage, billing?.water_rate, "㎥",
          ]].map(([label, inVal, outVal, usage, rate, unit]) => (
            <tr key={label as string} style={{ borderTop: "1px solid #F3F4F6" }}>
              <td style={{ padding: "4px 6px", fontWeight: 600, color: "#374151" }}>{label as string}</td>
              <td style={{ textAlign: "right", padding: "4px 6px", color: "#6B7280" }}>{inVal != null ? `${inVal}${unit}` : "-"}</td>
              <td style={{ textAlign: "right", padding: "4px 6px", color: "#6B7280" }}>{outVal != null ? `${outVal}${unit}` : "-"}</td>
              <td style={{ textAlign: "right", padding: "4px 6px", color: usage != null ? "#374151" : "#9CA3AF" }}>
                {usage != null ? `${(usage as number).toFixed(1)}${unit}` : "-"}
              </td>
              <td style={{ textAlign: "right", padding: "4px 6px", color: "#B45309", fontWeight: 600 }}>
                {usage != null && rate ? `${Math.round((usage as number) * (rate as number)).toLocaleString()}원` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>총 후불 정산</span>
          <strong style={{ fontSize: 15, color: "#B45309" }}>{total.toLocaleString()}원</strong>
        </div>
      )}
      {billing?.bank_account && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: "#F0FDF4", borderRadius: 6, fontSize: 12, color: "#166534" }}>
          💳 {billing.bank_name} {billing.bank_account}{billing.bank_holder ? ` (${billing.bank_holder})` : ""}
        </div>
      )}
    </div>
  );
}

export default function AdminClient() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resLoading, setResLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);
  const [billing, setBilling] = useState<BillingSettings | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
  };

  const loadReservations = useCallback(async () => {
    setResLoading(true);
    const res = await fetch(
      `/api/jeju/admin/history?type=reservations&status=${statusFilter === "all" ? "" : statusFilter}`
    );
    if (res.ok) {
      const data = await res.json();
      setReservations(Array.isArray(data) ? data : data.reservations ?? []);
    }
    setResLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    fetch("/api/jeju/admin/billing-settings")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setBilling(d));
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="dal-page-header">
        <h1 className="dal-page-title">
          <span style={{ color: "#8B5E3C" }}>☰</span> 관리자 패널
        </h1>
      </div>

      {/* 관리자 현황 요약 */}
      <div className="dal-admin-summary">
        {([
          { label: "신규 신청", value: reservations.filter(r => r.status === "pending").length, color: "#E65100" },
          { label: "입금 대기", value: reservations.filter(r => r.status === "waiting_deposit").length, color: "#1565C0" },
          { label: "오늘 체크인", value: reservations.filter(r => r.check_in === today && r.status === "confirmed" && !r.checked_in_at).length, color: "#2E7D32" },
          { label: "체크인 중", value: reservations.filter(r => r.visit_status === "checked_in").length, color: "#6A1B9A" },
        ] as { label: string; value: number; color: string }[]).map(({ label, value, color }) => (
          <div key={label} className={`dal-admin-summary-item${value > 0 ? " active" : ""}`}>
            <span className="dal-admin-summary-count" style={{ color }}>{value}</span>
            <span className="dal-admin-summary-label">{label}</span>
          </div>
        ))}
      </div>

      {/* 대기 중인 예약 패널 */}
      <div className="dal-panel" style={{ marginBottom: 20 }}>
        <div className="dal-panel-header">
          <div>
            <h2 className="dal-panel-title">
              <span style={{ color: "#FF9800" }}>⏱</span> 대기 중인 예약
              {reservations.filter(r => r.status === "pending" || r.status === "waiting_deposit").length > 0 && (
                <span className="dal-badge-count">
                  {reservations.filter(r => r.status === "pending" || r.status === "waiting_deposit").length}
                </span>
              )}
            </h2>
            <p className="dal-panel-subtitle">대기 중인 예약들을 검토하고 관리하세요.</p>
          </div>
        </div>
        <div className="dal-panel-actions-bar">
          {["all", "pending", "waiting_deposit", "confirmed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`dal-icon-btn${statusFilter === s ? " active" : ""}`}
              style={{ width: "auto", padding: "0 10px", fontSize: 11 }}
            >
              {s === "all" ? "전체" : s === "pending" ? "신청" : s === "waiting_deposit" ? "입금대기" : "확정"}
            </button>
          ))}
        </div>
        <table className="dal-table">
          <thead>
            <tr>
              <th>예약자</th>
              <th>연락처</th>
              <th>체크인</th>
              <th>인원</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {resLoading ? (
              <tr><td colSpan={5} className="dal-empty-row">불러오는 중…</td></tr>
            ) : reservations.filter(r => ["pending", "waiting_deposit"].includes(r.status)).length === 0 ? (
              <tr><td colSpan={5} className="dal-empty-row">대기 중인 예약이 없습니다.</td></tr>
            ) : (
              reservations.filter(r => ["pending", "waiting_deposit"].includes(r.status)).map((r) => (
                <tr key={r.id} className="dal-tr">
                  <td><span className="dal-guest-name">{r.nickname}</span>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.real_name}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{r.phone}</td>
                  <td style={{ fontSize: 12 }}>{r.check_in}</td>
                  <td style={{ fontSize: 12 }}>{r.guests}명</td>
                  <td>
                    <div className="dal-action-btns">
                      {r.status === "pending" && (
                        <button className="dal-btn dal-btn-confirm dal-btn-sm" onClick={async () => {
                          const res = await fetch(`/api/jeju/reservations/${r.id}/status`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "waiting_deposit" }),
                          });
                          if (res.ok) showToast("입금 대기 상태로 변경되었습니다. 예약자에게 직접 계좌정보를 안내해 주세요.");
                          else showToast("처리 중 오류가 발생했습니다.", "error");
                          loadReservations();
                        }}>✓ 입금 요청</button>
                      )}
                      {r.status === "waiting_deposit" && (
                        <button className="dal-btn dal-btn-confirm dal-btn-sm" onClick={async () => {
                          const res = await fetch(`/api/jeju/reservations/${r.id}/status`, {
                            method: "PATCH", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "confirmed" }),
                          });
                          if (res.ok) showToast("예약이 확정되었습니다.");
                          else showToast("처리 중 오류가 발생했습니다.", "error");
                          loadReservations();
                        }}>✓ 예약 확정</button>
                      )}
                      <button className="dal-btn dal-btn-reject dal-btn-sm" onClick={async () => {
                        const res = await fetch(`/api/jeju/reservations/${r.id}/status`, {
                          method: "PATCH", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "rejected" }),
                        });
                        if (res.ok) showToast("예약이 반려되었습니다.", "warning");
                        else showToast("처리 중 오류가 발생했습니다.", "error");
                        loadReservations();
                      }}>✕ 예약 반려</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 확정 예약 목록 패널 */}
      <div className="dal-panel">
        <div className="dal-panel-header">
          <h2 className="dal-panel-title">
            <span style={{ color: "#4CAF50" }}>✓</span> 예약 확정 목록
          </h2>
        </div>
        <div className="dal-panel-actions-bar">
          <button className="dal-icon-btn">◧</button>
          <button className="dal-icon-btn">≡</button>
        </div>
        <table className="dal-table">
          <thead>
            <tr>
              <th>예약자</th>
              <th>체크인</th>
              <th>체크아웃</th>
              <th>인원</th>
              <th>상태</th>
              <th>방문</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {resLoading ? (
              <tr><td colSpan={7} className="dal-empty-row">불러오는 중…</td></tr>
            ) : reservations.filter(r => r.status === "confirmed").length === 0 ? (
              <tr><td colSpan={7} className="dal-empty-row">확정된 예약이 없습니다.</td></tr>
            ) : (
              reservations.filter(r => r.status === "confirmed").flatMap((r) => {
                const isExpanded = expandedRow === r.id;
                const checkinTime = r.checked_in_at ? fmt(r.checked_in_at) : null;
                const checkoutTime = r.checked_out_at ? fmt(r.checked_out_at) : null;
                return [
                  <tr key={r.id} className="dal-tr" style={{ cursor: "pointer" }}
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}>
                    <td>
                      <span className="dal-guest-name">{r.nickname}</span>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{r.real_name}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div>{r.check_in}</div>
                      {checkinTime && <div style={{ fontSize: 10, color: "#9CA3AF" }}>{checkinTime}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div>{r.check_out}</div>
                      {checkoutTime && <div style={{ fontSize: 10, color: "#9CA3AF" }}>{checkoutTime}</div>}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.guests}명</td>
                    <td><span className="dal-badge dal-badge-confirmed">예약 확정</span></td>
                    <td>
                      <span className={`dal-badge ${
                        r.visit_status === "checked_in" ? "dal-badge-confirmed" :
                        r.visit_status === "checked_out" ? "dal-badge-waiting" :
                        r.visit_status === "no_show" ? "dal-badge-rejected" : ""
                      }`} style={{ fontSize: 10 }}>
                        {r.visit_status === "checked_in" ? "입실 중" :
                         r.visit_status === "checked_out" ? "퇴실" :
                         r.visit_status === "no_show" ? "노쇼" : "-"}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {isExpanded ? <ChevronUp size={14} color="#9CA3AF" /> : <ChevronDown size={14} color="#9CA3AF" />}
                    </td>
                  </tr>,
                  ...(isExpanded ? [
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <MeterDetail r={r} billing={billing} />
                      </td>
                    </tr>
                  ] : [])
                ];
              })
            )}
          </tbody>
        </table>
        <div className="dal-pagination">
          <button className="dal-page-btn">이전</button>
          <button className="dal-page-btn active">1</button>
          <button className="dal-page-btn">다음</button>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
