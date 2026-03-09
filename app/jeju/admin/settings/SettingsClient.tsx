"use client";

import { useState, useEffect } from "react";
import Toast from "../../_components/Toast";

interface BillingSettings {
  gas_rate: number | string;
  water_rate: number | string;
  elec_rate: number | string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  notes: string;
}

const DEFAULT: BillingSettings = {
  gas_rate: "",
  water_rate: "",
  elec_rate: "",
  bank_name: "",
  bank_account: "",
  bank_holder: "",
  notes: "",
};

export default function SettingsClient() {
  const [form, setForm] = useState<BillingSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    fetch("/api/jeju/admin/billing-settings")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setForm({
            gas_rate: d.gas_rate ?? "",
            water_rate: d.water_rate ?? "",
            elec_rate: d.elec_rate ?? "",
            bank_name: d.bank_name ?? "",
            bank_account: d.bank_account ?? "",
            bank_holder: d.bank_holder ?? "",
            notes: d.notes ?? "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/jeju/admin/billing-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gas_rate: form.gas_rate === "" ? null : Number(form.gas_rate),
          water_rate: form.water_rate === "" ? null : Number(form.water_rate),
          elec_rate: form.elec_rate === "" ? null : Number(form.elec_rate),
          bank_name: form.bank_name || null,
          bank_account: form.bank_account || null,
          bank_holder: form.bank_holder || null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) {
        showToast("요금 설정이 저장되었습니다.");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error ?? "저장 중 오류가 발생했습니다.", "error");
      }
    } catch {
      showToast("저장 중 오류가 발생했습니다.", "error");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof BillingSettings, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  if (loading) {
    return (
      <div>
        <div className="dal-page-header">
          <h1 className="dal-page-title">⚙ 요금 · 계좌 설정</h1>
        </div>
        <div className="dal-panel">
          <div className="dal-loading-row">설정을 불러오는 중…</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="dal-page-header">
        <h1 className="dal-page-title">
          <span style={{ color: "#8B5E3C" }}>⚙</span> 요금 · 계좌 설정
        </h1>
        <p className="dal-page-subtitle">체크아웃 시 사용자에게 표시될 요금 단가와 계좌 정보를 설정합니다.</p>
      </div>

      {/* 요금 단가 */}
      <div className="dal-panel" style={{ marginBottom: 20 }}>
        <div className="dal-panel-header">
          <h2 className="dal-panel-title">📊 계량기 요금 단가</h2>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {([
              { key: "gas_rate",   label: "🔥 가스 요금",  unit: "원/㎥" },
              { key: "elec_rate",  label: "⚡ 전기 요금",  unit: "원/kWh" },
              { key: "water_rate", label: "💧 수도 요금",  unit: "원/㎥" },
            ] as { key: keyof BillingSettings; label: string; unit: string }[]).map(({ key, label, unit }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  {label}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="dal-input"
                    style={{ flex: 1 }}
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    placeholder="0"
                  />
                  <span style={{ fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>{unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#FFF7ED", borderRadius: 8, borderLeft: "3px solid #F59E0B" }}>
            <p style={{ fontSize: 12, color: "#92400E", margin: 0 }}>
              💡 요금은 소수점 2자리까지 입력 가능합니다. 저장 후 체크아웃 시 해당 단가로 후불 금액이 자동 계산됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 계좌 정보 */}
      <div className="dal-panel" style={{ marginBottom: 20 }}>
        <div className="dal-panel-header">
          <h2 className="dal-panel-title">💳 정산 계좌 정보</h2>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                은행명
              </label>
              <input
                type="text"
                className="dal-input"
                value={form.bank_name}
                onChange={e => set("bank_name", e.target.value)}
                placeholder="예: 카카오뱅크"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                예금주
              </label>
              <input
                type="text"
                className="dal-input"
                value={form.bank_holder}
                onChange={e => set("bank_holder", e.target.value)}
                placeholder="예: 홍길동"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                계좌번호
              </label>
              <input
                type="text"
                className="dal-input"
                value={form.bank_account}
                onChange={e => set("bank_account", e.target.value)}
                placeholder="예: 3333-01-1234567"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 메모 */}
      <div className="dal-panel" style={{ marginBottom: 20 }}>
        <div className="dal-panel-header">
          <h2 className="dal-panel-title">📝 관리자 메모</h2>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <textarea
            className="dal-input"
            rows={3}
            style={{ resize: "vertical" }}
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="내부 참고 사항 (사용자에게 표시되지 않음)"
          />
        </div>
      </div>

      {/* 저장 버튼 */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginBottom: 32 }}>
        <button
          className="dal-btn dal-btn-confirm"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 120 }}
        >
          {saving ? "저장 중…" : "✓ 설정 저장"}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
