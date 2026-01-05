export const pad2 = (n: number) => String(n).padStart(2, "0");

export const fmtTime = (ms: number) => {
    const d = new Date(ms);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

export const fmtDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}sa ${m % 60}dk`;
    return `${m}dk ${s % 60}sn`;
};

export const fmtCompact = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    if (hh > 0) return `${hh}:${pad2(mm)}`;
    return `${mm}:${pad2(ss)}`;
};

export const fmtHmFromMs = (ms: number) => {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h <= 0) return `${m} dk`;
    if (m === 0) return `${h} saat`;
    return `${h} saat ${m} dk`;
};

export const fmtHmFromHours = (hours: number) => fmtHmFromMs(Math.round(hours * 3600000));
