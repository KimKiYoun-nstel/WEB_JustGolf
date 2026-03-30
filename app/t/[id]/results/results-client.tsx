"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useDeferredValue, useMemo, useState } from "react";
import type { TournamentMedia } from "../../../../lib/tournamentMedia";
import { formatTournamentStatus } from "../../../../lib/statusLabels";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../../../components/ui/sheet";
import type { TournamentResultsPayload } from "../../../../lib/results/tournamentResults";

type ResultStats = {
  eagle: number;
  birdie: number;
  par: number;
  bogey: number;
  double_bogey: number;
  triple_bogey: number;
  quad_bogey: number;
  double_par: number;
};

type ResultPayload = {
  rank?: number;
  tee_time?: string;
  out_course?: string;
  in_course?: string;
  out_scores?: number[];
  in_scores?: number[];
  out_total?: number;
  in_total?: number;
  gross_total?: number;
  net?: number;
  handicap?: number;
  award?: string | null;
  near?: number;
  long?: number;
  stats?: ResultStats;
  source?: string;
};

type ResultItem = {
  id: number;
  section: string;
  row_order: number;
  display_name: string;
  score_label: string | null;
  score_value: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  match_status: "matched" | "ambiguous" | "pending";
  matched_user_id: string | null;
  is_mine: boolean;
};

type TournamentResultsClientProps = {
  initialData: TournamentResultsPayload;
  tournamentId: number;
  media: TournamentMedia;
};

type PlayerResult = {
  id: number;
  section: string;
  rowOrder: number;
  displayName: string;
  total: number;
  net: number;
  rank: number;
  handicap: number;
  outCourse: string;
  inCourse: string;
  outScores: number[];
  inScores: number[];
  outTotal: number;
  inTotal: number;
  award: string | null;
  near: number;
  long: number;
  stats: ResultStats;
  note: string | null;
  source: string;
  matchStatus: ResultItem["match_status"];
  isMine: boolean;
};

type SortKey =
  | "rank"
  | "name"
  | "total"
  | "birdie"
  | "eagle"
  | "par"
  | "bogey"
  | "double_bogey"
  | "triple_bogey"
  | "quad_bogey"
  | "double_par"
  | "near"
  | "long";

type SortPreference = "best" | "worst";

const STAT_META: Array<{ key: keyof ResultStats; label: string }> = [
  { key: "eagle", label: "이글" },
  { key: "birdie", label: "버디" },
  { key: "par", label: "파" },
  { key: "bogey", label: "보기" },
  { key: "double_bogey", label: "더블보기" },
  { key: "triple_bogey", label: "트리플보기" },
  { key: "quad_bogey", label: "쿼드보기" },
  { key: "double_par", label: "더블파" },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "rank", label: "순위" },
  { value: "total", label: "합계" },
  { value: "name", label: "이름" },
  { value: "birdie", label: "버디" },
  { value: "eagle", label: "이글" },
  { value: "par", label: "파" },
  { value: "bogey", label: "보기" },
  { value: "double_bogey", label: "더블보기" },
  { value: "triple_bogey", label: "트리플보기" },
  { value: "quad_bogey", label: "쿼드보기" },
  { value: "double_par", label: "더블파" },
  { value: "near", label: "니어" },
  { value: "long", label: "롱기" },
];

const EMPTY_STATS: ResultStats = {
  eagle: 0,
  birdie: 0,
  par: 0,
  bogey: 0,
  double_bogey: 0,
  triple_bogey: 0,
  quad_bogey: 0,
  double_par: 0,
};

