import { DailyLog, Milestone, Reminder, Session } from "@/types/tracking";
import { uid } from "@/lib/helpers";

/**
 * Checks if the user has a writing streak and if they have written today.
 * Returns a reminder if the streak is at risk (e.g. hasn't written today by evening).
 */
export function checkStreakReminder(
    dailyLogs: DailyLog[]
): Reminder | null {
    // 1. Check if written today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayStr = startOfToday.toISOString().split("T")[0]; // naive YYYY-MM-DD

    const hasWrittenToday = dailyLogs.some(l => l.date === todayStr && l.wordCount > 0);
    if (hasWrittenToday) return null;

    // 2. Check if significant streak exists (e.g. written yesterday)
    const yesterday = new Date(startOfToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    const hasWrittenYesterday = dailyLogs.some(l => l.date === yesterdayStr && l.wordCount > 0);

    if (hasWrittenYesterday) {
        // Only verify time. If it's passed 18:00, nudge the user.
        const currentHour = new Date().getHours();
        if (currentHour >= 18) {
            return {
                id: uid(),
                type: "streak",
                message: "🔥 Seriyi bozma! Bugün henüz kelime girişi yapmadın. 15 dk bile olsa yazmaya ne dersin?",
                createdAt: Date.now(),
                dismissed: false
            };
        }
    }

    return null;
}

/**
 * Checks approaching deadlines within 7 days.
 */
export function checkDeadlineReminder(
    milestones: Milestone[]
): Reminder | null {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    // Find nearest pending milestone
    const upcoming = milestones
        .filter(m => !m.done && m.date > now)
        .sort((a, b) => a.date - b.date)[0];

    if (!upcoming) return null;

    const diff = upcoming.date - now;
    if (diff <= threeDaysMs && diff > 0) {
        const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
        return {
            id: uid(),
            type: "deadline",
            message: `⏰ Dikkat: "${upcoming.title}" hedefine sadece ${days} gün kaldı!`,
            createdAt: Date.now(),
            dismissed: false
        };
    }

    return null;
}

/**
 * Checks simple inactivity regarding specific crucial category.
 */
export function checkInactivityReminder(
    sessions: Session[],
    categoryId: string, // e.g. "phd"
    categoryName: string
): Reminder | null {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    // Find last session in category
    const lastSession = sessions
        .filter(s => s.categoryId === categoryId)
        .sort((a, b) => b.end - a.end)[0];

    if (!lastSession) return null; // Never worked on it, maybe new user, don't annoy.

    if (now - lastSession.end > threeDaysMs) {
        return {
            id: uid(),
            type: "inactive",
            message: `🕸️ "${categoryName}" üzerinde çalışmayalı 3 gün oldu. Küçük bir ısınma turu atmak ister misin?`,
            createdAt: Date.now(),
            dismissed: false
        };
    }

    return null;
}
