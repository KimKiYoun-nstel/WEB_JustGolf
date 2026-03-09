"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft } from "lucide-react";
import { StatusBadge, VisitBadge, type ReservationStatus, type VisitStatus } from "./StatusBadge";

const COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#E91E63", "#00BCD4", "#FF5722", "#607D8B"];

const RULES_NOTE = "퇴실 시 보일러 20도 설정 후 퇴실카톡 필수 · 화장실에 물티슈 사용 불가 · 커피는 일리(illy) 캡슐만 사용 가능 · 셀프 청소, 공과금 후불 정산";
const CHECKOUT_RULES = [
  "보일러 20도 설정 후 퇴실카톡 필수",
  "화장실에 물티슈 사용 불가",
  "커피는 일리(illy) 캡슐만 사용 가능",
  "셀프 청소 후 퇴실",
  "공과금은 후불 정산 (이번 입력값으로 계산)",
];

const MONTH_NAMES = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const WEEK_DAYS   = ["월","화","수","목","금","토","일"];

interface MeterApiData {
  current: {
    gas_meter_in:   number | null;
    gas_meter_out:  number | null;
    water_meter_in: number | null;
    water_meter_out: number | null;
    elec_meter_in:  number | null;
    elec_meter_out: number | null;
  };
  prev_out: { gas: number | null; water: number | null; elec: number | null } | null;
  billing: {
    gas_rate:     number;
    water_rate:   number;
    elec_rate:    number;
    bank_name:    string | null;
    bank_account: string | null;
    bank_holder:  string | null;
  };
}

