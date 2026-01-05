import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Category, DailyLog, Session, Project } from "@/types/tracking";
import { calculateWordsPerHourRobust, getPeakHours, getWeeklySummary } from "@/lib/analytics";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { Timer, Zap, Scale, Calendar } from "lucide-react";

export function WritingAnalytics({
    dailyLogs,
    sessions,
    categories,
    selectedProject
}: {
    dailyLogs: DailyLog[];
    sessions: Session[];
    categories: Category[];
    selectedProject?: Project | null;
}) {
    // --- Filter Data by Project ---
    const filteredLogs = useMemo(() => {
        if (!selectedProject) return dailyLogs;

        return dailyLogs.map(log => {
            // If log has project breakdown, use that specific count
            if (log.projectBreakdown && log.projectBreakdown[selectedProject.id] !== undefined) {
                return { ...log, wordCount: log.projectBreakdown[selectedProject.id] };
            }
            // Fallback for migration: if project is default thesis (or not specified) and no breakdown exists
            if (selectedProject.id === "default-thesis") {
                // Return as is if no breakdown exist (assume legacy data belongs to thesis)
                if (!log.projectBreakdown) return log;
            }
            // If breakdown exists but not for this project, count is 0
            if (log.projectBreakdown) {
                return { ...log, wordCount: 0 };
            }
            return log; // Default fallback
        }).filter(log => log.wordCount > 0);
    }, [dailyLogs, selectedProject]);

    const filteredSessions = useMemo(() => {
        if (!selectedProject) return sessions;
        // Filter by projectId if available, otherwise fallback to categoryId matching
        return sessions.filter(s => {
            if (s.projectId) return s.projectId === selectedProject.id;
            // Fallback for legacy sessions without projectId
            return selectedProject.categoryId ? s.categoryId === selectedProject.categoryId : true;
        });
    }, [sessions, selectedProject]);

    // --- Prepare Data ---
    const wphData = useMemo(() => calculateWordsPerHourRobust(filteredSessions, filteredLogs), [filteredSessions, filteredLogs]);
    const weeklyStats = useMemo(() => getWeeklySummary(filteredLogs, filteredSessions), [filteredLogs, filteredSessions]);
    const peakHours = useMemo(() => getPeakHours(filteredSessions), [filteredSessions]);

    // Filter peak hours for chart (only show active hours or all 24?) -> Let's show all 24 for pattern visibility
    // but maybe highlight the busy ones.

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <Scale className="h-5 w-5 text-indigo-500 mb-2" />
                        <div className="text-2xl font-bold font-mono">{weeklyStats.totalWords}</div>
                        <div className="text-xs text-muted-foreground">Bu Hafta Kelime</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <Timer className="h-5 w-5 text-blue-500 mb-2" />
                        <div className="text-2xl font-bold font-mono">{weeklyStats.totalHours}s</div>
                        <div className="text-xs text-muted-foreground">Bu Hafta Süre</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <Zap className="h-5 w-5 text-amber-500 mb-2" />
                        <div className="text-2xl font-bold font-mono">{weeklyStats.avgWph}</div>
                        <div className="text-xs text-muted-foreground">Ort. Kelime/Saat</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <Calendar className="h-5 w-5 text-emerald-500 mb-2" />
                        <div className="text-2xl font-bold font-mono">{weeklyStats.streakDays} / 7</div>
                        <div className="text-xs text-muted-foreground">Aktif Gün</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* WPH Trend */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium">Verimlilik Trendi (Kelime/Saat)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {wphData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={wphData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(val) => new Date(val).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        minTickGap={30}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={30}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                                        formatter={(val: number | undefined) => [`${val || 0} k/s`, "Hız"]}
                                        labelFormatter={(label) => new Date(label).toLocaleDateString("tr-TR", { dateStyle: "full" })}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="wph"
                                        stroke="var(--primary)"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: "var(--primary)" }}
                                        activeDot={{ r: 5 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                Bu proje için henüz yeterli veri yok.
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Peak Hours */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium">En Verimli Saatler (Oturum Sayısı)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={peakHours}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis
                                    dataKey="hour"
                                    tickFormatter={(val) => `${val}:00`}
                                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                    width={30}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)', color: 'var(--card-foreground)' }}
                                    labelFormatter={(label) => `Saat ${label}:00 - ${label + 1}:00`}
                                />
                                <Bar
                                    dataKey="count"
                                    fill="var(--chart-2)"
                                    radius={[4, 4, 0, 0]}
                                    name="Oturum"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
