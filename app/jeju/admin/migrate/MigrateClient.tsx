"use client";

import { useState, useEffect } from "react";
import { Upload, CheckCircle, AlertTriangle, ClipboardPaste, FileSpreadsheet, Link2, Loader2, Trash2 } from "lucide-react";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface CsvRow {
  nickname: string;
  check_in: string;
  check_out: string;
  status?: string;
  real_name?: string;
  phone?: string;
  guests?: number;
  notes?: string;
  color?: string;
  gas_meter_out?: number;
  water_meter_out?: number;
  elec_meter_out?: number;
}

interface PreviewRow extends CsvRow {
  rowIndex: number;
  error?: string;
}

interface PreviewResult {
  valid: PreviewRow[];
  invalid: PreviewRow[];
  conflicts: PreviewRow[];
}

// ─── 표준 CSV 파서 ──────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().toLowerCase().replace(/^"/, "").replace(/"$/, ""));

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"/, "").replace(/"$/, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
      return {
        nickname:  row["nickname"]  ?? row["닉네임"] ?? "",
        check_in:  row["check_in"]  ?? row["입실"]   ?? "",
        check_out: row["check_out"] ?? row["퇴실"]   ?? "",
        status:    row["status"]    ?? row["상태"],
        real_name: row["real_name"] ?? row["실명"],
        phone:     row["phone"]     ?? row["연락처"],
        guests: row["guests"] ? Number(row["guests"]) : undefined,
        notes: row["notes"] ?? row["비고"],
        color: row["color"],
      } as CsvRow;
    })
    .filter((r) => r.nickname && r.check_in && r.check_out);
}

// ─── 구글 시트 날짜 파서 ─────────────────────────────────────────────────────
// 지원 형식: "2.3-13" "1.26~30" "3.24~4.2" "5/1-5/5" "10.30-11.02" "12.27~1.23"
//            "4/18"(단일 일자)  "11-13" "22-26"(월-컨텍스트 기반 일자 범위)

interface SkippedRow { dateRaw: string; nickname: string; }

function parseSheetDate(raw: string, year: number, ctxMonth = 0): { check_in: string; check_out: string } | null {
  const cleaned = raw
    .trim()
    .replace(/[/／]/g, ".")          // 슬래시 → 점
    .replace(/[～〜]/g, "~")          // 전각·파도 물결표 → ~
    .replace(/[\u2013\u2014\uFF0D]/g, "-") // en-dash, em-dash, 전각 하이픈 → -
    .replace(/\s+/g, "")
    .replace(/\.+$/, "");            // 끝의 점 제거(복수도 처리)

  if (!cleaned) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  // 패턴1: M.D~M.D 또는 M.D-M.D (끝에도 월 있음)
  // ctxMonth가 있고 시작월이 컨텍스트보다 6개월 이상 클 경우 (예: 1월 섹션에서 12월 날짜)
  // → 해당 12월은 전년도 데이터
  const m1 = cleaned.match(/^(\d{1,2})\.(\d{1,2})[~-](\d{1,2})\.(\d{1,2})$/);
  if (m1) {
    const [sm, sd, em, ed] = m1.slice(1).map(Number);
    const startYear = (ctxMonth > 0 && sm > ctxMonth && sm - ctxMonth > 6)
      ? year - 1  // 예: 1월 컨텍스트에서 12월 → 전년도
      : year;
    const endYear = em < sm ? startYear + 1 : startYear;
    return {
      check_in:  `${startYear}-${pad(sm)}-${pad(sd)}`,
      check_out: `${endYear}-${pad(em)}-${pad(ed)}`,
    };
  }

  // 패턴2: M.D~D 또는 M.D-D (끝에 월 없음 → 시작 월 계승)
  const m2 = cleaned.match(/^(\d{1,2})\.(\d{1,2})[~-](\d{1,2})$/);
  if (m2) {
    const [sm, sd, ed] = m2.slice(1).map(Number);
    return {
      check_in:  `${year}-${pad(sm)}-${pad(sd)}`,
      check_out: `${year}-${pad(sm)}-${pad(ed)}`,
    };
  }

  // 패턴3: M.D (단일 일자 → 당일 체크인, 다음날 체크아웃)
  const m3 = cleaned.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (m3) {
    const [sm, sd] = m3.slice(1).map(Number);
    const next = new Date(year, sm - 1, sd + 1); // 자동 월말 처리
    return {
      check_in:  `${year}-${pad(sm)}-${pad(sd)}`,
      check_out: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
    };
  }

  // 패턴4: D~D 또는 D-D (월 없음 → ctxMonth 사용, 예: "11-13", "22-26")
  if (ctxMonth > 0) {
    const m4 = cleaned.match(/^(\d{1,2})[~-](\d{1,2})$/);
    if (m4) {
      const [sd, ed] = m4.slice(1).map(Number);
      return {
        check_in:  `${year}-${pad(ctxMonth)}-${pad(sd)}`,
        check_out: `${year}-${pad(ctxMonth)}-${pad(ed)}`,
      };
    }
  }

  return null;
}

