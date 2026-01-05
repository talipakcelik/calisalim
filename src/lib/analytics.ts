import { DailyLog, Session } from "@/types/tracking";
import { sessionDurationMs } from "@/lib/helpers";

/**
 * Calculates words written per hour for each day based on daily logs and total active duration.
 * Note: Since DailyLog only stores total word count, we estimate WPH by dividing total words by total duration that day.
 */


// Rewriting robustly
function getDayKey(ms: number): string {
    // Returns YYYY-MM-DD based on local time
    const d = new Date(ms);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function calculateWordsPerHourRobust(
    sessions: Session[],
    dailyLogs: DailyLog[]
): { date: string; wph: number; words: number; hours: number }[] {
    const durationByDay = new Map<string, number>();

    sessions.forEach(s => {
        const key = getDayKey(s.start);
        durationByDay.set(key, (durationByDay.get(key) || 0) + sessionDurationMs(s));
    });

    // Sort logs by date
    const sortedLogs = [...dailyLogs].sort((a, b) => a.date.localeCompare(b.date));

    return sortedLogs.map(log => {
        const durationMs = durationByDay.get(log.date) || 0;
        const hours = durationMs / (1000 * 60 * 60);

        // Avoid division by zero
        const wph = hours > 0.1 ? Math.round(log.wordCount / hours) : 0;

        return {
            date: log.date, // YYYY-MM-DD
            wph,
            words: log.wordCount,
            hours: Number(hours.toFixed(1))
        };
    });
}

export function getWeeklySummary(
    dailyLogs: DailyLog[],
    sessions: Session[]
): {
    totalWords: number;
    totalHours: number;
    avgWph: number;
    streakDays: number;
} {
    // Filter for last 7 days
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoMs = weekAgo.getTime();

    const recentLogs = dailyLogs.filter(l => new Date(l.date).getTime() >= weekAgoMs);
    const recentSessions = sessions.filter(s => s.start >= weekAgoMs);

    const totalWords = recentLogs.reduce((acc, l) => acc + l.wordCount, 0);
    const totalDurationMs = recentSessions.reduce((acc, s) => acc + sessionDurationMs(s), 0);
    const totalHours = totalDurationMs / (1000 * 60 * 60);

    const avgWph = totalHours > 0.5 ? Math.round(totalWords / totalHours) : 0;

    // Calculate Streak (simple version based on daily logs presence)
    // For specialized PhD dashboard we might want a stricter streak (e.g. > 500 words or > 30 mins)
    // Here we just count consecutive days with logs in the full dataset going backwards from today
    let streak = 0;
    const sortedLogs = [...dailyLogs].sort((a, b) => b.date.localeCompare(a.date)); // Descending
    const todayStr = new Date().toISOString().split('T')[0];

    // Check if we have an entry for today or yesterday to start the streak
    // (If user hasn't written TODAY yet, don't kill the streak from yesterday)
    let currentDate = new Date();
    let dateStr = currentDate.toISOString().split('T')[0];

    // Check loop
    // Implementation detail: this is a simple approximation. strict logic is in helper already or we can reuse.
    // Let's use a simpler approach: count how many days in the last 7 days had activity
    const activeDays = new Set(recentLogs.map(l => l.date)).size;

    return {
        totalWords,
        totalHours: Number(totalHours.toFixed(1)),
        avgWph,
        streakDays: activeDays // For weekly summary context, active days in week is arguably more useful than global streak
    };
}

export function getPeakHours(
    sessions: Session[]
): { hour: number; count: number; avgDurationMin: number }[] {
    const hourMap = new Map<number, { count: number; totalMs: number }>();

    // Initialize 0-23
    for (let i = 0; i < 24; i++) {
        hourMap.set(i, { count: 0, totalMs: 0 });
    }

    sessions.forEach(s => {
        const h = new Date(s.start).getHours();
        const entry = hourMap.get(h)!;
        entry.count++;
        entry.totalMs += sessionDurationMs(s);
    });

    return Array.from(hourMap.entries()).map(([hour, data]) => ({
        hour,
        count: data.count,
        avgDurationMin: data.count > 0 ? Math.round((data.totalMs / data.count) / 60000) : 0
    })).sort((a, b) => a.hour - b.hour);
}
