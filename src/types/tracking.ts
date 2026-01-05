export type Category = { id: string; name: string; color: string };
export type Topic = { id: string; name: string; color?: string };

export type ReadingStatus = "to_read" | "reading" | "done";
export type ReadingType = "book" | "article" | "chapter" | "thesis" | "other";

export type ReadingItem = {
    id: string;
    title: string;
    authors?: string;
    year?: string;
    type: ReadingType;
    status: ReadingStatus;
    tags: string[];
    url?: string;
    doi?: string;
    notes?: string;
    updatedAt: number;
    zoteroKey?: string;
    structuredNotes?: ReadingNote[]; // Zengin notlar (bölüm bağlantılı)
};

// Structured note with optional chapter link
export type ReadingNote = {
    id: string;
    content: string;
    createdAt: number;
    linkedChapterId?: string; // Hangi bölümle ilişkili
};

export type Session = {
    id: string;
    categoryId: string;
    topicId?: string;
    sourceId?: string;
    projectId?: string;  // Linked project
    chapterId?: string;  // Linked chapter
    label: string;
    start: number;
    end: number;
    pausedMs?: number;
};

export type Running = {
    categoryId: string;
    topicId?: string;
    sourceId?: string;
    projectId?: string;  // Linked project
    chapterId?: string;  // Linked chapter
    label: string;
    wallStart: number;
    lastStart: number;
    elapsedActiveMs: number;
    isPaused: boolean;
    pausedAt?: number;
};

export type DailyLog = {
    date: string;
    wordCount: number;
    projectBreakdown?: Record<string, number>; // projectId -> wordCount
    note?: string;
};

export type Milestone = {
    id: string;
    title: string;
    date: number;
    done: boolean;
};

export type Snapshot = {
    categories: Category[];
    topics: Topic[];
    reading: ReadingItem[];
    sessions: Session[];
    dailyTarget: number;
    dailyLogs?: DailyLog[];
    milestones?: Milestone[];
};

export type CloudStatus = "disabled" | "signed_out" | "signed_in" | "syncing" | "error";
export type RangeFilter = "all" | "today" | "week";
export type ReadingStatusFilter = "all" | ReadingStatus;

// ========= Chapter-based Progress Tracking =========
export type ChapterStatus = "draft" | "revision" | "completed";

export type Chapter = {
    id: string;
    title: string;
    projectId: string; // Linked project
    wordCountGoal: number;
    currentWordCount: number;
    status: ChapterStatus;
    order: number;
    deadline?: number;
    notes?: string;
    linkedReadingIds?: string[]; // IDs of ReadingItem
};

// ========= Theme System =========
export type ThemeMode = "light" | "dark" | "sepia" | "true-black";
export type ThemePreference = ThemeMode | "auto";

// ========= Smart Reminders =========
export type ReminderType = "streak" | "deadline" | "inactive" | "milestone";

export type Reminder = {
    id: string;
    type: ReminderType;
    message: string;
    createdAt: number;
    dismissed: boolean;
};

// ========= Citation Network =========
export type CitationLink = {
    source: string; // ReadingItem id
    target: string; // ReadingItem id
    strength: number; // 1-10, co-occurrence frequency in sessions
};

// ========= Multi-Project Support =========
export type ProjectType = "thesis" | "article" | "book" | "other";

export type Project = {
    id: string;
    title: string;
    type: ProjectType;
    goal: number; // Total word count goal
    deadline?: number;
    createdAt: number;
    categoryId?: string; // Optional: auto-select category when working on this project
};
