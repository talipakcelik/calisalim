import { Session, Category, Topic, ReadingItem, DailyLog, Milestone, Chapter, Project } from "@/types/tracking";

export interface ExportData {
    exportedAt: string;
    version: string;
    categories: Category[];
    topics: Topic[];
    reading: ReadingItem[];
    sessions: Session[];
    dailyLogs: DailyLog[];
    milestones: Milestone[];
    chapters: Chapter[];
    projects: Project[];
}

/**
 * Export all application data as JSON string
 */
export function exportToJSON(data: Partial<ExportData>): string {
    const exportData: ExportData = {
        exportedAt: new Date().toISOString(),
        version: "1.0.0",
        categories: data.categories || [],
        topics: data.topics || [],
        reading: data.reading || [],
        sessions: data.sessions || [],
        dailyLogs: data.dailyLogs || [],
        milestones: data.milestones || [],
        chapters: data.chapters || [],
        projects: data.projects || [],
    };
    return JSON.stringify(exportData, null, 2);
}

/**
 * Export sessions as CSV string
 */
export function exportSessionsToCSV(
    sessions: Session[],
    categoryMap: Map<string, Category>,
    topicMap: Map<string, Topic>
): string {
    const headers = ["ID", "Kategori", "Konu", "Etiket", "Başlangıç", "Bitiş", "Süre (dk)"];

    const rows = sessions.map(s => {
        const cat = categoryMap.get(s.categoryId);
        const topic = s.topicId ? topicMap.get(s.topicId) : null;
        const durationMin = Math.round((s.end - s.start) / 60000);

        return [
            s.id,
            cat?.name || s.categoryId,
            topic?.name || "",
            s.label || "",
            new Date(s.start).toLocaleString("tr-TR"),
            new Date(s.end).toLocaleString("tr-TR"),
            durationMin.toString()
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",");
    });

    return [headers.join(","), ...rows].join("\n");
}

/**
 * Export daily logs as CSV
 */
export function exportDailyLogsToCSV(logs: DailyLog[]): string {
    const headers = ["Tarih", "Kelime Sayısı", "Not"];

    const rows = logs.map(l => [
        l.date,
        l.wordCount.toString(),
        l.note || ""
    ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","));

    return [headers.join(","), ...rows].join("\n");
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Helper: Generate filename with timestamp
 */
export function generateFilename(prefix: string, extension: string): string {
    const date = new Date().toISOString().split("T")[0];
    return `${prefix}_${date}.${extension}`;
}