// ─── 구글 시트 붙여넣기 파서 ─────────────────────────────────────────────────
// 헤더 자동 감지: 날짜 | 사용자 | 숙박비 | 가스 | 수도 | 전기
// - 컬럼 위치 폴백: dateIdx 위치에 날짜가 없으면 cols[0] 시도 (월 경계 오버플로 행 대응)
// - skipped: 날짜 문자열이 있으나 패턴 불일치인 행 별도 수집

function parseSheetData(text: string, year: number): { rows: CsvRow[]; skipped: SkippedRow[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { rows: [], skipped: [] };

  // 탭(클립보드 복사) vs 쉼표(CSV 다운로드) 자동 감지
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const splitLine = (line: string) =>
    line.split(sep).map((c) => c.trim().replace(/^"/, "").replace(/"$/, ""));

  // 헤더 행 찾기 (처음 10행 중 "날짜" 컬럼을 포함하는 행)
  let hdrIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const cols = splitLine(lines[i]);
    if (cols.some((c) => c.includes("날짜"))) {
      hdrIdx = i;
      headers = cols;
      break;
    }
  }
  if (hdrIdx === -1) return { rows: [], skipped: [] };

  const col = (name: string) => headers.findIndex((h) => h.includes(name));
  const dateIdx  = col("날짜");
  const userIdx  = col("사용자");
  const feeIdx   = col("숙박비");
  const gasIdx   = col("가스");
  const waterIdx = col("수도");
  const elecIdx  = col("전기");

  if (dateIdx === -1 || userIdx === -1) return { rows: [], skipped: [] };

  // 월 이름 → 숫자 (월 헤더 행 감지용)
  const MONTH_MAP: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };

  const rows: CsvRow[] = [];
  const skipped: SkippedRow[] = [];
  let currentMonth = 0;

  for (let i = hdrIdx + 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);

    // 월 헤더 감지: 앞 7컬럼(달력 영역)에서 영어 월 이름 탐색
    const calText = cols.slice(0, 7).join(" ").toLowerCase();
    for (const [name, num] of Object.entries(MONTH_MAP)) {
      if (calText.includes(name)) { currentMonth = num; break; }
    }

    // 기본: dateIdx 위치에서 날짜·닉네임 읽기
    let dateRaw  = dateIdx < cols.length ? cols[dateIdx] : "";
    let nickname = userIdx < cols.length ? cols[userIdx] : "";
    let shifted  = false;

    // 폴백: dateIdx 위치의 값이 유효한 날짜로 파싱되지 않고,
    //       cols[0]이 유효한 날짜면 → 선행 탭이 누락된 shifted 행으로 처리
    // (클립보드 복사 시 월 시작 앞쪽 빈 컬럼이 생략돼 데이터가 cols[0]부터 시작하는 경우)
    if (!parseSheetDate(dateRaw, year, currentMonth) &&
        cols.length > 0 && parseSheetDate(cols[0], year, currentMonth)) {
      shifted  = true;
      dateRaw  = cols[0];
      // 닉네임도 같은 offset으로 추출 (userIdx - dateIdx)
      const adjUser = userIdx - dateIdx;
      nickname = (adjUser > 0 && adjUser < cols.length) ? cols[adjUser] : "";
    }

    if (!dateRaw) continue; // 달력 전용 빈 행 스킵

    const parsed = parseSheetDate(dateRaw, year, currentMonth);
    if (!parsed) {
      if (nickname) skipped.push({ dateRaw, nickname: nickname || "?" });
      continue;
    }

    if (!nickname) {
      skipped.push({ dateRaw, nickname: "(닉네임 없음)" });
      continue;
    }

    // shifted 행은 컬럼 인덱스를 dateIdx 만큼 좌로 조정
    const SHIFT = shifted ? dateIdx : 0;
    const safeGet = (idx: number) => {
      const adj = idx - SHIFT;
      return adj >= 0 && adj < cols.length ? cols[adj] : "";
    };

    const feeRaw   = feeIdx   >= 0 ? safeGet(feeIdx)   : "";
    const gasVal   = gasIdx   >= 0 ? parseFloat(safeGet(gasIdx))   : NaN;
    const waterVal = waterIdx >= 0 ? parseFloat(safeGet(waterIdx)) : NaN;
    const elecVal  = elecIdx  >= 0 ? parseFloat(safeGet(elecIdx))  : NaN;

    rows.push({
      nickname:        nickname.trim(),
      check_in:        parsed.check_in,
      check_out:       parsed.check_out,
      status:          feeRaw === "입금완료" ? "confirmed" : "pending",
      gas_meter_out:   isNaN(gasVal)   ? undefined : gasVal,
      water_meter_out: isNaN(waterVal) ? undefined : waterVal,
      elec_meter_out:  isNaN(elecVal)  ? undefined : elecVal,
    });
  }

  return { rows, skipped };
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

