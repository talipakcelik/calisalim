import { ThemeMode, ThemePreference } from "@/types/tracking";

// Theme color definitions using OKLCH color space
export const THEME_MODES = {
    light: {
        background: "oklch(1 0 0)",
        foreground: "oklch(0.13 0.028 261.692)",
        card: "oklch(1 0 0)",
        cardForeground: "oklch(0.13 0.028 261.692)",
        popover: "oklch(1 0 0)",
        popoverForeground: "oklch(0.13 0.028 261.692)",
        primary: "oklch(0.21 0.034 264.665)",
        primaryForeground: "oklch(0.985 0.002 247.839)",
        secondary: "oklch(0.967 0.003 264.542)",
        secondaryForeground: "oklch(0.21 0.034 264.665)",
        muted: "oklch(0.967 0.003 264.542)",
        mutedForeground: "oklch(0.551 0.027 264.364)",
        accent: "oklch(0.967 0.003 264.542)",
        accentForeground: "oklch(0.21 0.034 264.665)",
        destructive: "oklch(0.577 0.245 27.325)",
        destructiveForeground: "oklch(0.985 0.002 247.839)",
        border: "oklch(0.928 0.006 264.531)",
        input: "oklch(0.928 0.006 264.531)",
        ring: "oklch(0.707 0.022 261.325)",
    },
    dark: {
        background: "oklch(0.13 0.028 261.692)",
        foreground: "oklch(0.985 0.002 247.839)",
        card: "oklch(0.21 0.034 264.665)",
        cardForeground: "oklch(0.985 0.002 247.839)",
        popover: "oklch(0.21 0.034 264.665)",
        popoverForeground: "oklch(0.985 0.002 247.839)",
        primary: "oklch(0.928 0.006 264.531)",
        primaryForeground: "oklch(0.21 0.034 264.665)",
        secondary: "oklch(0.278 0.033 256.848)",
        secondaryForeground: "oklch(0.985 0.002 247.839)",
        muted: "oklch(0.278 0.033 256.848)",
        mutedForeground: "oklch(0.707 0.022 261.325)",
        accent: "oklch(0.278 0.033 256.848)",
        accentForeground: "oklch(0.985 0.002 247.839)",
        destructive: "oklch(0.705 0.21 29.234)",
        destructiveForeground: "oklch(0.985 0.002 247.839)",
        border: "oklch(1 0 0 / 10%)",
        input: "oklch(0.278 0.033 256.848)",
        ring: "oklch(0.551 0.027 264.364)",
    },
    sepia: {
        background: "oklch(0.95 0.02 60)",
        foreground: "oklch(0.25 0.03 60)",
        card: "oklch(0.93 0.02 55)",
        cardForeground: "oklch(0.25 0.03 60)",
        popover: "oklch(0.93 0.02 55)",
        popoverForeground: "oklch(0.25 0.03 60)",
        primary: "oklch(0.45 0.12 40)",
        primaryForeground: "oklch(0.98 0.01 60)",
        secondary: "oklch(0.88 0.03 55)",
        secondaryForeground: "oklch(0.30 0.04 60)",
        muted: "oklch(0.88 0.03 55)",
        mutedForeground: "oklch(0.50 0.05 60)",
        accent: "oklch(0.85 0.04 50)",
        accentForeground: "oklch(0.30 0.04 60)",
        destructive: "oklch(0.55 0.20 30)",
        destructiveForeground: "oklch(0.98 0.01 60)",
        border: "oklch(0.85 0.03 55)",
        input: "oklch(0.85 0.03 55)",
        ring: "oklch(0.60 0.08 50)",
    },
    "true-black": {
        background: "oklch(0 0 0)",
        foreground: "oklch(0.95 0 0)",
        card: "oklch(0.08 0 0)",
        cardForeground: "oklch(0.95 0 0)",
        popover: "oklch(0.08 0 0)",
        popoverForeground: "oklch(0.95 0 0)",
        primary: "oklch(0.85 0.006 264.531)",
        primaryForeground: "oklch(0.08 0 0)",
        secondary: "oklch(0.15 0 0)",
        secondaryForeground: "oklch(0.95 0 0)",
        muted: "oklch(0.15 0 0)",
        mutedForeground: "oklch(0.65 0 0)",
        accent: "oklch(0.15 0 0)",
        accentForeground: "oklch(0.95 0 0)",
        destructive: "oklch(0.65 0.21 29.234)",
        destructiveForeground: "oklch(0.95 0 0)",
        border: "oklch(0.15 0 0)",
        input: "oklch(0.15 0 0)",
        ring: "oklch(0.50 0 0)",
    },
};

/**
 * Apply theme to document root
 */
export function applyTheme(mode: ThemeMode): void {
    const root = document.documentElement;
    const theme = THEME_MODES[mode];

    // Remove all theme classes
    root.classList.remove("light", "dark", "sepia", "true-black");

    // Add new theme class
    root.classList.add(mode);

    // Apply CSS variables
    Object.entries(theme).forEach(([key, value]) => {
        const cssVar = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
        root.style.setProperty(cssVar, value);
    });
}

/**
 * Get system theme preference
 */
export function getSystemTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Determine if auto-switch should occur based on time
 * @param hour Current hour (0-23)
 * @returns Theme mode to use
 */
export function shouldAutoSwitch(hour: number): ThemeMode {
    // Switch to dark mode at 18:00 (6 PM)
    // Switch back to light mode at 6:00 (6 AM)
    if (hour >= 18 || hour < 6) {
        return "dark";
    }
    return "light";
}

/**
 * Resolve theme preference to actual theme mode
 */
export function resolveTheme(preference: ThemePreference, autoSwitchEnabled: boolean = true): ThemeMode {
    if (preference === "auto") {
        if (autoSwitchEnabled) {
            const hour = new Date().getHours();
            return shouldAutoSwitch(hour);
        }
        return getSystemTheme();
    }
    return preference;
}
