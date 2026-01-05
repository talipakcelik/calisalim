import { useState, useEffect, useCallback } from "react";
import { Category, DailyLog, Milestone, Reminder, Session } from "@/types/tracking";
import { checkDeadlineReminder, checkInactivityReminder, checkStreakReminder } from "@/lib/reminderLogic";
import { usePersistentState } from "./usePersistentState";

export function useReminders({
    sessions,
    dailyLogs,
    milestones,
    categories
}: {
    sessions: Session[];
    dailyLogs: DailyLog[];
    milestones: Milestone[];
    categories: Category[];
}) {
    // Store dismissed reminders to avoid spamming
    const [dismissedIds, setDismissedIds] = usePersistentState<string[]>("reminders.dismissed", []);
    const [activeReminders, setActiveReminders] = useState<Reminder[]>([]);

    const checkForReminders = useCallback(() => {
        const newReminders: Reminder[] = [];

        // 1. Streak Validity
        const streakRem = checkStreakReminder(dailyLogs);
        if (streakRem) newReminders.push(streakRem);

        // 2. Deadline Proximity
        const deadlineRem = checkDeadlineReminder(milestones);
        if (deadlineRem) newReminders.push(deadlineRem);

        // 3. PhD Inactivity (assuming 'phd' or 'thesis' id)
        // Try to find the PhD category
        const phdCat = categories.find(c =>
            c.id === 'phd' ||
            c.name.toLowerCase().includes('tez') ||
            c.name.toLowerCase().includes('thesis')
        );

        if (phdCat) {
            const inactiveRem = checkInactivityReminder(sessions, phdCat.id, phdCat.name);
            if (inactiveRem) newReminders.push(inactiveRem);
        }

        // Filter out simple duplicates based on message content type to avoid re-generating same ID
        // In a real app we'd use stable ID generation based on day/context.
        // For now, let's just filter out if message seems already dismissed recently?
        // Actually, we generated random IDs. 
        // Let's filter active reminders: if user dismissed a "type:streak" TODAY, don't show another streak reminder.
        // This requires smarter dismissal storage (id + timestamp). For MVP: simple ID storage is tricky if IDs regenerate.

        // BETTER APPROACH FOR MVP:
        // Don't use random IDs in helper. Use deterministic IDs: `streak-${todayStr}`, `deadline-${milestoneId}`.
        // Let's update the Logic manually here or assume helpers return stable IDs if modified.
        // For now, let's trust the user won't refresh constantly or we just accept ID regen on page load is fine, 
        // but we need to check if *message* content was dismissed.

        // Simple dedupe against dismissed IDs is not enough if ID regenerates.
        // Let's filter by content usage in dismissed logic? No, too complex.

        // Let's just set the state. The user sees them. If they dismiss, we add that ID to dismissed list.
        // PROBLEM: `check` runs on interval. It generates NEW IDs every time.
        // FIX: `reminderLogic` functions should accept a 'seed' or return stable IDs.
        // Let's patch this by not regenerating if one of that type already exists in active list?

        setActiveReminders(prev => {
            // Merge strategy: Keep existing ones if they match type/message? 
            // Simplified: Just set new ones, but filter out if match 'dismissed' logic based on TYPE for today?
            // Let's keep it simple: Show them. If user dismisses, we save that specific ID. 
            // BUT since IDs regenerate, we can't persist dismissal effectively across reloads/re-checks without stable IDs.
            // ...
            // Let's assume for this MVP, reminders are transient in session or we accept this limitation.
            // To make it better, let's manually assign stable IDs here.

            return newReminders.map(r => {
                // Stabilize ID
                if (r.type === 'streak') r.id = `streak-${new Date().toDateString()}`;
                if (r.type === 'deadline') r.id = `deadline-${r.message.length}`; // crude stable hash
                if (r.type === 'inactive') r.id = `inactive-${phdCat?.id || 'gen'}-${new Date().toDateString()}`;
                return r;
            }).filter(r => !dismissedIds.includes(r.id));
        });

    }, [dailyLogs, milestones, sessions, categories, dismissedIds]);

    // Check on mount and interval
    useEffect(() => {
        checkForReminders();
        const t = setInterval(checkForReminders, 60 * 60 * 1000); // Hourly
        return () => clearInterval(t);
    }, [checkForReminders]);

    const dismissReminder = (id: string) => {
        setDismissedIds(prev => [...prev, id]);
        setActiveReminders(prev => prev.filter(r => r.id !== id));
    };

    return { reminders: activeReminders, dismissReminder };
}