function MiniCalendar({ checkIn, checkOut, color }: { checkIn: string; checkOut: string; color: string }) {
  const ci = new Date(checkIn);
  const year = ci.getFullYear();
  const monthIdx = ci.getMonth();
  const firstDow = new Date(year, monthIdx, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  const toDs = (d: number) => `${year}-${pad(monthIdx + 1)}-${pad(d)}`;
  return (
    <div className="dal-detail-calendar">
      <div className="dal-detail-cal-title">📅 {year}년 {MONTH_NAMES[monthIdx]} 예약 현황</div>
      <table className="dal-mini-cal-table">
        <thead><tr>{WEEK_DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (!day) return <td key={di} />;
                const ds = toDs(day);
                const highlighted = ds >= checkIn && ds <= checkOut;
                return <td key={di} style={highlighted ? { background: color, color: "white", borderRadius: 4, fontWeight: 700 } : undefined}>{day}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Props ──
interface ReservationCreateModalProps {
  mode: "create";
  villaId: string;
  initialDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}
interface ReservationDetailModalProps {
  mode: "detail";
  reservation: {
    id: string;
    nickname: string;
    check_in: string;
    check_out: string;
    color?: string;
    status: ReservationStatus;
    visit_status: VisitStatus;
    checked_in_at?: string;
    checked_out_at?: string;
    guests?: number;
    notes?: string;
    user_id?: string | null;
  };
  currentUserId: string;
  onClose: () => void;
  onCancelled: () => void;
  onCheckin: () => void;
  onCheckout: () => void;
}
type ModalProps = ReservationCreateModalProps | ReservationDetailModalProps;
type ModalStep = "detail" | "checkin_meter" | "checkout_meter";

// ── 계량기 입력 행 ──
function MeterInputRow({
  label, unit, inputValue, onChange, refValue, rate,
}: {
  label: string; unit: string; inputValue: string; onChange: (v: string) => void;
  refValue?: number | null; rate?: number;
}) {
  const usage = inputValue && refValue != null ? parseFloat(inputValue) - refValue : null;
  const cost  = usage != null && rate ? usage * rate : null;
  return (
    <div className="dal-meter-row">
      <div className="dal-meter-label">{label}</div>
      <div className="dal-meter-input-wrap">
        <input
          type="number" step="0.1" min="0"
          className="dal-form-input dal-meter-input"
          placeholder="0.0"
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="dal-meter-unit">{unit}</span>
      </div>
      {usage != null && usage >= 0 && (
        <div className="dal-meter-calc">
          사용 {usage.toFixed(1)}{unit}
          {cost != null && cost > 0 && <span className="dal-meter-cost"> → 약 {Math.round(cost).toLocaleString()}원</span>}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──
export default function ReservationModal(props: ModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [agreed, setAgreed]   = useState(false);

  // create form
  const [checkIn, setCheckIn]   = useState(props.mode === "create" ? (props.initialDate ?? "") : "");
  const [checkOut, setCheckOut] = useState("");
  const [realName, setRealName] = useState("");
  const [phone, setPhone]       = useState("");
  const [guests, setGuests]     = useState(2);
  const [color, setColor]       = useState(COLORS[0]);
  const [notes, setNotes]       = useState("");

  // detail step
  const [step, setStep]           = useState<ModalStep>("detail");
  const [meterData, setMeterData] = useState<MeterApiData | null>(null);
  const [meterLoading, setMeterLoading] = useState(false);

  // 계량기 입력값
  const [gasIn,   setGasIn]   = useState("");
  const [waterIn, setWaterIn] = useState("");
  const [elecIn,  setElecIn]  = useState("");
  const [gasOut,   setGasOut]   = useState("");
  const [waterOut, setWaterOut] = useState("");
  const [elecOut,  setElecOut]  = useState("");

  // 체크인 지정 시 체크아웃 자동 +1일
  useEffect(() => {
    if (checkIn && !checkOut) {
      const d = new Date(checkIn);
      d.setDate(d.getDate() + 1);
      setCheckOut(d.toISOString().slice(0, 10));
    }
  }, [checkIn, checkOut]);

  const nights = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000))
    : 0;

  // ESC 닫기
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step !== "detail") setStep("detail");
        else props.onClose();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [props, step]);

  // 계량기 데이터 조회
  const loadMeterData = useCallback(async (resId: string) => {
    setMeterLoading(true);
    try {
      const res = await fetch(`/api/jeju/reservations/${resId}/meters`);
      if (res.ok) setMeterData(await res.json());
    } finally {
      setMeterLoading(false);
    }
  }, []);

  const handleCheckinClick = async () => {
    if (props.mode !== "detail") return;
    await loadMeterData(props.reservation.id);
    setStep("checkin_meter");
  };

  const handleCheckoutClick = async () => {
    if (props.mode !== "detail") return;
    await loadMeterData(props.reservation.id);
    setStep("checkout_meter");
  };

  // 신규 예약 제출
  const handleSubmit = async () => {
    if (props.mode !== "create") return;
    if (!checkIn || !checkOut || !realName || !phone) {
      setError("필수 항목을 모두 입력해주세요."); return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      setError("체크아웃은 체크인 이후 날짜여야 합니다."); return;
    }
    if (!agreed) { setError("이용 수칙에 동의해주세요."); return; }
    setLoading(true); setError(null);
    const res = await fetch("/api/jeju/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ villa_id: props.villaId, check_in: checkIn, check_out: checkOut, real_name: realName, phone, guests, notes, color }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "오류가 발생했습니다."); return; }
    props.onSuccess();
  };

  // 예약 취소
  const handleCancel = async () => {
    if (props.mode !== "detail") return;
    setLoading(true); setError(null);
    const res = await fetch(`/api/jeju/reservations/${props.reservation.id}`, { method: "DELETE" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "오류가 발생했습니다."); return; }
    props.onCancelled();
  };

  // 체크인 제출
  const submitCheckin = async () => {
    if (props.mode !== "detail") return;
    setLoading(true); setError(null);
    const body: Record<string, unknown> = { action: "checkin" };
    if (gasIn)   body.gas_meter_in   = parseFloat(gasIn);
    if (waterIn) body.water_meter_in = parseFloat(waterIn);
    if (elecIn)  body.elec_meter_in  = parseFloat(elecIn);
    const res = await fetch(`/api/jeju/reservations/${props.reservation.id}/visit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "체크인 처리 중 오류가 발생했습니다."); return; }
    props.onCheckin();
  };

  // 체크아웃 제출
  const submitCheckout = async () => {
    if (props.mode !== "detail") return;
    if (!gasOut || !waterOut || !elecOut) {
      setError("가스/전기/수도 계량기 값을 모두 입력해주세요."); return;
    }
    setLoading(true); setError(null);
    const res = await fetch(`/api/jeju/reservations/${props.reservation.id}/visit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "checkout",
        gas_meter_out:   parseFloat(gasOut),
        water_meter_out: parseFloat(waterOut),
        elec_meter_out:  parseFloat(elecOut),
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "체크아웃 처리 중 오류가 발생했습니다."); return; }
    props.onCheckout();
  };

  const detailNights = props.mode === "detail"
    ? Math.round((new Date(props.reservation.check_out).getTime() - new Date(props.reservation.check_in).getTime()) / 86_400_000)
    : 0;

  // 체크아웃 단계 후불 금액 계산
  const billing = meterData?.billing;
  const gasUsage   = gasOut   && meterData?.current?.gas_meter_in   != null ? parseFloat(gasOut)   - meterData.current.gas_meter_in   : null;
  const waterUsage = waterOut && meterData?.current?.water_meter_in != null ? parseFloat(waterOut) - meterData.current.water_meter_in : null;
  const elecUsage  = elecOut  && meterData?.current?.elec_meter_in  != null ? parseFloat(elecOut)  - meterData.current.elec_meter_in  : null;
  const totalAmount = billing
    ? Math.round(
        (gasUsage   ?? 0) * (billing.gas_rate   ?? 0) +
        (waterUsage ?? 0) * (billing.water_rate ?? 0) +
        (elecUsage  ?? 0) * (billing.elec_rate  ?? 0)
      )
    : 0;

  // ── 헤더 타이틀 ──
  const titleMap: Record<ModalStep, string> = {
    detail: props.mode === "create" ? "📅 새 예약 추가" : "📋 예약 전체 정보",
    checkin_meter: "📊 입실 계량기 현황",
    checkout_meter: "🏠 퇴실 계량기 입력",
  };

  return (
    <div
      className="dal-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) { if (step !== "detail") setStep("detail"); else props.onClose(); } }}
    >
      <div className={`dal-modal${props.mode === "detail" ? " dal-modal-wide" : ""}`}>

        {/* ── 헤더 ── */}
        <div className="dal-modal-header">
          {step !== "detail" && (
            <button onClick={() => setStep("detail")} className="dal-modal-back" aria-label="뒤로">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <h2 className="dal-modal-title">{titleMap[step]}</h2>
          <button onClick={props.onClose} className="dal-modal-close" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── 바디 ── */}
        <div className="dal-modal-body">

          {/* ════ 신규 예약 폼 ════ */}
          {props.mode === "create" && (
            <div className="dal-form-grid">
              <div className="dal-form-group">
                <label className="dal-form-label">예약자 이름 *</label>
                <input type="text" className="dal-form-input" placeholder="홍길동"
                  value={realName} onChange={(e) => setRealName(e.target.value)} />
              </div>
              <div className="dal-form-group">
                <label className="dal-form-label">연락처 *</label>
                <input type="tel" className="dal-form-input" placeholder="010-0000-0000"
                  value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="dal-form-group">
                <label className="dal-form-label">체크인 날짜 *</label>
                <input type="date" className="dal-form-input" value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div className="dal-form-group">
                <label className="dal-form-label">체크아웃 날짜 *</label>
                <input type="date" className="dal-form-input" value={checkOut}
                  min={checkIn || undefined} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
              <div className="dal-form-group">
                <label className="dal-form-label">예약 인원 *</label>
                <select className="dal-form-select" value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}>
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}명</option>)}
                </select>
              </div>
              <div className="dal-form-group">
                <label className="dal-form-label">달력 표시 색상</label>
                <div className="dal-color-picker">
                  {COLORS.map((c) => (
                    <div key={c} className={`dal-color-swatch${color === c ? " selected" : ""}`}
                      style={{ background: c }} onClick={() => setColor(c)}
                      role="radio" aria-checked={color === c} tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setColor(c); }} />
                  ))}
                </div>
              </div>
              <div className="dal-form-group span-2">
                <label className="dal-form-label">예약일 범위</label>
                <div className="dal-date-range-display">
                  <span className="dal-date-range-val">{checkIn || "날짜 선택"}</span>
                  <span className="dal-date-range-arrow">→</span>
                  <span className="dal-date-range-val">{checkOut || "날짜 선택"}</span>
                  {nights > 0 && <span className="dal-range-nights">({nights}박)</span>}
                </div>
              </div>
              <div className="dal-form-group span-2">
                <label className="dal-form-label">비고 / 요청사항</label>
                <textarea rows={3} className="dal-form-textarea"
                  placeholder="특별 요청사항이 있으시면 입력해주세요."
                  value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="dal-form-group span-2">
                <div className="dal-rules-note">📋 <strong>이용 수칙:</strong> {RULES_NOTE}</div>
                <label className="dal-rules-agree">
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                  이용 수칙을 확인하고 동의합니다.
                </label>
              </div>
            </div>
          )}

          {/* ════ 예약 상세 보기 ════ */}
          {props.mode === "detail" && step === "detail" && (
            <>
              <div className="dal-detail-guest-card">
                <div className="dal-detail-avatar">{props.reservation.nickname[0]}</div>
                <div style={{ flex: 1 }}>
                  <div className="dal-detail-name">{props.reservation.nickname}</div>
                </div>
                <div className="dal-detail-status">
                  <StatusBadge status={props.reservation.status} />
                  {props.reservation.visit_status && props.reservation.visit_status !== "not_checked" && (
                    <span style={{ marginLeft: 6 }}><VisitBadge visitStatus={props.reservation.visit_status} /></span>
                  )}
                </div>
              </div>
              <div className="dal-detail-info-grid">
                <div className="dal-detail-info-item">
                  <div className="dal-detail-info-label">체크인</div>
                  <div className="dal-detail-info-value">{props.reservation.check_in}</div>
                </div>
                <div className="dal-detail-info-item">
                  <div className="dal-detail-info-label">체크아웃</div>
                  <div className="dal-detail-info-value">{props.reservation.check_out}</div>
                </div>
                <div className="dal-detail-info-item">
                  <div className="dal-detail-info-label">예약 인원</div>
                  <div className="dal-detail-info-value">{props.reservation.guests != null ? `${props.reservation.guests}명` : "-"}</div>
                </div>
                <div className="dal-detail-info-item">
                  <div className="dal-detail-info-label">숙박 일수</div>
                  <div className="dal-detail-info-value">{detailNights > 0 ? `${detailNights}박` : "당일"}</div>
                </div>
              </div>
              {props.reservation.notes && (
                <div className="dal-notes-section">
                  <div className="dal-notes-label">비고 / 요청사항</div>
                  <div className="dal-notes-text">{props.reservation.notes}</div>
                </div>
              )}
              <MiniCalendar checkIn={props.reservation.check_in} checkOut={props.reservation.check_out} color={props.reservation.color ?? "#4CAF50"} />
            </>
          )}

          {/* ════ 입실 계량기 단계 ════ */}
          {props.mode === "detail" && step === "checkin_meter" && (
            <div className="dal-meter-section">
              {meterLoading ? (
                <p className="dal-meter-loading">계량기 정보 불러오는 중…</p>
              ) : (
                <>
                  {meterData?.prev_out && (
                    <div className="dal-meter-ref-card">
                      <div className="dal-meter-ref-title">📋 이전 퇴실 계량기 참고값</div>
                      <div className="dal-meter-ref-grid">
                        <span>가스</span><span>{meterData.prev_out.gas ?? "-"} ㎥</span>
                        <span>전기</span><span>{meterData.prev_out.elec ?? "-"} kWh</span>
                        <span>수도</span><span>{meterData.prev_out.water ?? "-"} ㎥</span>
                      </div>
                    </div>
                  )}
                  <p className="dal-meter-hint">현재 계량기 값을 입력하면 퇴실 시 공과금 정산에 활용됩니다. <span style={{color:"#9CA3AF"}}>(선택)</span></p>
                  <MeterInputRow label="🔥 가스"  unit="㎥"  inputValue={gasIn}   onChange={setGasIn}   />
                  <MeterInputRow label="⚡ 전기" unit="kWh" inputValue={elecIn}  onChange={setElecIn}  />
                  <MeterInputRow label="💧 수도" unit="㎥"  inputValue={waterIn} onChange={setWaterIn} />
                </>
              )}
            </div>
          )}

          {/* ════ 퇴실 계량기 단계 ════ */}
          {props.mode === "detail" && step === "checkout_meter" && (
            <div className="dal-meter-section">
              {meterLoading ? (
                <p className="dal-meter-loading">계량기 정보 불러오는 중…</p>
              ) : (
                <>
                  {meterData?.current?.gas_meter_in != null && (
                    <div className="dal-meter-ref-card">
                      <div className="dal-meter-ref-title">📋 입실 시 계량기</div>
                      <div className="dal-meter-ref-grid">
                        <span>가스</span><span>{meterData.current.gas_meter_in} ㎥</span>
                        <span>전기</span><span>{meterData.current.elec_meter_in ?? "-"} kWh</span>
                        <span>수도</span><span>{meterData.current.water_meter_in ?? "-"} ㎥</span>
                      </div>
                    </div>
                  )}
                  <p className="dal-meter-hint">퇴실 시 계량기 값을 입력해 주세요. <span style={{color:"#EF4444"}}>*필수</span></p>
                  <MeterInputRow label="🔥 가스"  unit="㎥"  inputValue={gasOut}   onChange={setGasOut}   refValue={meterData?.current?.gas_meter_in   ?? undefined} rate={billing?.gas_rate} />
                  <MeterInputRow label="⚡ 전기" unit="kWh" inputValue={elecOut}  onChange={setElecOut}  refValue={meterData?.current?.elec_meter_in  ?? undefined} rate={billing?.elec_rate} />
                  <MeterInputRow label="💧 수도" unit="㎥"  inputValue={waterOut} onChange={setWaterOut} refValue={meterData?.current?.water_meter_in ?? undefined} rate={billing?.water_rate} />

                  {totalAmount > 0 && (
                    <div className="dal-meter-total">
                      <span>예상 공과금 후불 정산액</span>
                      <strong>{totalAmount.toLocaleString()}원</strong>
                    </div>
                  )}

                  {/* 퇴실 주의사항 */}
                  <div className="dal-checkout-rules">
                    <div className="dal-checkout-rules-title">⚠️ 퇴실 주의사항</div>
                    <ul>
                      {CHECKOUT_RULES.map((r, i) => <li key={i}>· {r}</li>)}
                    </ul>
                  </div>

                  {/* 정산 계좌 */}
                  {billing?.bank_account && (
                    <div className="dal-bank-info">
                      <div className="dal-bank-title">💳 정산 계좌</div>
                      <div className="dal-bank-detail">
                        {billing.bank_name} {billing.bank_account}
                        {billing.bank_holder && <span> ({billing.bank_holder})</span>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* ── 푸터 ── */}
        <div className="dal-modal-footer">
          {error && <p className="mb-3 w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {/* 신규 예약 */}
          {props.mode === "create" && (
            <div className="flex w-full gap-3">
              <button onClick={props.onClose} className="dal-btn dal-btn-outline" style={{ flex: 1 }}>취소</button>
              <button disabled={loading} onClick={handleSubmit} className="dal-btn dal-btn-primary" style={{ flex: 1 }}>
                {loading ? "처리 중..." : "✈ 예약 요청"}
              </button>
            </div>
          )}

          {/* 상세 기본 */}
          {props.mode === "detail" && step === "detail" && (
            <div className="flex w-full items-center gap-2">
              {props.reservation.user_id === props.currentUserId &&
               ["pending", "waiting_deposit"].includes(props.reservation.status) && (
                <button disabled={loading} onClick={handleCancel} className="dal-btn dal-btn-outline dal-btn-sm">
                  ✕ 예약 취소
                </button>
              )}
              <div style={{ flex: 1 }} />
              {props.reservation.user_id === props.currentUserId &&
               props.reservation.status === "confirmed" &&
               props.reservation.visit_status === "not_checked" && (
                <button disabled={loading} onClick={handleCheckinClick} className="dal-btn dal-btn-confirm dal-btn-sm">
                  {loading ? "..." : "✅ 체크인"}
                </button>
              )}
              {props.reservation.user_id === props.currentUserId &&
               props.reservation.status === "confirmed" &&
               props.reservation.visit_status === "checked_in" && (
                <button disabled={loading} onClick={handleCheckoutClick} className="dal-btn dal-btn-primary dal-btn-sm">
                  {loading ? "..." : "🏠 체크아웃"}
                </button>
              )}
              <button onClick={props.onClose} className="dal-btn dal-btn-primary dal-btn-sm">✓ 확인</button>
            </div>
          )}

          {/* 체크인 계량기 단계 */}
          {props.mode === "detail" && step === "checkin_meter" && (
            <div className="flex w-full gap-3">
              <button onClick={() => setStep("detail")} className="dal-btn dal-btn-outline" style={{ flex: 1 }}>
                <ChevronLeft className="inline h-4 w-4 mr-1" /> 돌아가기
              </button>
              <button disabled={loading || meterLoading} onClick={submitCheckin} className="dal-btn dal-btn-confirm" style={{ flex: 1 }}>
                {loading ? "처리 중..." : "✅ 체크인 완료"}
              </button>
            </div>
          )}

          {/* 체크아웃 계량기 단계 */}
          {props.mode === "detail" && step === "checkout_meter" && (
            <div className="flex w-full gap-3">
              <button onClick={() => setStep("detail")} className="dal-btn dal-btn-outline" style={{ flex: 1 }}>
                <ChevronLeft className="inline h-4 w-4 mr-1" /> 돌아가기
              </button>
              <button disabled={loading || meterLoading} onClick={submitCheckout} className="dal-btn dal-btn-primary" style={{ flex: 1 }}>
                {loading ? "처리 중..." : "🏠 체크아웃 완료"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
