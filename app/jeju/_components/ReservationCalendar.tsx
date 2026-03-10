"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarReservation {
  id: string;
  nickname: string;
  check_in: string;   // YYYY-MM-DD
  check_out: string;  // YYYY-MM-DD
  color: string;
  status: string;
  visit_status: string;
  user_id: string | null;
  guests?: number;
  notes?: string;
}

interface ReservationCalendarProps {
  reservations: CalendarReservation[];
  year: number;
  month: number;
  currentUserId?: string;
  onDateClick?: (date: string) => void;
  onReservationClick?: (reservation: CalendarReservation) => void;
  onMonthChange?: (year: number, month: number) => void;
  /** true면 월 네비게이션 헤더를 숨김 (대시보드 패널에서 자체 헤더 사용 시) */
  hideHeader?: boolean;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function isBetween(date: Date, from: string, to: string) {
  const d = date.toISOString().slice(0, 10);
  return d >= from && d < to;
}

export default function ReservationCalendar({
  reservations,
  year,
  month,
  onDateClick,
  onReservationClick,
  onMonthChange,
  hideHeader = false,
}: ReservationCalendarProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const handlePrev = useCallback(() => {
    if (month === 1) onMonthChange?.(year - 1, 12);
    else onMonthChange?.(year, month - 1);
  }, [year, month, onMonthChange]);

  const handleNext = useCallback(() => {
    if (month === 12) onMonthChange?.(year + 1, 1);
    else onMonthChange?.(year, month + 1);
  }, [year, month, onMonthChange]);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const getDateStr = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const getReservationsForDay = (day: number): CalendarReservation[] => {
    const date = new Date(year, month - 1, day);
    return reservations.filter((r) => isBetween(date, r.check_in, r.check_out));
  };

  return (
    <div className="overflow-hidden">
      {/* 헤더 (hideHeader=true면 숨김) */}
      {!hideHeader && (
        <div className="flex items-center justify-between bg-dalkkot-wood-dark px-4 py-3 text-dalkkot-cream">
          <button
            onClick={handlePrev}
            className="rounded-md p-1 hover:bg-dalkkot-wood-mid transition-colors"
            aria-label="이전 달"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold">
            {year}년 {month}월
          </h2>
          <button
            onClick={handleNext}
            className="rounded-md p-1 hover:bg-dalkkot-wood-mid transition-colors"
            aria-label="다음 달"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* 요일 헤더 */}
      <div className="dal-cal-day-headers" style={{ padding: "0 12px", marginTop: 8 }}>
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className="dal-cal-day-header"
            style={i === 0 ? { color: "#EF4444" } : i === 6 ? { color: "#3B82F6" } : undefined}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="dal-cal-weeks" style={{ padding: "0 12px 12px" }}>
        {/* week rows */}
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, weekIdx) => (
          <div key={weekIdx} className="dal-cal-week">
            {cells.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, idx) => {
              const cellIdx = weekIdx * 7 + idx;
              if (!day) return <div key={`empty-${cellIdx}`} className="dal-cal-cell other-month" style={{ cursor: "default" }} />;

              const dateStr = getDateStr(day);
              const dayReservations = getReservationsForDay(day);
              const isToday = dateStr === today;
              const dow = (firstDay + day - 1) % 7;

              const dayClass = [
                "dal-cal-cell",
                isToday ? "today" : "",
                dow === 0 ? "sunday" : "",
                dow === 6 ? "saturday" : "",
              ].filter(Boolean).join(" ");

              return (
                <div
                  key={day}
                  className={dayClass}
                  role="button"
                  tabIndex={0}
                  onClick={() => dayReservations.length === 0 ? onDateClick?.(dateStr) : undefined}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && dayReservations.length === 0) onDateClick?.(dateStr); }}
                >
                  <span className="dal-cal-date">{day}</span>
                  {dayReservations.slice(0, 2).map((r) => {
                    const hoverKey = `${r.id}-${dateStr}`;
                    return (
                    <span key={hoverKey} className="dal-cal-event-wrapper">
                      <span
                        className={cn("dal-cal-event", r.status === "pending" && "pending")}
                        style={{ backgroundColor: r.color }}
                        onClick={(e) => { e.stopPropagation(); onReservationClick?.(r); }}
                        onMouseEnter={() => setHovered(hoverKey)}
                        onMouseLeave={() => setHovered(null)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onReservationClick?.(r); } }}
                      >
                        {r.nickname}
                      </span>
                      {hovered === hoverKey && (
                        <div className="dal-cal-tooltip">
                          <strong>{r.nickname}</strong>
                          <span>{r.check_in} → {r.check_out}</span>
                        </div>
                      )}
                    </span>
                  )})}
                  {dayReservations.length > 2 && (
                    <span style={{ fontSize: 10, color: "#6B7280", paddingLeft: 2 }}>+{dayReservations.length - 2}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