const PODIUM_STYLES = [
  {
    badge: "1위",
    cardClass:
      "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,247,218,0.98),rgba(255,255,255,0.96))] text-slate-950 shadow-[0_18px_42px_rgba(180,138,36,0.16)]",
    accentClass: "bg-amber-500/12 text-amber-700",
    totalClass: "text-4xl text-amber-700",
  },
  {
    badge: "2위",
    cardClass:
      "border-slate-200 bg-[linear-gradient(135deg,rgba(240,244,249,0.98),rgba(255,255,255,0.96))] text-slate-950 shadow-sm",
    accentClass: "bg-slate-700/8 text-slate-700",
    totalClass: "text-3xl text-slate-800",
  },
  {
    badge: "3위",
    cardClass:
      "border-orange-200/80 bg-[linear-gradient(135deg,rgba(255,240,229,0.98),rgba(255,255,255,0.96))] text-slate-950 shadow-sm",
    accentClass: "bg-orange-500/10 text-orange-700",
    totalClass: "text-3xl text-orange-700",
  },
];

const getTodayKey = () => new Date().toISOString().slice(0, 10);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => toNumber(item)).filter((item) => Number.isFinite(item));
}

function normalizePayload(payload: Record<string, unknown>): ResultPayload {
  const statsInput = isRecord(payload.stats) ? payload.stats : {};

  return {
    rank: toNumber(payload.rank),
    tee_time: typeof payload.tee_time === "string" ? payload.tee_time : undefined,
    out_course:
      typeof payload.out_course === "string"
        ? payload.out_course
        : typeof payload.course === "string"
          ? payload.course
          : undefined,
    in_course: typeof payload.in_course === "string" ? payload.in_course : undefined,
    out_scores: toNumberArray(payload.out_scores),
    in_scores: toNumberArray(payload.in_scores),
    out_total: toNumber(payload.out_total),
    in_total: toNumber(payload.in_total),
    gross_total: toNumber(payload.gross_total),
    net: toNumber(payload.net),
    handicap: toNumber(payload.handicap),
    award:
      typeof payload.award === "string" || payload.award === null ? payload.award : null,
    near: toNumber(payload.near),
    long: toNumber(payload.long),
    stats: {
      eagle: toNumber(statsInput.eagle),
      birdie: toNumber(statsInput.birdie),
      par: toNumber(statsInput.par),
      bogey: toNumber(statsInput.bogey),
      double_bogey: toNumber(statsInput.double_bogey),
      triple_bogey: toNumber(statsInput.triple_bogey),
      quad_bogey: toNumber(statsInput.quad_bogey),
      double_par: toNumber(statsInput.double_par),
    },
    source: typeof payload.source === "string" ? payload.source : undefined,
  };
}

function buildPlayerResult(row: ResultItem): PlayerResult {
  const payload = normalizePayload(row.payload ?? {});
  const outScores = payload.out_scores ?? [];
  const inScores = payload.in_scores ?? [];
  const total = payload.gross_total || toNumber(row.score_value);

  return {
    id: row.id,
    section: row.section,
    rowOrder: row.row_order,
    displayName: row.display_name,
    total,
    net: payload.net ?? total,
    rank: payload.rank ?? 0,
    handicap: payload.handicap ?? 0,
    outCourse: payload.out_course ?? "-",
    inCourse: payload.in_course ?? "-",
    outScores,
    inScores,
    outTotal: payload.out_total ?? outScores.reduce((sum, score) => sum + score, 0),
    inTotal: payload.in_total ?? inScores.reduce((sum, score) => sum + score, 0),
    award: payload.award ?? null,
    near: payload.near ?? 0,
    long: payload.long ?? 0,
    stats: payload.stats ?? EMPTY_STATS,
    note: row.note,
    source: payload.source ?? "-",
    matchStatus: row.match_status,
    isMine: row.is_mine,
  };
}

