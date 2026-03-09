"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Tab = "stats" | "reservations" | "events";

interface UserStat {
  user_id: string;
  nickname: string;
  total: number;
  confirmed: number;
  cancelled: number;
  no_show: number;
  settled: number;
  meter_missing: number;
}

interface HistoryReservation {
  id: string;
  nickname: string;
  check_in: string;
  check_out: string;
  status: string;
  visit_status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  settlement_completed: boolean;
  gas_meter_in:   number | null;
  gas_meter_out:  number | null;
  water_meter_in: number | null;
  water_meter_out: number | null;
  elec_meter_in:  number | null;
  elec_meter_out: number | null;
  settlement_amount: number | null;
  notes: string | null;
}

interface HistoryEvent {
  id: string;
  actor_nickname: string;
  actor_role: string;
  action_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function EventTimeline({ reservationId }: { reservationId: string }) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/jeju/admin/history/${reservationId}/events`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [reservationId]);

  if (loading) return <p className="text-xs text-dalkkot-wood-mid animate-pulse py-2">로딩 중...</p>;
  if (events.length === 0) return <p className="text-xs text-dalkkot-wood-mid/60 py-2">이벤트 없음</p>;

  return (
    <div className="space-y-2 mt-3">
      {events.map((e) => (
        <div key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-2 w-2 rounded-full bg-dalkkot-sage mt-1.5 shrink-0" />
            <div className="flex-1 w-px bg-dalkkot-cream-dark min-h-4" />
          </div>
          <div className="pb-2">
            <p className="text-xs font-medium text-dalkkot-wood-dark">
              {e.action_type}
              <span className="ml-2 font-normal text-dalkkot-wood-mid">by {e.actor_nickname} ({e.actor_role})</span>
            </p>
            <p className="text-xs text-dalkkot-wood-mid/60">
              {new Date(e.created_at).toLocaleString("ko-KR")}
            </p>
            {Object.keys(e.payload ?? {}).length > 0 && (
              <pre className="mt-1 rounded bg-dalkkot-cream px-2 py-1 text-xs text-dalkkot-wood-mid font-mono overflow-x-auto">
                {JSON.stringify(e.payload, null, 2)}
              </pre>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmt(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function ReservationRow({ r }: { r: HistoryReservation }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-dalkkot-cream-dark bg-white overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-dalkkot-cream/50 transition-colors"
      >
        <span className="flex-1 text-sm font-medium text-dalkkot-wood-dark">{r.nickname}</span>
        <span className="text-xs text-dalkkot-wood-mid">{r.check_in} ~ {r.check_out}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          r.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
          r.status === "cancelled" ? "bg-gray-100 text-gray-500" :
          "bg-amber-100 text-amber-700"
        }`}>
          {r.status === "confirmed" ? "확정" : r.status === "cancelled" ? "취소" : r.status === "rejected" ? "거절" : "신청"}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-dalkkot-wood-mid" /> : <ChevronDown className="h-4 w-4 text-dalkkot-wood-mid" />}
      </button>
      {expanded && (
        <div className="border-t border-dalkkot-cream-dark bg-dalkkot-cream/30 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-dalkkot-wood-mid mb-3">
            <span>입실 시간: <strong className="text-dalkkot-wood-dark">{fmt(r.checked_in_at)}</strong></span>
            <span>퇴실 시간: <strong className="text-dalkkot-wood-dark">{fmt(r.checked_out_at)}</strong></span>
            <span>방문 상태: <strong className="text-dalkkot-wood-dark">{r.visit_status}</strong></span>
            <span>정산: <strong className="text-dalkkot-wood-dark">{r.settlement_completed ? `완료 (${r.settlement_amount?.toLocaleString()}원)` : "-"}</strong></span>
          </div>
          {/* 계량기 정보 */}
          <table className="w-full text-xs mb-3" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#9CA3AF" }}>
                <th style={{ textAlign: "left", padding: "3px 6px", fontWeight: 600 }}>항목</th>
                <th style={{ textAlign: "right", padding: "3px 6px" }}>입실</th>
                <th style={{ textAlign: "right", padding: "3px 6px" }}>퇴실</th>
                <th style={{ textAlign: "right", padding: "3px 6px" }}>사용량</th>
              </tr>
            </thead>
            <tbody>
              {([["🔥 가스",  r.gas_meter_in,   r.gas_meter_out,   "㎥"],
                ["⚡ 전기",  r.elec_meter_in,  r.elec_meter_out,  "kWh"],
                ["💧 수도",  r.water_meter_in, r.water_meter_out, "㎥"],
              ] as [string, number | null, number | null, string][]).map(([label, inV, outV, unit]) => (
                <tr key={label} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td style={{ padding: "3px 6px", fontWeight: 600, color: "#374151" }}>{label}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px", color: "#6B7280" }}>{inV != null ? `${inV}${unit}` : "-"}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px", color: "#6B7280" }}>{outV != null ? `${outV}${unit}` : "-"}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>
                    {inV != null && outV != null ? `${(outV - inV).toFixed(1)}${unit}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.notes && (
            <p className="text-xs text-dalkkot-wood-mid/70 italic mb-2">메모: {r.notes}</p>
          )}
          <p className="text-xs font-medium text-dalkkot-wood-dark/70 mb-1">이벤트 로그</p>
          <EventTimeline reservationId={r.id} />
        </div>
      )}
    </div>
  );
}

export default function HistoryClient() {
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<UserStat[]>([]);
  const [reservations, setReservations] = useState<HistoryReservation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (tab === "stats") {
      fetch("/api/jeju/admin/history?type=user_stats")
        .then((r) => r.json())
        .then((data) => setStats(Array.isArray(data) ? data : []))
        .finally(() => setLoading(false));
    } else if (tab === "reservations") {
      fetch("/api/jeju/admin/history?type=reservations")
        .then((r) => r.json())
        .then((data) => setReservations(Array.isArray(data) ? data : data.reservations ?? []))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [tab]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-dalkkot-wood-dark">예약 히스토리</h1>

      {/* 탭 */}
      <div className="flex rounded-xl overflow-hidden border border-dalkkot-cream-dark">
        {(["stats", "reservations"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-dalkkot-wood-dark text-dalkkot-cream"
                : "bg-white text-dalkkot-wood-mid hover:bg-dalkkot-cream"
            }`}
          >
            {t === "stats" ? "👤 사용자별 통계" : "📋 전체 예약"}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-dalkkot-wood-mid animate-pulse py-4 text-center">불러오는 중…</p>}

      {/* 사용자별 통계 */}
      {tab === "stats" && !loading && (
        <div className="overflow-x-auto rounded-xl border border-dalkkot-cream-dark">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="bg-dalkkot-cream border-b border-dalkkot-cream-dark">
                {["닉네임", "총예약", "확정", "취소", "노쇼", "정산완료", "검침미입력"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-dalkkot-wood-dark">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-xs text-dalkkot-wood-mid">데이터 없음</td></tr>
              )}
              {stats.map((s) => (
                <tr key={s.user_id} className="border-b border-dalkkot-cream-dark last:border-0 hover:bg-dalkkot-cream/30">
                  <td className="px-4 py-2.5 font-medium text-dalkkot-wood-dark">{s.nickname}</td>
                  <td className="px-4 py-2.5 text-center">{s.total}</td>
                  <td className="px-4 py-2.5 text-center text-emerald-700">{s.confirmed}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{s.cancelled}</td>
                  <td className="px-4 py-2.5 text-center text-orange-600">{s.no_show}</td>
                  <td className="px-4 py-2.5 text-center text-blue-600">{s.settled}</td>
                  <td className="px-4 py-2.5 text-center text-red-500">{s.meter_missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 전체 예약 (이벤트 로그 포함) */}
      {tab === "reservations" && !loading && (
        <div className="space-y-2">
          {reservations.length === 0 && (
            <p className="py-8 text-center text-sm text-dalkkot-wood-mid">예약 데이터 없음</p>
          )}
          {reservations.map((r) => (
            <ReservationRow key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
