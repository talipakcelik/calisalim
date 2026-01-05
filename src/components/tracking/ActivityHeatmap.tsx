import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Session } from "@/types/tracking";
import { fmtHmFromMs } from "@/lib/formatters";
import { overlapActiveMs } from "@/lib/helpers";

/** ========= Activity Heatmap Component (GitHub-like labels) ========= */
export function ActivityHeatmap({ sessions, themeColor }: { sessions: Session[]; themeColor: string }) {
    // --- Build a 52-week grid aligned to Monday (like GitHub) ---
    const { days, weeks } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const start = new Date(today);
        start.setDate(start.getDate() - 363);
        start.setHours(0, 0, 0, 0);

        const day = start.getDay();
        const mondayOffset = day === 0 ? 6 : day - 1;
        start.setDate(start.getDate() - mondayOffset);

        const totalDays = 53 * 7;

        const _days: Date[] = [];
        const d = new Date(start);
        for (let i = 0; i < totalDays; i++) {
            _days.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }

        const _weeks: Date[][] = [];
        for (let i = 0; i < _days.length; i += 7) _weeks.push(_days.slice(i, i + 7));

        return { days: _days, weeks: _weeks };
    }, []);

    // --- Calculate totals per day (by day start) ---
    const dailyTotals = useMemo(() => {
        const map = new Map<number, number>();
        for (const day of days) {
            const start = day.getTime();
            const end = start + 86400000;
            let total = 0;
            for (const s of sessions) total += overlapActiveMs(s, start, end);
            if (total > 0) map.set(start, total);
        }
        return map;
    }, [sessions, days]);

    // --- Determine levels (0-4) ---
    const getLevel = (ms: number) => {
        if (ms <= 0) return 0;
        if (ms < 30 * 60 * 1000) return 1;
        if (ms < 60 * 60 * 1000) return 2;
        if (ms < 2 * 60 * 60 * 1000) return 3;
        return 4;
    };

    const getCellStyle = (level: number) => {
        if (level === 0) return {};
        const opacities = [0.18, 0.35, 0.6, 1.0];
        return { backgroundColor: themeColor, opacity: opacities[level - 1] };
    };

    // --- Month labels (top) ---
    const monthLabels = useMemo(() => {
        let prevMonth = -1;
        return weeks.map((week) => {
            const nextMonth =
                prevMonth === -1 ? week[0].getMonth() : week.find((d) => d.getMonth() !== prevMonth)?.getMonth();

            if (nextMonth === undefined || nextMonth === prevMonth) return "";
            prevMonth = nextMonth;

            const sampleDay = week.find((d) => d.getMonth() === nextMonth)!;
            return sampleDay.toLocaleDateString("tr-TR", { month: "short" });
        });
    }, [weeks]);

    const weekdayLabels = [
        { row: 0, label: "Pzt" },
        { row: 1, label: "Sal" },
        { row: 2, label: "Çar" },
        { row: 3, label: "Per" },
        { row: 4, label: "Cum" },
        { row: 5, label: "Cmt" },
        { row: 6, label: "Paz" },
    ];

    /** ======= NEW: Pretty tooltip state ======= */
    const [tip, setTip] = useState<null | {
        x: number;
        y: number;
        dateStr: string;
        durStr: string;
        ms: number;
        level: number;
    }>(null);

    const hideTip = useCallback(() => setTip(null), []);

    useEffect(() => {
        if (!tip) return;

        const onScroll = () => setTip((t) => (t ? { ...t } : null)); // keep open but position updates via mouse move
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") hideTip();
        };

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("keydown", onKey);
        };
    }, [tip, hideTip]);

    const setTipFromEvent = useCallback(
        (e: React.MouseEvent | React.FocusEvent, day: Date, total: number) => {
            const level = getLevel(total);
            const dateStr = day.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
            const durStr = fmtHmFromMs(total);

            // Prefer mouse position; fallback to element rect center for focus
            const isMouse = "clientX" in e;
            const x = isMouse ? (e as React.MouseEvent).clientX : (e.target as HTMLElement).getBoundingClientRect().left + (e.target as HTMLElement).getBoundingClientRect().width / 2;
            const y = isMouse ? (e as React.MouseEvent).clientY : (e.target as HTMLElement).getBoundingClientRect().top;

            setTip({ x, y, dateStr, durStr, ms: total, level });
        },
        []
    );

    const moveTip = useCallback((e: React.MouseEvent) => {
        setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
    }, []);

    return (
        <div className="w-full relative">
            {/* NEW: Pretty tooltip */}
            {tip ? (
                <div
                    className="pointer-events-none fixed z-[200] select-none"
                    style={{
                        left: tip.x,
                        top: tip.y,
                        transform: "translate(-50%, calc(-100% - 10px))",
                    }}
                >
                    <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-950/95 backdrop-blur shadow-2xl px-3 py-2 min-w-[190px]">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{tip.dateStr}</div>
                            <div className="text-[11px] text-muted-foreground">Seviye {tip.level}</div>
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                            <span
                                className="h-2.5 w-2.5 rounded-sm"
                                style={{
                                    backgroundColor: tip.level === 0 ? "transparent" : themeColor,
                                    opacity: tip.level === 0 ? 1 : [0.18, 0.35, 0.6, 1.0][Math.max(0, tip.level - 1)],
                                    border: tip.level === 0 ? "1px solid rgba(148,163,184,.6)" : "none",
                                }}
                            />
                            <div className="text-sm text-slate-700 dark:text-slate-200">
                                Toplam: <span className="font-semibold">{tip.durStr}</span>
                            </div>
                        </div>

                        <div className="mt-1 text-[11px] text-muted-foreground">
                            (Esc ile kapat)
                        </div>
                    </div>

                    {/* arrow */}
                    <div
                        className="mx-auto h-2 w-2 rotate-45 border-b border-r border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-950/95"
                        style={{ marginTop: -1 }}
                    />
                </div>
            ) : null}

            {/* Top month row */}
            <div className="flex gap-2">
                <div className="w-10 shrink-0" />
                <div className="flex gap-1 overflow-x-auto w-full pb-2 scrollbar-hide">
                    {monthLabels.map((label, idx) => (
                        <div key={idx} className="w-[14px] text-[10px] text-muted-foreground leading-none">
                            {label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="flex gap-2">
                {/* Weekday labels */}
                <div className="w-10 shrink-0 pt-[2px]">
                    <div className="grid grid-rows-7 gap-[3px]">
                        {Array.from({ length: 7 }).map((_, r) => {
                            const hit = weekdayLabels.find((x) => x.row === r);
                            return (
                                <div key={r} className="h-[11px] flex items-center justify-end pr-1">
                                    {hit ? <span className="text-[10px] text-muted-foreground">{hit.label}</span> : null}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Weeks */}
                <div className="flex gap-1 overflow-x-auto w-full pb-2 scrollbar-hide">
                    {weeks.map((week, wIdx) => (
                        <div key={wIdx} className="w-[14px] grid grid-rows-7 gap-[3px]">
                            {week.map((day, dIdx) => {
                                const ts = day.getTime();
                                const total = dailyTotals.get(ts) || 0;
                                const level = getLevel(total);

                                return (
                                    <button
                                        key={`${wIdx}-${dIdx}`}
                                        type="button"
                                        className={[
                                            "mx-auto flex-none w-[11px] h-[11px] rounded-sm transition-all",
                                            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 dark:focus:ring-slate-600",
                                            "hover:ring-1 hover:ring-offset-1 hover:ring-slate-400",
                                            level === 0 ? "bg-transparent border border-slate-200/60 dark:border-slate-800/60" : "",
                                        ].join(" ")}
                                        style={getCellStyle(level)}
                                        onMouseEnter={(e) => setTipFromEvent(e, day, total)}
                                        onMouseMove={moveTip}
                                        onMouseLeave={hideTip}
                                        onFocus={(e) => setTipFromEvent(e, day, total)}
                                        onBlur={hideTip}
                                        aria-label={`${day.toLocaleDateString("tr-TR", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                        })}: ${fmtHmFromMs(total)}`}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Az</span>
                {[0, 1, 2, 3, 4].map((l) => (
                    <div
                        key={l}
                        className="w-[11px] h-[11px] rounded-sm border border-slate-200/60 dark:border-slate-800/60"
                        style={getCellStyle(l)}
                    />
                ))}
                <span>Çok</span>
            </div>
        </div>
    );
}
