import { Session } from "@/types/tracking";

export const uid = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;

export const startOfDayMs = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
};

export const startOfWeekMs = (d: Date) => {
    const x = new Date(d);
    const day = x.getDay();
    const diff = x.getDate() - day + (day === 0 ? -6 : 1);
    x.setDate(diff);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
};

export const sessionDurationMs = (s: Session) => Math.max(0, (s.end - s.start) - (s.pausedMs ?? 0));
export const wallDurationMs = (s: Session) => Math.max(0, s.end - s.start);

export const overlapActiveMs = (s: Session, rangeStart: number, rangeEnd: number) => {
    const w = wallDurationMs(s);
    if (w <= 0) return 0;
    const o = Math.max(0, Math.min(s.end, rangeEnd) - Math.max(s.start, rangeStart));
    if (o <= 0) return 0;
    const active = sessionDurationMs(s);
    return Math.max(0, Math.round(active * (o / w)));
};

export const getCategoryPlaceholder = (catId: string, catName?: string) => {
    const lowerName = (catName || "").toLowerCase();
    const lowerId = catId.toLowerCase();
    if (lowerId === "phd" || lowerId.includes("tez") || lowerName.includes("tez") || lowerName.includes("doktora")) {
        return "Bölüm, argüman, not...";
    }
    if (lowerId === "reading" || lowerName.includes("okuma")) return "Okuduğun bölüm/konu...";
    if (lowerId === "writing" || lowerName.includes("yaz")) return "Yazdığın kısım...";
    if (lowerId === "work" || lowerName.includes("iş")) return "Görev / proje...";
    return "Ne üzerinde çalışıyorsun?";
};

export const getUniqueLabelsForCategory = (sessions: Session[], categoryId: string) => {
    const labels = sessions
        .filter((s) => s.categoryId === categoryId && s.label && s.label.trim().length > 0)
        .map((s) => s.label.trim());
    return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b, "tr-TR"));
};

export const parseTags = (raw: string) =>
    raw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

export function roundToNearest5Min(ms: number) {
    const d = new Date(ms);
    const m = d.getMinutes();
    const rounded = Math.round(m / 5) * 5;

    if (rounded === m && d.getSeconds() === 0 && d.getMilliseconds() === 0) return ms;

    if (rounded >= 60) {
        d.setHours(d.getHours() + 1);
        d.setMinutes(0, 0, 0);
        return d.getTime();
    }

    d.setMinutes(rounded, 0, 0);
    return d.getTime();
}
