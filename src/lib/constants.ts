import { Category, Topic } from "@/types/tracking";

export const OLD_COLOR_MAP: Record<string, string> = {
    "bg-indigo-500": "#6366f1",
    "bg-blue-500": "#3b82f6",
    "bg-emerald-500": "#10b981",
    "bg-rose-500": "#f43f5e",
    "bg-amber-500": "#f59e0b",
    "bg-slate-500": "#64748b",
    "bg-red-500": "#ef4444",
    "bg-orange-500": "#f97316",
    "bg-yellow-500": "#eab308",
    "bg-green-500": "#22c55e",
    "bg-teal-500": "#14b8a6",
    "bg-cyan-500": "#06b6d4",
    "bg-sky-500": "#0ea5e9",
    "bg-violet-500": "#8b5cf6",
    "bg-purple-500": "#a855f7",
    "bg-fuchsia-500": "#d946ef",
    "bg-pink-500": "#ec4899",
};

export const DEFAULT_CATEGORIES: Category[] = [
    { id: "phd", name: "PhD / Tez", color: "#6366f1" },
    { id: "work", name: "İş", color: "#3b82f6" },
    { id: "reading", name: "Okuma", color: "#10b981" },
    { id: "writing", name: "Yazma", color: "#f43f5e" },
    { id: "admin", name: "İdari", color: "#f59e0b" },
    { id: "other", name: "Diğer", color: "#64748b" },
];

export const DEFAULT_TOPICS: Topic[] = [
    { id: "lit", name: "Literatür Tarama", color: "#0ea5e9" },
    { id: "methods", name: "Yöntem", color: "#8b5cf6" },
    { id: "analysis", name: "Analiz", color: "#f97316" },
];

export const getRandomBrightColor = () => {
    const colors = [
        "#ef4444",
        "#f97316",
        "#f59e0b",
        "#84cc16",
        "#10b981",
        "#06b6d4",
        "#3b82f6",
        "#6366f1",
        "#8b5cf6",
        "#d946ef",
        "#f43f5e",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
};

/** ========= Storage keys ========= */
export const LS_CATEGORIES = "talip-v2.categories";
export const LS_TOPICS = "talip-v2.topics";
export const LS_READING = "talip-v2.reading";
export const LS_SESSIONS = "talip-v2.sessions";
export const LS_TARGET = "talip-v2.target";
export const LS_UPDATED_AT = "talip-v2.updatedAt";
export const LS_RUNNING = "talip-v2.running";
export const LS_LOGS = "talip-v2.logs";
export const LS_MILESTONES = "talip-v2.milestones";