type Mode = "csv" | "sheet";

export default function MigrateClient() {
  const [mode, setMode]           = useState<Mode>("csv");
  const [rows, setRows]           = useState<CsvRow[]>([]);
  const [skipped, setSkipped]     = useState<SkippedRow[]>([]);
  const [villaId, setVillaId]     = useState("");
  const [villaName, setVillaName] = useState("");
  const [year, setYear]           = useState(new Date().getFullYear());
  const [sheetUrl, setSheetUrl]   = useState("");
  const [pasteText, setPasteText] = useState("");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [preview, setPreview]     = useState<PreviewResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // 페이지 로드 시 빌라 ID 자동 조회
  useEffect(() => {
    fetch("/api/jeju/villas")
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) {
          setVillaId(data.id);
          setVillaName(data.name ?? "");
        }
      })
      .catch(() => {/* villaId는 수동 입력으로 폴백 */});
  }, []);

  const resetState = () => {
    setRows([]);
    setSkipped([]);
    setPreview(null);
    setSaved(false);
    setError(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setRows(parsed);
      setPreview(null);
      setSaved(false);
      setError(parsed.length === 0 ? "파싱된 행이 없습니다. 헤더를 확인하세요." : null);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleFetchSheet = async () => {
    if (!sheetUrl.trim()) { setError("구글 시트 URL을 입력하세요."); return; }
    setFetchLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jeju/admin/migrate/fetch-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetUrl }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "시트 가져오기 실패"); return; }
      const result = parseSheetData(json.csv, year);
      setRows(result.rows);
      setSkipped(result.skipped);
      setPreview(null);
      setSaved(false);
      setError(
        result.rows.length === 0
          ? "파싱된 예약이 없습니다. 헤더에 '날짜' 컬럼이 있는지 확인하세요."
          : null
      );
    } finally {
      setFetchLoading(false);
    }
  };

  const handleParsePaste = () => {
    if (!pasteText.trim()) { setError("붙여넣을 데이터가 없습니다."); return; }
    const result = parseSheetData(pasteText, year);
    setRows(result.rows);
    setSkipped(result.skipped);
    setPreview(null);
    setSaved(false);
    setError(
      result.rows.length === 0
        ? "파싱된 예약이 없습니다. 헤더에 '날짜' 컬럼이 있는지, 연도가 맞는지 확인하세요."
        : null
    );
  };

  const handlePreview = async () => {
    if (!villaId.trim()) { setError("Villa ID를 입력하세요."); return; }
    if (rows.length === 0) { setError("데이터를 먼저 불러오세요."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jeju/admin/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa_id: villaId, rows, confirm: false }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "오류 발생"); return; }
      setPreview(json as PreviewResult);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preview || !villaId) return;
    if (!confirm(`${preview.valid.length}건을 마이그레이션 합니다. 계속하시겠습니까?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jeju/admin/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa_id: villaId, rows, confirm: true }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "저장 실패"); return; }
      setSaved(true);
    } finally {
      setLoading(false);
    }
  };

  const [resetLoading, setResetLoading] = useState(false);
  const handleReset = async () => {
    if (!villaId.trim()) { setError("Villa ID를 먼저 확인하세요."); return; }
    if (!confirm("⚠️ 이 빌라의 예약 데이터를 전부 삭제합니다.\n(테스트로 직접 입력한 예약 포함)\n마이그레이션을 새로 시작하려면 확인하세요.")) return;
    setResetLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jeju/admin/migrate", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ villa_id: villaId }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "초기화 실패"); return; }
      resetState();
      setError(null);
      alert(`마이그레이션 데이터 ${json.deleted_count}건이 삭제되었습니다.`);
    } finally {
      setResetLoading(false);
    }
  };

  const errorCount = (preview?.invalid.length ?? 0) + (preview?.conflicts.length ?? 0);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-dalkkot-wood-dark">과거 데이터 마이그레이션</h1>

      {/* 모드 탭 */}
      <div className="flex gap-2 rounded-xl bg-dalkkot-cream-dark p-1">
        {([
          { key: "csv"   as Mode, label: "표준 CSV 업로드",     Icon: Upload },
          { key: "sheet" as Mode, label: "구글 시트 붙여넣기", Icon: FileSpreadsheet },
        ]).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { setMode(key); resetState(); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === key
                ? "bg-white shadow text-dalkkot-wood-dark"
                : "text-dalkkot-wood-mid hover:text-dalkkot-wood-dark"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 공통 입력 패널 */}
      <div className="rounded-xl border border-dalkkot-cream-dark bg-white p-5 space-y-4">
        {/* Villa ID — 자동 조회, 실패 시 수동 입력 */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-dalkkot-wood-dark/70">대상 빌라</label>
          {villaId && villaName ? (
            <div className="flex items-center gap-2 rounded-lg border border-dalkkot-cream-dark bg-dalkkot-cream px-3 py-2">
              <CheckCircle className="h-4 w-4 text-dalkkot-sage-dark shrink-0" />
              <span className="text-sm font-medium text-dalkkot-wood-dark">{villaName}</span>
              <span className="text-xs text-dalkkot-wood-mid/60 font-mono ml-auto">{villaId.slice(0, 8)}…</span>
            </div>
          ) : (
            <input
              type="text"
              placeholder="Villa UUID (자동 로드 실패 시 직접 입력)"
              value={villaId}
              onChange={(e) => setVillaId(e.target.value)}
              className="w-full rounded-lg border border-dalkkot-cream-dark px-3 py-2 text-sm font-mono focus:outline-none focus:border-dalkkot-sage-dark"
            />
          )}
        </div>

        {/* ── 표준 CSV 모드 ── */}
        {mode === "csv" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-dalkkot-wood-dark/70">CSV 파일 선택</label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-dalkkot-cream-dark bg-dalkkot-cream p-4 hover:border-dalkkot-sage-dark transition-colors">
              <Upload className="h-5 w-5 text-dalkkot-wood-mid" />
              <span className="text-sm text-dalkkot-wood-mid">
                {rows.length > 0 ? `${rows.length}행 로드됨` : "CSV 파일을 클릭하여 선택..."}
              </span>
              <input type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
            </label>
            <p className="text-xs text-dalkkot-wood-mid/60">
              필수 헤더: nickname, check_in(YYYY-MM-DD), check_out(YYYY-MM-DD)
            </p>
          </div>
        )}

        {/* ── 구글 시트 모드 ── */}
        {mode === "sheet" && (
          <div className="space-y-4">

            {/* 연도 설정 */}
            <div className="flex items-center gap-3">
              <div className="space-y-0.5">
                <label className="text-xs font-medium text-dalkkot-wood-dark/70">연도</label>
                <input
                  type="number"
                  min={2020}
                  max={2035}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-28 rounded-lg border border-dalkkot-cream-dark px-3 py-2 text-sm font-mono focus:outline-none focus:border-dalkkot-sage-dark"
                />
              </div>
              <p className="text-xs text-dalkkot-wood-mid/60 mt-4">
                날짜 형식 예: 2.3-13, 3.24~4.2, 5/1-5/5
              </p>
            </div>

            {/* ── URL 직접 가져오기 (권장) ── */}
            <div className="rounded-lg border border-dalkkot-sage/40 bg-dalkkot-sage/5 p-3 space-y-2.5">
              <p className="text-xs font-semibold text-dalkkot-wood-dark">URL로 직접 가져오기 <span className="ml-1 text-dalkkot-sage-dark font-normal">권장</span></p>
              <p className="text-xs text-dalkkot-wood-mid/70">
                시트 공유 설정이 <strong>"링크가 있는 모든 사용자"</strong> 인 경우 URL만으로 전체 데이터를 가져옵니다.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 min-w-0 rounded-lg border border-dalkkot-cream-dark px-3 py-2 text-sm font-mono text-xs focus:outline-none focus:border-dalkkot-sage-dark"
                />
                <button
                  onClick={handleFetchSheet}
                  disabled={fetchLoading}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-dalkkot-sage-dark px-3 py-2 text-sm font-medium text-white hover:bg-dalkkot-sage disabled:opacity-60 transition-colors"
                >
                  {fetchLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Link2 className="h-4 w-4" />}
                  {fetchLoading ? "가져오는 중..." : "가져오기"}
                </button>
              </div>
            </div>

            {/* ── 구분선 ── */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-dalkkot-cream-dark" />
              <span className="text-xs text-dalkkot-wood-mid/50">또는 직접 붙여넣기</span>
              <div className="flex-1 border-t border-dalkkot-cream-dark" />
            </div>

            {/* ── 수동 붙여넣기 ── */}
            <div className="space-y-2">
              <p className="text-xs text-dalkkot-wood-mid/70">
                구글 시트에서 전체 선택 (Ctrl+A) → 복사 (Ctrl+C) 후 아래에 붙여넣기
              </p>
              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="여기에 구글 시트 데이터를 붙여넣으세요..."
                className="w-full rounded-lg border border-dalkkot-cream-dark px-3 py-2 text-sm font-mono text-xs focus:outline-none focus:border-dalkkot-sage-dark resize-y"
              />
              <button
                onClick={handleParsePaste}
                className="flex items-center gap-2 rounded-lg border border-dalkkot-sage-dark px-3 py-1.5 text-sm font-medium text-dalkkot-sage-dark hover:bg-dalkkot-sage/10 transition-colors"
              >
                <ClipboardPaste className="h-4 w-4" />
                {rows.length > 0 ? `${rows.length}행 파싱됨 (다시 파싱)` : "파싱"}
              </button>
            </div>
          </div>
        )}

        {/* 파싱 완료 알림 */}
        {rows.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-dalkkot-sage/10 border border-dalkkot-sage/30 px-3 py-2 text-sm text-dalkkot-sage-dark">
            <CheckCircle className="h-4 w-4" />
            {rows.length}건 파싱됨 — 미리보기로 유효성 검사 후 저장하세요
          </div>
        )}

        {/* 날짜 인식 실패 행 (파싱 시 누락된 항목 표시) */}
        {skipped.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm font-medium text-amber-700">
                {skipped.length}건 날짜 인식 실패 (저장 불가)
              </p>
            </div>
            <div className="divide-y divide-amber-100 max-h-40 overflow-y-auto">
              {skipped.map((s, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-1.5 text-xs text-amber-700">
                  <span className="font-medium">{s.nickname}</span>
                  <code className="ml-auto bg-amber-100 rounded px-1.5 py-0.5">{s.dateRaw}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 초기화 + 미리보기 버튼 행 */}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={resetLoading || !villaId}
            title="마이그레이션 예약 전체 삭제 후 재시작"
            className="flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
          >
            {resetLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Trash2 className="h-4 w-4" />}
            {resetLoading ? "삭제 중..." : "마이그 초기화"}
          </button>
          <button
            onClick={handlePreview}
            disabled={loading || rows.length === 0}
            className="flex-1 rounded-lg bg-dalkkot-sage-dark py-2.5 text-sm font-medium text-white hover:bg-dalkkot-sage disabled:opacity-60 transition-colors"
          >
            {loading ? "처리 중..." : "미리보기"}
          </button>
        </div>
      </div>

      {/* 미리보기 결과 */}
      {preview && !saved && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{preview.valid.length}</p>
              <p className="text-xs text-emerald-600">저장 가능</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{preview.conflicts.length}</p>
              <p className="text-xs text-amber-600">날짜 충돌</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{preview.invalid.length}</p>
              <p className="text-xs text-red-600">유효성 오류</p>
            </div>
          </div>

          {preview.valid.length > 0 && (
            <div className="rounded-xl border border-dalkkot-cream-dark overflow-hidden">
              <div className="bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">저장될 행</div>
              <div className="divide-y divide-dalkkot-cream-dark max-h-64 overflow-y-auto">
                {preview.valid.map((r) => (
                  <div key={r.rowIndex} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm">
                    <span className="font-medium text-dalkkot-wood-dark">{r.nickname}</span>
                    <span className="text-dalkkot-wood-mid text-xs">{r.check_in} ~ {r.check_out}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      r.status === "confirmed"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {r.status === "confirmed" ? "입금완료" : "미입금"}
                    </span>
                    {(r.gas_meter_out != null || r.water_meter_out != null || r.elec_meter_out != null) && (
                      <span className="text-xs text-dalkkot-wood-mid/60">
                        {r.gas_meter_out   != null && `가스 ${r.gas_meter_out}  `}
                        {r.water_meter_out != null && `수도 ${r.water_meter_out}  `}
                        {r.elec_meter_out  != null && `전기 ${r.elec_meter_out}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {errorCount > 0 && (
            <div className="rounded-xl border border-red-200 overflow-hidden">
              <div className="bg-red-50 px-4 py-2 text-xs font-medium text-red-700">오류/충돌 행</div>
              <div className="divide-y divide-dalkkot-cream-dark max-h-64 overflow-y-auto">
                {[...preview.invalid, ...preview.conflicts].map((r) => (
                  <div key={r.rowIndex} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="font-medium text-dalkkot-wood-dark">{r.nickname}</span>
                    <span className="text-dalkkot-wood-mid text-xs">{r.check_in} ~ {r.check_out}</span>
                    <span className="ml-auto text-xs text-red-500">{r.error ?? "날짜 충돌"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.valid.length > 0 && (
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full rounded-lg bg-dalkkot-wood-dark py-2.5 text-sm font-medium text-dalkkot-cream hover:bg-dalkkot-wood-mid disabled:opacity-60 transition-colors"
            >
              {loading ? "저장 중..." : `${preview.valid.length}건 저장 확정`}
            </button>
          )}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-5">
          <CheckCircle className="h-6 w-6 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-700">마이그레이션 완료!</p>
            <p className="text-sm text-emerald-600">{preview?.valid.length}건의 데이터가 저장되었습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}