function comparePlayers(
  a: PlayerResult,
  b: PlayerResult,
  sortKey: SortKey,
  sortPreference: SortPreference
) {
  if (sortKey === "name") {
    const compared = a.displayName.localeCompare(b.displayName, "ko");
    return sortPreference === "best" ? compared : compared * -1;
  }

  if (sortKey === "near") {
    const aHas = a.near > 0;
    const bHas = b.near > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas && a.near !== b.near) {
      return sortPreference === "best" ? a.near - b.near : b.near - a.near;
    }
    return a.rank - b.rank || a.rowOrder - b.rowOrder;
  }

  if (sortKey === "long") {
    const aHas = a.long > 0;
    const bHas = b.long > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas && a.long !== b.long) {
      return sortPreference === "best" ? b.long - a.long : a.long - b.long;
    }
    return a.rank - b.rank || a.rowOrder - b.rowOrder;
  }

  const aValue =
    sortKey === "rank"
      ? a.rank
      : sortKey === "total"
        ? a.total
        : a.stats[sortKey as keyof ResultStats];
  const bValue =
    sortKey === "rank"
      ? b.rank
      : sortKey === "total"
        ? b.total
        : b.stats[sortKey as keyof ResultStats];

  if (aValue !== bValue) {
    if (sortKey === "rank" || sortKey === "total") {
      return sortPreference === "best" ? aValue - bValue : bValue - aValue;
    }

    return sortPreference === "best" ? bValue - aValue : aValue - bValue;
  }

  return a.rank - b.rank || a.rowOrder - b.rowOrder;
}

function formatDistance(value: number, unit: "m" | "yd" = "m") {
  if (value <= 0) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}${unit}`;
}

function formatScoreLine(player: PlayerResult) {
  return `${player.outCourse} ${player.outTotal} / ${player.inCourse} ${player.inTotal} / 합계 ${player.total}`;
}

function formatRecordLine(player: PlayerResult) {
  return `이글 ${player.stats.eagle} · 버디 ${player.stats.birdie} · 파 ${player.stats.par} · 보기 ${player.stats.bogey}`;
}

function HoleTable({
  title,
  course,
  scores,
  total,
}: {
  title: string;
  course: string;
  scores: number[];
  total: number;
}) {
  if (scores.length === 0) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          {title}
        </p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">{course}</h3>
        <p className="mt-3 text-sm text-slate-500">홀별 상세 정보가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {title}
          </p>
          <h3 className="text-base font-semibold text-slate-900">{course}</h3>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
          합계 {total}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-slate-500">
              {scores.map((_, index) => (
                <th key={index} className="min-w-11 px-2 py-1 text-center font-medium">
                  {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="text-slate-900">
              {scores.map((score, index) => (
                <td key={index} className="px-2 py-2 text-center text-base font-semibold">
                  <span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-2xl bg-slate-50">
                    {score}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopRankCard({
  player,
  index,
}: {
  player: PlayerResult;
  index: number;
}) {
  const style = PODIUM_STYLES[index] ?? PODIUM_STYLES[2];

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 ${style.cardClass}`}>
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/45 blur-2xl" />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.16em] ${style.accentClass}`}
            >
              {style.badge}
            </span>
            <h3 className="mt-3 text-2xl font-bold">{player.displayName}</h3>
            <p className="mt-2 text-sm text-slate-600">{formatScoreLine(player)}</p>
          </div>
          <div className="text-right">
            <p className={`font-black ${style.totalClass}`}>{player.total}</p>
            <p className="text-sm font-medium text-slate-500">합산 스코어</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-700">
          <span className="rounded-full bg-white/75 px-2.5 py-1">버디 {player.stats.birdie}</span>
          <span className="rounded-full bg-white/75 px-2.5 py-1">파 {player.stats.par}</span>
          <span className="rounded-full bg-white/75 px-2.5 py-1">보기 {player.stats.bogey}</span>
          <span className="rounded-full bg-white/75 px-2.5 py-1">니어 {formatDistance(player.near)}</span>
          <span className="rounded-full bg-white/75 px-2.5 py-1">롱기 {formatDistance(player.long)}</span>
        </div>
      </div>
    </div>
  );
}

