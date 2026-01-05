import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    BookOpen,
    Calendar,
    CheckCircle2,
    Flame,
    Target,
    TrendingUp,
    Trophy,
} from "lucide-react";
import { DailyLog, Milestone, Project } from "@/types/tracking";
import { fmtHmFromMs } from "@/lib/formatters";

export function ThesisDashboard({
    dailyLogs,
    project,
    sessions
}: {
    dailyLogs: DailyLog[];
    project: Project; // Required now
    sessions: any[];
    milestones: Milestone[];
}) {
    // 1. Kelime İlerlemesi (Proje Bazlı)
    const totalWords = useMemo(() => {
        return dailyLogs.reduce((acc, log) => {
            // Eğer breakdown varsa oradan al, yoksa (eski veri) ve proje 'tez' ise hepsini al
            if (log.projectBreakdown && log.projectBreakdown[project.id]) {
                return acc + log.projectBreakdown[project.id];
            }
            // Geriye dönük uyumluluk: Sadece eğer proje ID'si varsayılan tez ise ve breakdown yoksa say
            // Ancak yeni sistemde her zaman breakdown olmasını hedefliyoruz.
            // Migrasyon sonrası eski loglar 'default-thesis' e atanmış gibi davranabiliriz.
            if (!log.projectBreakdown && project.type === 'thesis') {
                return acc + log.wordCount;
            }
            return acc;
        }, 0);
    }, [dailyLogs, project]);

    const progressPercent = Math.min(100, Math.round((totalWords / (project.goal || 1)) * 100));

    // 2. Kalan Süre (Deadline - Proje Deadline'ı)
    const daysLeft = project.deadline
        ? Math.ceil((project.deadline - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

    // 3. Streak (Genel Yazma Serisi - Proje bağımsız genel üretkenlik göstergesi olarak kalabilir veya projeye özgü yapılabilir. Şimdilik genel bırakıyoruz)
    const streak = useMemo(() => {
        let currentStreak = 0;
        const sortedLogs = [...dailyLogs].sort((a, b) => b.date.localeCompare(a.date));
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

        let checkDate = sortedLogs[0]?.date === today ? today : yesterday;

        if (sortedLogs.length > 0 && sortedLogs[0].date !== today && sortedLogs[0].date !== yesterday) {
            return 0;
        }

        for (const log of sortedLogs) {
            if (log.date === checkDate) {
                // Sadece kelime sayısı > 0 olanları say
                if (log.wordCount > 0) currentStreak++;

                const prev = new Date(checkDate);
                prev.setDate(prev.getDate() - 1);
                checkDate = prev.toISOString().slice(0, 10);
            } else {
                break;
            }
        }
        return currentStreak;
    }, [dailyLogs]);

    // 4. Proje Çalışma Süresi (Kategori eşleşmesi üzerinden)
    const projectDuration = useMemo(() => {
        const targetCatId = project.categoryId;
        if (!targetCatId) return 0;

        return sessions
            .filter(s => s.categoryId === targetCatId)
            .reduce((acc, s) => acc + Math.max(0, (s.end - s.start) - (s.pausedMs || 0)), 0);
    }, [sessions, project]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* İlerleme Kartı */}
            <Card className="col-span-1 md:col-span-2 shadow-md border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-white to-indigo-50/50 dark:from-slate-950 dark:to-slate-900/50">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                        <BookOpen className="h-4 w-4" /> {project.title} İlerlemesi
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end justify-between mb-2">
                        <div className="text-2xl font-bold tabular-nums">
                            {totalWords.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ {project.goal.toLocaleString()} kelime</span>
                        </div>
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300">
                            %{progressPercent} Tamamlandı
                        </Badge>
                    </div>
                    <Progress value={progressPercent} className="h-2 bg-indigo-100 dark:bg-indigo-950" indicatorClassName="bg-indigo-600 dark:bg-indigo-500" />
                    <p className="text-xs text-muted-foreground mt-2">
                        Hedefe ulaşmak için yaklaşık <span className="font-medium text-indigo-600 dark:text-indigo-400">{Math.max(0, project.goal - totalWords).toLocaleString()}</span> kelime kaldı.
                    </p>
                </CardContent>
            </Card>

            {/* Deadline Kartı */}
            <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-orange-500" /> Kalan Süre
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {daysLeft !== null ? (
                        <>
                            <div className="text-2xl font-bold tabular-nums">{daysLeft} <span className="text-sm font-normal text-muted-foreground">gün</span></div>
                            <div className="text-xs text-muted-foreground mt-1">
                                Teslim: {new Date(project.deadline!).toLocaleDateString('tr-TR')}
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-muted-foreground py-2">Henüz tarih yok</div>
                    )}
                </CardContent>
            </Card>

            {/* İstatistikler */}
            <Card className="shadow-sm border-slate-100 dark:border-slate-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-500" /> İstatistikler
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Flame className="h-3 w-3 text-orange-500" /> Streak
                        </span>
                        <span className="font-bold">{streak} gün</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Trophy className="h-3 w-3 text-yellow-500" /> Toplam Süre
                        </span>
                        <span className="font-bold">{fmtHmFromMs(projectDuration)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
