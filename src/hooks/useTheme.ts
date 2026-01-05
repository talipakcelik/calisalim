"use client";

import { useEffect, useState } from "react";
import { ThemeMode, ThemePreference } from "@/types/tracking";
import { applyTheme, getSystemTheme, resolveTheme } from "@/lib/theme";
import { usePersistentState } from "./usePersistentState";

export function useTheme() {
    const [preference, setPreference] = usePersistentState<ThemePreference>("theme-preference", "auto");
    const [autoSwitchEnabled, setAutoSwitchEnabled] = usePersistentState<boolean>("theme-auto-switch", true);
    const [currentTheme, setCurrentTheme] = useState<ThemeMode>("light");

    // Apply theme on mount and when preference changes
    useEffect(() => {
        const theme = resolveTheme(preference, autoSwitchEnabled);
        setCurrentTheme(theme);
        applyTheme(theme);
    }, [preference, autoSwitchEnabled]);

    // Listen for system theme changes when in auto mode
    useEffect(() => {
        if (preference !== "auto" || !autoSwitchEnabled) return;

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => {
            const theme = getSystemTheme();
            setCurrentTheme(theme);
            applyTheme(theme);
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [preference, autoSwitchEnabled]);

    // Auto-switch based on time (check every minute)
    useEffect(() => {
        if (preference !== "auto" || !autoSwitchEnabled) return;

        const checkTime = () => {
            const theme = resolveTheme(preference, autoSwitchEnabled);
            if (theme !== currentTheme) {
                setCurrentTheme(theme);
                applyTheme(theme);
            }
        };

        // Check immediately
        checkTime();

        // Check every minute
        const interval = setInterval(checkTime, 60000);
        return () => clearInterval(interval);
    }, [preference, autoSwitchEnabled, currentTheme]);

    return {
        theme: currentTheme,
        preference,
        setPreference,
        autoSwitchEnabled,
        setAutoSwitchEnabled,
    };
}