function PlayerDetailContent({ player }: { player: PlayerResult | null }) {
  if (!player) {
    return <p className="text-sm text-slate-500">상세 보기를 선택해주세요.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_58%,#334155_100%)] px-5 py-5 text-white shadow-[0_18px_42px_rgba(15,23,42,0.2)]">
        <div className="absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                Rank #{player.rank}
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{player.displayName}</h2>
              <p className="mt-2 text-sm text-slate-300">{formatScoreLine(player)}</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black">{player.total}</p>
              <p className="text-sm text-slate-300">합산 스코어</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {player.award ? <Badge className="bg-amber-400 text-slate-950">{player.award}</Badge> : null}
            <Badge className="bg-white/15 text-white">핸디 {player.handicap}</Badge>
            {player.isMine ? <Badge className="bg-emerald-500 text-white">본인</Badge> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            코스별 스코어
          </p>
          <div className="mt-3 grid gap-2">
            <div className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-slate-500">전반 코스</p>
              <p className="text-sm font-semibold text-slate-900">
                {player.outCourse} {player.outTotal}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-slate-500">후반 코스</p>
              <p className="text-sm font-semibold text-slate-900">
                {player.inCourse} {player.inTotal}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-slate-500">특이 기록</p>
              <p className="text-sm font-semibold text-slate-900">
                니어 {formatDistance(player.near)} / 롱기 {formatDistance(player.long)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            경기 내역
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {STAT_META.map((meta) => (
              <div key={meta.key} className="rounded-2xl bg-white px-4 py-3">
                <p className="text-xs text-slate-500">{meta.label}</p>
                <p className="text-sm font-semibold text-slate-900">{player.stats[meta.key]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <HoleTable title="전반 9홀" course={player.outCourse} scores={player.outScores} total={player.outTotal} />
      <HoleTable title="후반 9홀" course={player.inCourse} scores={player.inScores} total={player.inTotal} />

    </div>
  );
}

export default function TournamentResultsClient({
  initialData,
  tournamentId,
  media,
}: TournamentResultsClientProps) {
  const data = initialData;
  const { cardBgUrl, groupPhotoUrl, highlightVideoUrl } = media;
  const hasBg = !!cardBgUrl;

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortPreference, setSortPreference] = useState<SortPreference>("best");
  const [selectedResultId, setSelectedResultId] = useState<number | null>(
    initialData.results[0]?.id ?? null
  );

  const deferredSearch = useDeferredValue(searchText);

  useEffect(() => {
    if (data.summary_text.trim() && typeof window !== "undefined") {
      const seenEverKey = `result-summary-seen-ever:${tournamentId}`;
      const hiddenTodayKey = `result-summary-hide-today:${tournamentId}`;
      const today = getTodayKey();

      const hasSeenEver = window.localStorage.getItem(seenEverKey) === "1";
      const hiddenToday = window.localStorage.getItem(hiddenTodayKey) === today;
      setIsSummaryOpen(!hasSeenEver || !hiddenToday);
    } else {
      setIsSummaryOpen(false);
    }
  }, [data.summary_text, tournamentId]);

  const players = useMemo(() => {
    return data.results.map(buildPlayerResult);
  }, [data.results]);

  const filteredPlayers = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    const rows = keyword
      ? players.filter((player) => player.displayName.toLowerCase().includes(keyword))
      : players;

    return [...rows].sort((a, b) => comparePlayers(a, b, sortKey, sortPreference));
  }, [deferredSearch, players, sortKey, sortPreference]);

  const selectedPlayer = useMemo(() => {
    return (
      filteredPlayers.find((player) => player.id === selectedResultId) ??
      players.find((player) => player.id === selectedResultId) ??
      filteredPlayers[0] ??
      null
    );
  }, [filteredPlayers, players, selectedResultId]);

  const summary = useMemo(() => {
    const ranked = [...players]
      .filter((player) => player.rank > 0)
      .sort((a, b) => a.rank - b.rank || a.rowOrder - b.rowOrder);

    const statLeaders = STAT_META.map((meta) => {
      const leader = [...players]
        .filter((player) => player.stats[meta.key] > 0)
        .sort((a, b) => {
          if (b.stats[meta.key] !== a.stats[meta.key]) {
            return b.stats[meta.key] - a.stats[meta.key];
          }
          return a.rank - b.rank || a.rowOrder - b.rowOrder;
        })[0];

      return { label: meta.label, key: meta.key, player: leader ?? null };
    });

    const nearLeader = [...players]
      .filter((player) => player.near > 0)
      .sort((a, b) => {
        if (a.near !== b.near) return a.near - b.near;
        return a.rank - b.rank || a.rowOrder - b.rowOrder;
      })[0];

    const longLeader = [...players]
      .filter((player) => player.long > 0)
      .sort((a, b) => {
        if (b.long !== a.long) return b.long - a.long;
        return a.rank - b.rank || a.rowOrder - b.rowOrder;
      })[0];

    return {
      top3: ranked.slice(0, 3),
      statLeaders,
      nearLeader: nearLeader ?? null,
      longLeader: longLeader ?? null,
    };
  }, [players]);

  const closeSummary = (hideToday: boolean) => {
    if (typeof window !== "undefined") {
      const seenEverKey = `result-summary-seen-ever:${tournamentId}`;
      const hiddenTodayKey = `result-summary-hide-today:${tournamentId}`;
      window.localStorage.setItem(seenEverKey, "1");
      if (hideToday) {
        window.localStorage.setItem(hiddenTodayKey, getTodayKey());
      }
    }

    setIsSummaryOpen(false);
  };

  const handleSelectPlayer = (playerId: number) => {
    setSelectedResultId(playerId);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsDetailSheetOpen(true);
    }
  };

  return (
    <main className={`min-h-screen ${!groupPhotoUrl ? "bg-[linear-gradient(180deg,#f7f4ed_0%,#eef3f8_100%)]" : ""}`}>
      {/* ── 상단 요약 카드 ── */}
      <div className="px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Card
            className={`relative overflow-hidden shadow-sm ${hasBg ? "border-0" : "border-slate-200/80 bg-white/90"}`}
            style={
              cardBgUrl
                ? { backgroundImage: `url(${cardBgUrl})`, backgroundSize: "cover", backgroundPosition: "center center" }
                : undefined
            }
          >
            {hasBg && <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black/55" />}
            <CardHeader className="relative gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${hasBg ? "text-white/70" : "text-slate-400"}`}>
                    Tournament Result
                  </p>
                  <CardTitle className={`text-2xl font-bold sm:text-3xl ${hasBg ? "text-white" : "text-slate-950"}`}>
                    {data.tournament.title}
                  </CardTitle>
                  <p className={`text-sm ${hasBg ? "text-white/80" : "text-slate-500"}`}>{data.tournament.event_date}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${hasBg ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {formatTournamentStatus(data.tournament.status)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className={hasBg ? "bg-white text-slate-900 hover:bg-white/90" : ""}>
                  <Link href={`/t/${data.tournament.id}/groups`}>조편성표 보기</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className={hasBg ? "border-white/50 bg-transparent text-white hover:bg-white/20 hover:text-white" : ""}>
                  <a href={data.pdf_url} target="_blank" rel="noreferrer">원본 PDF 열기</a>
                </Button>
                {data.summary_text.trim() ? (
                  <Button size="sm" variant="outline" className={hasBg ? "border-white/50 bg-transparent text-white hover:bg-white/20 hover:text-white" : ""} onClick={() => setIsSummaryOpen(true)}>
                    갈무리 보기
                  </Button>
                ) : null}
                {data.tournament.status === "done" ? (
                  <Button asChild size="sm" variant="outline" className={hasBg ? "border-white/50 bg-transparent text-white hover:bg-white/20 hover:text-white" : ""}>
                    <Link href={`/t/${data.tournament.id}/gallery`}>📸 사진/영상</Link>
                  </Button>
                ) : null}
                {highlightVideoUrl ? (
                  <Button size="sm" variant="outline" className={hasBg ? "border-white/50 bg-transparent text-white hover:bg-white/20 hover:text-white" : ""} onClick={() => setIsVideoOpen(true)}>
                    🎬 하이라이트 영상
                  </Button>
                ) : null}
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* ── 단체사진 sticky 배경 (고정 크기: 높이=뷰포트, 폭=비율에 따라 클립) ── */}
      {groupPhotoUrl ? (
        <div
          className="sticky top-14 z-0 w-full overflow-hidden"
          style={{
            height: "calc(100vh - 56px)",
            backgroundImage: `url(${groupPhotoUrl})`,
            /* contain: 이미지 전체 보임, 빈 공간은 페이지 배경색 */
            backgroundSize: "contain",
            backgroundPosition: "top center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/30" />
        </div>
      ) : null}

      {/* ── 메인 컨텐츠 (단체사진 위로 스크롤됨) ── */}
      <div className={`relative z-10 ${groupPhotoUrl ? "px-4 pb-12 pt-4 sm:px-6" : "px-4 pb-6 pt-4 sm:px-6"}`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <Card className="border-slate-200/80 bg-white/90">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">상위 3명</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.top3.length === 0 ? (
                <p className="text-sm text-slate-500">순위 정보가 없습니다.</p>
              ) : (
                summary.top3.map((player, index) => (
                  <TopRankCard key={player.id} player={player} index={index} />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">주요 기록</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {summary.statLeaders.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 truncate text-base font-semibold text-slate-900">
                        {item.player ? item.player.displayName : "-"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.player ? `${item.player.stats[item.key]}회` : "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.player ? `순위 ${item.player.rank}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">니어</p>
                    <p className="mt-1 truncate text-base font-semibold text-slate-900">
                      {summary.nearLeader ? summary.nearLeader.displayName : "-"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {summary.nearLeader ? formatDistance(summary.nearLeader.near) : "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {summary.nearLeader ? `순위 ${summary.nearLeader.rank}` : ""}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">롱기</p>
                    <p className="mt-1 truncate text-base font-semibold text-slate-900">
                      {summary.longLeader ? summary.longLeader.displayName : "-"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {summary.longLeader ? formatDistance(summary.longLeader.long) : "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {summary.longLeader ? `순위 ${summary.longLeader.rank}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)] lg:items-start">
          <div className="space-y-4">
            <Card className="border-slate-200/80 bg-white/90">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">검색과 정렬</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_160px]">
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="이름으로 검색"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                />
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value as SortKey)}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sortPreference}
                  onChange={(event) => setSortPreference(event.target.value as SortPreference)}
                  className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  <option value="best">상위 우선</option>
                  <option value="worst">하위 우선</option>
                </select>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white/90 lg:flex lg:h-[calc(100vh-16rem)] lg:flex-col">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">참가자 스코어</CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      탭하거나 클릭하면 상세 정보가 바로 열립니다.
                    </p>
                  </div>
                  <span className="text-sm font-medium text-slate-500">{filteredPlayers.length}명</span>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3 sm:px-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {filteredPlayers.length === 0 ? (
                  <p className="px-1 py-3 text-sm text-slate-500">검색 결과가 없습니다.</p>
                ) : (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    <div className="hidden grid-cols-[72px_minmax(0,1.35fr)_minmax(0,1fr)_88px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 md:grid">
                      <span>순위</span>
                      <span>선수 / 스코어</span>
                      <span>경기 내역</span>
                      <span className="text-right">합계</span>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {filteredPlayers.map((player) => {
                        const isSelected = selectedPlayer?.id === player.id;

                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => handleSelectPlayer(player.id)}
                            className={[
                              "w-full px-4 py-4 text-left transition",
                              isSelected
                                ? "bg-slate-950 text-white"
                                : "bg-white text-slate-900 hover:bg-slate-50",
                            ].join(" ")}
                          >
                            <div className="grid gap-3 md:grid-cols-[72px_minmax(0,1.35fr)_minmax(0,1fr)_88px] md:items-center">
                              <div className="flex items-center gap-2">
                                <span
                                  className={[
                                    "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                    isSelected ? "bg-white/15 text-white" : "bg-slate-900 text-white",
                                  ].join(" ")}
                                >
                                  #{player.rank}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-lg font-semibold">{player.displayName}</span>
                                  {player.isMine ? (
                                    <Badge className="bg-emerald-600 text-white">본인</Badge>
                                  ) : player.matchStatus === "ambiguous" ? (
                                    <Badge variant="outline">동명이인</Badge>
                                  ) : player.matchStatus === "pending" ? (
                                    <Badge variant="outline">매칭 보류</Badge>
                                  ) : null}
                                  {player.award ? (
                                    <Badge variant={isSelected ? "secondary" : "outline"}>
                                      {player.award}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className={isSelected ? "mt-1 text-sm text-slate-200" : "mt-1 text-sm text-slate-500"}>
                                  {formatScoreLine(player)}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <p className={isSelected ? "text-sm text-slate-100" : "text-sm text-slate-700"}>
                                  {formatRecordLine(player)}
                                </p>
                                <p className={isSelected ? "mt-1 text-xs text-slate-300" : "mt-1 text-xs text-slate-500"}>
                                  니어 {formatDistance(player.near)} / 롱기 {formatDistance(player.long)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-black">{player.total}</p>
                                <p className={isSelected ? "text-xs text-slate-300" : "text-xs text-slate-500"}>
                                  합계
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
            <Card className="border-slate-200/80 bg-white/95 shadow-sm lg:flex lg:h-[calc(100vh-10rem)] lg:flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">선수 상세</CardTitle>
              </CardHeader>
              <CardContent className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <PlayerDetailContent player={selectedPlayer} />
              </CardContent>
            </Card>
          </div>
        </div>
        </div>
      </div>

      <div className="lg:hidden">
        <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen} side="bottom">
          <SheetContent className="max-h-[85vh] rounded-t-[28px] bg-white px-4 pb-8 pt-5">
            <SheetHeader className="mb-4">
              <SheetTitle>선수 상세</SheetTitle>
              <SheetClose onClick={() => setIsDetailSheetOpen(false)} />
            </SheetHeader>
            <PlayerDetailContent player={selectedPlayer} />
          </SheetContent>
        </Sheet>
      </div>

      {/* ── 하이라이트 영상 팝업 (YouTube Shorts 스타일: 세로 고정 크기 9:16) ── */}
      {isVideoOpen && highlightVideoUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92"
          onClick={() => setIsVideoOpen(false)}
        >
          <div
            className="flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsVideoOpen(false)}
              className="self-end rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/35"
            >
              ✕ 닫기
            </button>
            {/* 세로 영상 고정 크기: 최대 360px 폭, 80vh 높이 제한 */}
            <video
              controls
              playsInline
              className="rounded-2xl shadow-2xl"
              style={{ width: "min(360px, 90vw)", maxHeight: "80vh", background: "#000" }}
              src={highlightVideoUrl}
            >
              브라우저가 video 태그를 지원하지 않습니다.
            </video>
          </div>
        </div>
      ) : null}

      {isSummaryOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-xl font-bold text-slate-900">{data.summary_title || "대회 갈무리"}</h2>
            </div>
            <div className="max-h-[56vh] overflow-y-auto px-6 py-5">
              <pre className="font-sans whitespace-pre-wrap text-[15px] leading-7 text-slate-800">{data.summary_text}</pre>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <Button variant="outline" onClick={() => closeSummary(true)}>
                오늘 하루 보지 않기
              </Button>
              <Button onClick={() => closeSummary(false)}>확인</Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
