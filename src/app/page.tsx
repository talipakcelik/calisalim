"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription as ShadcnDialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Play,
  Square,
  Trash2,
  Timer,
  TrendingUp,
  Cloud,
  LogOut,
  RefreshCw,
  Mail,
  Search,
  Download,
  Filter,
  Loader2,
  BarChart3,
  Calendar as CalendarIcon,
  PieChart as PieChartIcon,
  MoreVertical,
  Target,
  Flame,
  Plus,
  Pencil,
  X,
  Pause,
  CheckCircle2,
  AlertTriangle,
  Info,
  BookOpen,
  Link as LinkIcon,
  Database,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  Area,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import {
  Category,
  Topic,
  ReadingStatus,
  ReadingType,
  ReadingItem,
  Session,
  Running,
  DailyLog,
  Milestone,
  Snapshot,
  CloudStatus,
  RangeFilter,
  ReadingStatusFilter
} from "@/types/tracking";

import {
  OLD_COLOR_MAP,
  DEFAULT_CATEGORIES,
  DEFAULT_TOPICS,
  getRandomBrightColor,
  LS_CATEGORIES,
  LS_TOPICS,
  LS_READING,
  LS_SESSIONS,
  LS_TARGET,
  LS_UPDATED_AT,
  LS_RUNNING,
  LS_LOGS,
  LS_MILESTONES
} from "@/lib/constants";

import {
  fmtTime,
  fmtDuration,
  fmtCompact,
  fmtHmFromMs,
  fmtHmFromHours,
  pad2
} from "@/lib/formatters";

import {
  uid,
  startOfDayMs,
  startOfWeekMs,
  sessionDurationMs,
  wallDurationMs,
  overlapActiveMs,
  getCategoryPlaceholder,
  getUniqueLabelsForCategory,
  parseTags,
  roundToNearest5Min
} from "@/lib/helpers";

import { parseBulkBibtex } from "@/lib/bibtex";

import { supabase } from "@/lib/supabase";
import { usePersistentState } from "@/hooks/usePersistentState";

import { ActiveTimer } from "@/components/tracking/ActiveTimer";
import { ActivityHeatmap } from "@/components/tracking/ActivityHeatmap";
import { SessionDialog } from "@/components/tracking/SessionDialog";
import { ReadingDialog } from "@/components/tracking/ReadingDialog";
import { ThesisDashboard } from "@/components/tracking/ThesisDashboard";
import { ProjectTimeline } from "@/components/tracking/ProjectTimeline";
import { Scratchpad } from "@/components/tracking/Scratchpad";
import { ChapterBoard } from "@/components/tracking/ChapterBoard";
import { WritingAnalytics } from "@/components/tracking/WritingAnalytics";
import { fetchZoteroItems } from "@/lib/zotero";
import { WordCountDialog } from "@/components/tracking/WordCountDialog";
import { MilestoneDialog } from "@/components/tracking/MilestoneDialog";
import { MilestonesWidget } from "@/components/tracking/MilestonesWidget";

import { MiniDateTimePicker } from "@/components/ui/custom/MiniDateTimePicker";
import { ToastViewport, ToastItem, ToastType } from "@/components/ui/custom/ToastViewport";
import { ConfirmDialog } from "@/components/ui/custom/ConfirmDialog";

import { useTheme } from "@/hooks/useTheme";
import { useReminders } from "@/hooks/useReminders";
import { ReminderPanel } from "@/components/tracking/ReminderPanel";
import { ChapterDialog } from "@/components/tracking/ChapterDialog";
import { Chapter, Project, ProjectType } from "@/types/tracking";
import { FolderPlus, Layout, GraduationCap, Book, FileText } from "lucide-react";


/** ========= Page ========= */
export default function Page() {
  // 1. BU SATIRLARI EKLE (Mevcut kodunun en başına)
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Theme hook initialization
  useTheme();

  /** ========= Toast state ========= */
  const toastActionsRef = useRef<Map<string, () => void>>(new Map());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t?.actionId) toastActionsRef.current.delete(t.actionId);
      return prev.filter((x) => x.id !== id);
    });
  };
  // --- Zotero State ---
  const [zoteroDialogOpen, setZoteroDialogOpen] = useState(false);
  // Anahtarları tarayıcı hafızasında (localStorage) tutuyoruz, böylece her seferinde girmene gerek kalmaz.
  const [zoteroApiKey, setZoteroApiKey] = usePersistentState("talip-v2.zotero_api_key", "");
  const [zoteroUserId, setZoteroUserId] = usePersistentState("talip-v2.zotero_user_id", "");
  const [isSyncingZotero, setIsSyncingZotero] = useState(false);
  const handleToastAction = useCallback((actionId: string) => {
    const fn = toastActionsRef.current.get(actionId);
    if (fn) fn();
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, title?: string, action?: { label: string; onClick: () => void }) => {
      const id = uid();
      const actionId = action ? uid() : undefined;

      if (actionId && action) toastActionsRef.current.set(actionId, action.onClick);

      setToasts((prev) => [{ id, type, message, title, actionLabel: action?.label, actionId }, ...prev].slice(0, 4));

      const ttl = action ? 6500 : 3200;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
        if (actionId) toastActionsRef.current.delete(actionId);
      }, ttl);
    },
    []
  );

  /** ========= Persistent state ========= */
  const [categories, setCategories, catsHydrated] = usePersistentState<Category[]>(LS_CATEGORIES, DEFAULT_CATEGORIES);
  const [topics, setTopics, topicsHydrated] = usePersistentState<Topic[]>(LS_TOPICS, DEFAULT_TOPICS);
  const [reading, setReading, readingHydrated] = usePersistentState<ReadingItem[]>(LS_READING, []);
  const [sessions, setSessions, sessionsHydrated] = usePersistentState<Session[]>(LS_SESSIONS, []);
  const [dailyTarget, setDailyTarget] = usePersistentState<number>(LS_TARGET, 2);
  const [localUpdatedAt, setLocalUpdatedAt] = usePersistentState<number>(LS_UPDATED_AT, 0);

  // ... const [reading, setReading...] satırının altı ...

  // --- YENİ STATE'LER ---
  const [dailyLogs, setDailyLogs] = usePersistentState<DailyLog[]>(LS_LOGS, []);
  const [milestones, setMilestones] = usePersistentState<Milestone[]>(LS_MILESTONES, []);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);

  // Bugünün verisi
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLog = dailyLogs.find(l => l.date === todayStr);

  // --- BibTeX Import State (BUNU EKLE) ---
  const [isImportingBib, setIsImportingBib] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** ========= Runtime state ========= */
  const [running, setRunning] = useState<Running | null>(null);

  // tick for analytics
  const [nowForCalculations, setNowForCalculations] = useState(Date.now());

  // Quick start
  const [quickCat, setQuickCat] = useState<string>("");
  const [quickTopicId, setQuickTopicId] = useState<string>("none");
  const [quickSourceId, setQuickSourceId] = useState<string>("none");
  const [quickProjectId, setQuickProjectId] = useState<string>("none");
  const [quickLabel, setQuickLabel] = useState("");

  // Filters (sessions)
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Reading filters
  const [readingQuery, setReadingQuery] = useState("");
  const [readingStatusFilter, setReadingStatusFilter] = useState<ReadingStatusFilter>("all");

  // Pagination
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);

  // Dialogs
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  const [readingDialogOpen, setReadingDialogOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<ReadingItem | null>(null);

  const [resetOpen, setResetOpen] = useState(false);

  // Chapter State
  const [chapters, setChapters] = usePersistentState<Chapter[]>("chapters", []);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [isChapterDialogOpen, setIsChapterDialogOpen] = useState(false);

  // --- PROJECT STATE & MIGRATION ---
  const [projects, setProjects] = usePersistentState<Project[]>("projects", []);
  const [selectedProjectId, setSelectedProjectId] = usePersistentState<string>("selectedProjectId", "");
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectType, setNewProjectType] = useState<ProjectType>("other");
  const [newProjectGoal, setNewProjectGoal] = useState("50000");

  // Migration: Init default project if none exists
  useEffect(() => {
    if (isMounted && projects.length === 0) {
      const defaultProject: Project = {
        id: "default-thesis",
        title: "Doktora Tezi",
        type: "thesis",
        goal: 80000,
        createdAt: Date.now(),
        categoryId: "phd" // Assuming 'phd' is the default thesis category id
      };
      setProjects([defaultProject]);
      setSelectedProjectId("default-thesis");

      // Migrate existing chapters to this project
      setChapters(prev => prev.map(c => ({ ...c, projectId: "default-thesis" })));

      toast("info", "Mevcut veriler 'Doktora Tezi' projesine taşındı.");
    } else if (isMounted && !selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [isMounted, projects.length, selectedProjectId, setProjects, setSelectedProjectId, setChapters, toast]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0];
  }, [projects, selectedProjectId]);

  const filteredChapters = useMemo(() => {
    return activeProject ? chapters.filter(c => c.projectId === activeProject.id) : [];
  }, [chapters, activeProject]);

  const handleAddProject = () => {
    if (!newProjectTitle.trim()) return;

    const newProject: Project = {
      id: uid(),
      title: newProjectTitle.trim(),
      type: newProjectType,
      goal: parseInt(newProjectGoal) || 50000,
      createdAt: Date.now()
    };

    setProjects(prev => [...prev, newProject]);
    setSelectedProjectId(newProject.id);
    setIsNewProjectDialogOpen(false);
    setNewProjectTitle("");
    setNewProjectGoal("50000");
    toast("success", "Yeni proje oluşturuldu.");
  };

  const handleChapterSave = (chapter: Chapter) => {
    setChapters(prev => {
      const exists = prev.find(c => c.id === chapter.id);
      if (exists) {
        return prev.map(c => c.id === chapter.id ? chapter : c);
      }
      // Ensure new chapters get the active project ID
      return [...prev, { ...chapter, projectId: activeProject?.id || "default-thesis" }];
    });
    setEditingChapter(null);
    toast("success", "Bölüm kaydedildi.");
  };

  // Confirm dialogs
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  const [confirmDeleteTopicId, setConfirmDeleteTopicId] = useState<string | null>(null);
  const [confirmDeleteReadingId, setConfirmDeleteReadingId] = useState<string | null>(null);
  const [confirmLoadHeatmapDemo, setConfirmLoadHeatmapDemo] = useState(false);
  const [confirmLoadDemoData, setConfirmLoadDemoData] = useState(false);

  // Category / Topic create
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");

  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicColor, setNewTopicColor] = useState("#0ea5e9");

  // Undo buffers
  const undoSessionRef = useRef<{ item: Session; timer: number } | null>(null);
  const undoCategoryRef = useRef<{ item: Category; timer: number } | null>(null);
  const undoTopicRef = useRef<{ item: Topic; timer: number } | null>(null);
  const undoReadingRef = useRef<{ item: ReadingItem; timer: number } | null>(null);

  // --- Cloud state ---
  const [user, setUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(supabase ? "signed_out" : "disabled");
  const [cloudMsg, setCloudMsg] = useState<string>(supabase ? "Bulut hazır" : "Bulut kapalı (ENV yok)");
  const [authEmail, setAuthEmail] = useState("");

  const isHydratingFromCloud = useRef(false);
  const saveDebounceRef = useRef<number | null>(null);

  // keep latest snapshot
  const stateRef = useRef({
    categories,
    topics,
    reading,
    sessions,
    dailyTarget,
    localUpdatedAt,
    dailyLogs,
    milestones,
  });

  useEffect(() => {
    stateRef.current = {
      categories,
      topics,
      reading,
      sessions,
      dailyTarget,
      localUpdatedAt,
      dailyLogs,
      milestones,
    };
  }, [categories, topics, reading, sessions, dailyTarget, localUpdatedAt, dailyLogs, milestones]);

  /** ========= Cloud RLS/policy helper ========= */
  const formatCloudError = useCallback((msg: string) => {
    const m = (msg || "").toLowerCase();

    // Common Supabase RLS message patterns
    if (m.includes("row-level security") || m.includes("rls") || m.includes("permission denied")) {
      return (
        "RLS / policy engeli görünüyor. Supabase > user_data tablosu için aşağıdakiler olmalı:\n" +
        "• RLS: ON\n" +
        "• Policies:\n" +
        "  - SELECT: (auth.uid() = user_id)\n" +
        "  - INSERT: (auth.uid() = user_id)\n" +
        "  - UPDATE: (auth.uid() = user_id)\n" +
        "Not: Bu app anon key ile çalıştığı için policy şart."
      );
    }

    return msg || "Bilinmeyen hata";
  }, []);

  /** ========= Migrations ========= */
  useEffect(() => {
    if (!catsHydrated) return;
    const needsFix = (categories ?? []).some((c: any) => !c?.color || typeof c.color !== "string" || !c.color.startsWith("#"));
    if (!needsFix) return;

    const fixed = (categories ?? []).map((c: any) => {
      if (!c?.color || typeof c.color !== "string" || !c.color.startsWith("#")) {
        const newColor = OLD_COLOR_MAP[String(c?.color)] || getRandomBrightColor();
        return { ...c, color: newColor };
      }
      return c;
    });

    setCategories(fixed);
    setLocalUpdatedAt(Date.now());
  }, [catsHydrated, categories, setCategories, setLocalUpdatedAt]);

  /** ========= now tick ========= */
  useEffect(() => {
    const t = window.setInterval(() => setNowForCalculations(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, []);

  /** ========= Ensure quickCat always valid ========= */
  useEffect(() => {
    const first = categories?.[0]?.id;
    if (!first) return;
    if (!quickCat) setQuickCat(first);
    else if (!categories.find((c) => c.id === quickCat)) setQuickCat(first);
  }, [categories, quickCat]);

  /** ========= Maps ========= */
  const categoryMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const projectMap = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const topicMap = useMemo(() => new Map((topics ?? []).map((t) => [t.id, t])), [topics]);
  const readingMap = useMemo(() => new Map((reading ?? []).map((r) => [r.id, r])), [reading]);

  const getCatHex = useCallback(
    (catId: string) => {
      const cat = categories.find((c) => c.id === catId);
      return cat ? cat.color : "#64748b";
    },
    [categories]
  );

  const stackKeys = useMemo(() => (categories ?? []).map((c) => c.id), [categories]);

  const theme = useMemo(() => {
    const activeCat = running?.categoryId || quickCat || categories?.[0]?.id || "other";
    const hex = getCatHex(activeCat);
    const cat = categoryMap.get(activeCat);
    const name = cat?.name ?? "Çalışma";
    return { activeCat, hex, name };
  }, [running?.categoryId, quickCat, categories, categoryMap, getCatHex]);

  /** ========= Suggested labels ========= */
  const quickStartSuggestions = useMemo(() => {
    if (!quickCat) return [];
    return getUniqueLabelsForCategory(sessions ?? [], quickCat);
  }, [sessions, quickCat]);

  const quickStartPlaceholder = useMemo(() => {
    const cat = categoryMap.get(quickCat);
    return getCategoryPlaceholder(quickCat, cat?.name);
  }, [quickCat, categoryMap]);

  /** ========= Running persistence ========= */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LS_RUNNING);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Running;

      const ok =
        parsed &&
        typeof parsed.wallStart === "number" &&
        typeof parsed.lastStart === "number" &&
        typeof parsed.elapsedActiveMs === "number" &&
        typeof parsed.categoryId === "string" &&
        typeof parsed.label === "string" &&
        typeof parsed.isPaused === "boolean";

      if (!ok) {
        window.localStorage.removeItem(LS_RUNNING);
        return;
      }

      setRunning(parsed);
      setQuickCat(parsed.categoryId);
      setQuickLabel(parsed.label);
      setQuickTopicId(parsed.topicId ?? "none");
      setQuickSourceId(parsed.sourceId ?? "none");
      toast("info", "Aktif sayaç geri yüklendi.");
    } catch {
      try {
        window.localStorage.removeItem(LS_RUNNING);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!running) window.localStorage.removeItem(LS_RUNNING);
      else window.localStorage.setItem(LS_RUNNING, JSON.stringify(running));
    } catch {
      // ignore
    }
  }, [running]);

  /** ========= Pause/Resume helpers ========= */
  const currentActiveMs = useCallback((r: Running, nowMs: number) => {
    if (r.isPaused) return r.elapsedActiveMs;
    return r.elapsedActiveMs + (nowMs - r.lastStart);
  }, []);

  // Reminders
  const { reminders, dismissReminder } = useReminders({
    sessions,
    dailyLogs,
    milestones,
    categories
  });

  const pauseRunning = useCallback(() => {
    setRunning((r) => {
      if (!r || r.isPaused) return r;
      const now = Date.now();
      const elapsed = r.elapsedActiveMs + (now - r.lastStart);
      return { ...r, isPaused: true, pausedAt: now, elapsedActiveMs: elapsed };
    });
  }, []);

  const resumeRunning = useCallback(() => {
    setRunning((r) => {
      if (!r || !r.isPaused) return r;
      return { ...r, isPaused: false, pausedAt: undefined, lastStart: Date.now() };
    });
  }, []);

  /** ========= Session controls ========= */
  const startSession = useCallback(() => {
    if (running) return;
    const catId = quickCat || categories?.[0]?.id;
    if (!catId) return;

    const now = Date.now();
    const next: Running = {
      categoryId: catId,
      topicId: quickTopicId && quickTopicId !== "none" ? quickTopicId : undefined,
      sourceId: quickSourceId && quickSourceId !== "none" ? quickSourceId : undefined,
      projectId: quickProjectId && quickProjectId !== "none" ? quickProjectId : undefined,
      label: quickLabel.trim(),
      wallStart: now,
      lastStart: now,
      elapsedActiveMs: 0,
      isPaused: false,
    };

    setRunning(next);
  }, [running, quickCat, categories, quickTopicId, quickSourceId, quickProjectId, quickLabel]);

  const stopSessionFixed = useCallback(() => {
    if (!running) return;
    const now = Date.now();

    const wallStart = running.wallStart ?? now;
    const wallDuration = Math.max(0, now - wallStart);

    const activeMs = currentActiveMs(running, now);
    const pausedMs = Math.max(0, wallDuration - activeMs);

    const newSession: Session = {
      id: uid(),
      categoryId: running.categoryId,
      topicId: running.topicId,
      sourceId: running.sourceId,
      projectId: running.projectId,
      chapterId: running.chapterId,
      label: running.label,
      start: wallStart,
      end: now,
      pausedMs,
    };

    // Check for writing session to prompt word count
    const cat = categoryMap.get(running.categoryId);
    const catName = cat?.name.toLowerCase() || "";
    if (catName.includes("yazma") || catName.includes("tez") || catName.includes("write") || catName.includes("thesis")) {
      setWordCountOpen(true);
    }

    setSessions((prev) => [newSession, ...(prev ?? [])]);
    setLocalUpdatedAt(Date.now());
    setRunning(null);
    setQuickLabel("");
    toast("success", "Kayıt kaydedildi.");
  }, [running, currentActiveMs, setSessions, setLocalUpdatedAt, toast, categoryMap, setWordCountOpen]);

  /** ========= Undo helpers ========= */
  const scheduleUndo = useCallback(
    (kind: "session" | "category" | "topic" | "reading", payload: any) => {
      const ttl = 7000;

      const make = (ref: React.MutableRefObject<any>, restore: () => void, msg: string) => {
        if (ref.current) {
          window.clearTimeout(ref.current.timer);
          ref.current = null;
        }
        const timer = window.setTimeout(() => {
          ref.current = null;
        }, ttl);

        ref.current = { item: payload, timer };

        toast("info", msg, undefined, {
          label: "Geri al",
          onClick: () => {
            const cur = ref.current?.item;
            if (!cur) return;

            restore();

            window.clearTimeout(ref.current.timer);
            ref.current = null;
            toast("success", "Geri alındı.");
          },
        });
      };

      if (kind === "session") {
        make(
          undoSessionRef,
          () => {
            setSessions((prev) => [payload as Session, ...(prev ?? [])].sort((a, b) => b.start - a.start));
            setLocalUpdatedAt(Date.now());
          },
          "Kayıt silindi."
        );
      } else if (kind === "category") {
        make(
          undoCategoryRef,
          () => {
            setCategories((prev) => (prev.some((c) => c.id === payload.id) ? prev : [...prev, payload as Category]));
            setLocalUpdatedAt(Date.now());
          },
          "Kategori silindi."
        );
      } else if (kind === "topic") {
        make(
          undoTopicRef,
          () => {
            setTopics((prev) => (prev.some((t) => t.id === payload.id) ? prev : [...prev, payload as Topic]));
            setLocalUpdatedAt(Date.now());
          },
          "Konu silindi."
        );
      } else {
        make(
          undoReadingRef,
          () => {
            setReading((prev) =>
              prev.some((r) => r.id === payload.id)
                ? prev
                : [payload as ReadingItem, ...prev].sort((a, b) => b.updatedAt - a.updatedAt)
            );
            setLocalUpdatedAt(Date.now());
          },
          "Kaynak silindi."
        );
      }
    },
    [setSessions, setCategories, setTopics, setReading, setLocalUpdatedAt, toast]
  );

  /** ========= CRUD: Sessions ========= */
  const openCreateDialog = () => {
    setEditingSession(null);
    setSessionDialogOpen(true);
  };
  const openEditDialog = (s: Session) => {
    setEditingSession(s);
    setSessionDialogOpen(true);
  };

  const handleSessionSave = (data: Partial<Session>) => {
    if (data.id) {
      setSessions((prev) => (prev ?? []).map((s) => (s.id === data.id ? ({ ...s, ...data } as Session) : s)));
      setLocalUpdatedAt(Date.now());
      return;
    }

    const newSession: Session = {
      id: uid(),
      categoryId: data.categoryId!,
      topicId: data.topicId,
      sourceId: data.sourceId,
      label: data.label || "",
      start: data.start!,
      end: data.end!,
      pausedMs: 0,
    };

    setSessions((prev) => [newSession, ...(prev ?? [])]);
    setLocalUpdatedAt(Date.now());
  };

  const deleteSessionConfirmed = useCallback(() => {
    if (!confirmDeleteSessionId) return;
    const deleted = (sessions ?? []).find((s) => s.id === confirmDeleteSessionId);
    setSessions((prev) => (prev ?? []).filter((s) => s.id !== confirmDeleteSessionId));
    setLocalUpdatedAt(Date.now());
    setConfirmDeleteSessionId(null);

    if (deleted) scheduleUndo("session", deleted);
    else toast("success", "Kayıt silindi.");
  }, [confirmDeleteSessionId, sessions, setSessions, setLocalUpdatedAt, scheduleUndo, toast]);

  /** ========= CRUD: Categories ========= */
  const updateCategory = (id: string, field: keyof Category, value: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    setLocalUpdatedAt(Date.now());
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newId = `cat_${Date.now()}`;
    const newCat: Category = { id: newId, name: newCatName.trim(), color: newCatColor };
    setCategories((prev) => [...prev, newCat]);
    setNewCatName("");
    setLocalUpdatedAt(Date.now());
    toast("success", "Kategori eklendi.");
  };

  const deleteCategoryConfirmed = useCallback(() => {
    if (!confirmDeleteCategoryId) return;
    if ((categories ?? []).length <= 1) {
      toast("error", "En az bir kategori kalmalı.");
      return;
    }

    const deleted = (categories ?? []).find((c) => c.id === confirmDeleteCategoryId);
    setCategories((prev) => prev.filter((c) => c.id !== confirmDeleteCategoryId));
    setLocalUpdatedAt(Date.now());
    setConfirmDeleteCategoryId(null);

    if (deleted) scheduleUndo("category", deleted);
    else toast("success", "Kategori silindi.");
  }, [confirmDeleteCategoryId, categories, setCategories, setLocalUpdatedAt, scheduleUndo, toast]);

  /** ========= CRUD: Topics ========= */
  const updateTopic = (id: string, field: keyof Topic, value: string) => {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
    setLocalUpdatedAt(Date.now());
  };

  const addTopic = () => {
    if (!newTopicName.trim()) return;
    const newId = `topic_${Date.now()}`;
    const t: Topic = { id: newId, name: newTopicName.trim(), color: newTopicColor };
    setTopics((prev) => [...prev, t]);
    setNewTopicName("");
    setLocalUpdatedAt(Date.now());
    toast("success", "Konu eklendi.");
  };

  const deleteTopicConfirmed = useCallback(() => {
    if (!confirmDeleteTopicId) return;
    const deleted = (topics ?? []).find((t) => t.id === confirmDeleteTopicId);
    setTopics((prev) => prev.filter((t) => t.id !== confirmDeleteTopicId));
    setLocalUpdatedAt(Date.now());
    setConfirmDeleteTopicId(null);

    if (deleted) scheduleUndo("topic", deleted);
    else toast("success", "Konu silindi.");
  }, [confirmDeleteTopicId, topics, setTopics, setLocalUpdatedAt, scheduleUndo, toast]);

  /** ========= CRUD: Reading ========= */
  const openCreateReading = () => {
    setEditingReading(null);
    setReadingDialogOpen(true);
  };
  const openEditReading = (item: ReadingItem) => {
    setEditingReading(item);
    setReadingDialogOpen(true);
  };

  const saveReadingItem = (item: ReadingItem) => {
    setReading((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      const next = exists ? prev.map((x) => (x.id === item.id ? item : x)) : [item, ...prev];
      return next.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    });
    setLocalUpdatedAt(Date.now());
  };

  const deleteReadingConfirmed = useCallback(() => {
    if (!confirmDeleteReadingId) return;
    const deleted = (reading ?? []).find((r) => r.id === confirmDeleteReadingId);
    setReading((prev) => (prev ?? []).filter((r) => r.id !== confirmDeleteReadingId));
    setLocalUpdatedAt(Date.now());
    setConfirmDeleteReadingId(null);

    if (deleted) scheduleUndo("reading", deleted);
    else toast("success", "Kaynak silindi.");
  }, [confirmDeleteReadingId, reading, setReading, setLocalUpdatedAt, scheduleUndo, toast]);

  const quickAddSourceFromSessionDialog = () => {
    setEditingReading(null);
    setReadingDialogOpen(true);
  };

  // ... deleteReadingConfirmed fonksiyonunun bittiği yer ...

  // --- BibTeX Handler (BUNU EKLE) ---
  const handleBibtexFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingBib(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const newItems = parseBulkBibtex(text);

        if (newItems.length === 0) {
          toast("error", "Dosyada geçerli kayıt bulunamadı.");
          setIsImportingBib(false);
          return;
        }

        setReading((prev) => {
          const existingTitles = new Set(prev.map(p => p.title.toLowerCase()));
          const uniqueNew = newItems.filter(i => !existingTitles.has(i.title.toLowerCase()));

          if (uniqueNew.length === 0) {
            toast("info", "Bu kaynaklar zaten kütüphanenizde var.");
            return prev;
          }

          toast("success", `${uniqueNew.length} kaynak eklendi.`);
          return [...uniqueNew, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
        });

        setLocalUpdatedAt(Date.now());

      } catch (err) {
        console.error(err);
        toast("error", "Dosya işlenirken hata oluştu.");
      } finally {
        setIsImportingBib(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsText(file);
  };
  /** ========= Cloud sync ========= */
  const pushToCloud = useCallback(
    async (u: User, label?: string) => {
      if (!supabase) return;
      setCloudStatus("syncing");
      setCloudMsg(label ? `Senkronlanıyor (${label})...` : "Senkronlanıyor...");

      const { categories, topics, reading, sessions, dailyTarget } = stateRef.current;
      const snapshot: Snapshot = { categories, topics, reading, sessions, dailyTarget };
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("user_data")
        .upsert({ user_id: u.id, data: snapshot, updated_at: nowIso }, { onConflict: "user_id" });

      if (error) {
        const msg = formatCloudError(error.message || "Yükleme hatası");
        setCloudStatus("error");
        setCloudMsg(msg);
        toast("error", "Buluta yazılamadı. RLS/policy olabilir.", "Senkron hatası");
        return;
      }

      const ms = Date.parse(nowIso);
      setLocalUpdatedAt(ms);

      setCloudStatus("signed_in");
      setCloudMsg(label ? `Senkronlandı (${label})` : "Senkronlandı");
    },
    [setLocalUpdatedAt, toast, formatCloudError]
  );

  const loadFromCloud = useCallback(
    async (u: User) => {
      if (!supabase) return;
      setCloudStatus("syncing");
      setCloudMsg("Veriler çekiliyor...");

      const { data, error } = await supabase.from("user_data").select("data, updated_at").eq("user_id", u.id).maybeSingle();

      if (error) {
        const msg = formatCloudError(error.message || "Veri çekme hatası");
        setCloudStatus("error");
        setCloudMsg(msg);
        toast("error", "Buluttan okunamadı. RLS/policy olabilir.", "Senkron hatası");
        return;
      }

      const remoteMs = data?.updated_at ? Date.parse(data.updated_at) : 0;
      const { localUpdatedAt } = stateRef.current;

      if (!data?.data) {
        await pushToCloud(u, "İlk kurulum");
        return;
      }

      if (remoteMs > (localUpdatedAt || 0)) {
        isHydratingFromCloud.current = true;

        const snap = data.data as Snapshot;

        setCategories(Array.isArray(snap.categories) && snap.categories.length ? snap.categories : DEFAULT_CATEGORIES);
        setTopics(Array.isArray(snap.topics) && snap.topics.length ? snap.topics : DEFAULT_TOPICS);
        setReading(Array.isArray(snap.reading) ? snap.reading : []);
        setSessions(Array.isArray(snap.sessions) ? snap.sessions : []);
        setDailyTarget(typeof snap.dailyTarget === "number" ? snap.dailyTarget : 2);
        setDailyLogs(Array.isArray(snap.dailyLogs) ? snap.dailyLogs : []);
        setMilestones(Array.isArray(snap.milestones) ? snap.milestones : []);
        setLocalUpdatedAt(remoteMs);

        window.setTimeout(() => {
          isHydratingFromCloud.current = false;
        }, 150);

        setCloudStatus("signed_in");
        setCloudMsg("Buluttan güncellendi");
        toast("info", "Buluttan güncellendi.");
        return;
      }

      if ((localUpdatedAt || 0) >= remoteMs) {
        await pushToCloud(u, "Yerel daha yeni");
      } else {
        setCloudStatus("signed_in");
        setCloudMsg("Senkronize");
      }
    },
    [pushToCloud, setCategories, setTopics, setReading, setSessions, setDailyTarget, setLocalUpdatedAt, toast, formatCloudError]
  );

  // --- YENİ HELPER FONKSİYONLAR ---
  const handleWordCountSave = (count: number, note: string) => {
    setDailyLogs(prev => {
      const others = prev.filter(l => l.date !== todayStr);

      // Calculate delta to attribute to active project
      const existing = prev.find(l => l.date === todayStr);
      const oldTotal = existing?.wordCount || 0;
      const delta = count - oldTotal;

      let newBreakdown = existing?.projectBreakdown || {};

      if (delta !== 0) {
        const targetProjId = activeProject?.id || "default-thesis";
        const currentVal = newBreakdown[targetProjId] || 0;
        // Ensure we don't go below zero for a project
        const newVal = Math.max(0, currentVal + delta);

        newBreakdown = {
          ...newBreakdown,
          [targetProjId]: newVal
        };
      }

      return [...others, {
        date: todayStr,
        wordCount: count,
        note,
        projectBreakdown: newBreakdown
      }].sort((a, b) => b.date.localeCompare(a.date));
    });
    setLocalUpdatedAt(Date.now());
    toast("success", "Kelime sayısı kaydedildi.");
  };

  const handleAddMilestone = (title: string, date: number) => {
    setMilestones(prev => [...prev, { id: uid(), title, date, done: false }]);
    setLocalUpdatedAt(Date.now());
    toast("success", "Hedef eklendi.");
  };

  const deleteMilestone = (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
    setLocalUpdatedAt(Date.now());
  };

  const toggleMilestone = (id: string) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m));
    setLocalUpdatedAt(Date.now());
  };
  useEffect(() => {
    if (!supabase) return;
    if (!catsHydrated || !topicsHydrated || !readingHydrated || !sessionsHydrated) return;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) loadFromCloud(u);
      else setCloudStatus("signed_out");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) loadFromCloud(u);
      else setCloudStatus("signed_out");
    });

    return () => sub.subscription.unsubscribe();
  }, [catsHydrated, topicsHydrated, readingHydrated, sessionsHydrated, loadFromCloud]);

  useEffect(() => {
    if (!supabase || !user) return;
    if (!catsHydrated || !topicsHydrated || !readingHydrated || !sessionsHydrated) return;
    if (isHydratingFromCloud.current) return;

    if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = window.setTimeout(() => {
      pushToCloud(user);
    }, 1800);

    return () => {
      if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
    };
  }, [categories, topics, reading, sessions, dailyTarget, user?.id, catsHydrated, topicsHydrated, readingHydrated, sessionsHydrated, pushToCloud]);

  // --- Zotero Helpers ---

  // 1. Zotero API'sine giden yardmc fonksiyon
  const fetchZoteroLibrary = async (apiKey: string, userId: string) => {
    // Son eklenen 50 kayna eker.
    const url = `https://api.zotero.org/users/${userId}/items?format=json&limit=50&sort=dateAdded&direction=desc&itemType=-attachment || note`;

    const res = await fetch(url, {
      headers: { "Zotero-API-Key": apiKey },
    });

    if (!res.ok) {
      if (res.status === 403) throw new Error("API Key hatalı veya yetkisiz.");
      if (res.status === 404) throw new Error("User ID bulunamadı.");
      throw new Error("Zotero bağlantı hatası.");
    }

    const data = await res.json();

    // Zotero verisini senin uygulamann formatna (ReadingItem) eviriyoruz
    const mappedItems: ReadingItem[] = data.map((z: any) => {
      const d = z.data;

      // Yazarlar birletir
      const authors = d.creators
        ? d.creators.map((c: any) => `${c.firstName || ''} ${c.lastName || ''}`.trim()).join(", ")
        : "";

      // Trleri eletir
      let type: ReadingType = "other";
      if (d.itemType === "book") type = "book";
      else if (d.itemType === "journalArticle") type = "article";
      else if (d.itemType === "bookSection") type = "chapter";
      else if (d.itemType === "thesis") type = "thesis";

      // Yl bul
      const dateStr = d.date || "";
      const yearMatch = dateStr.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : "";

      return {
        id: `zotero_${d.key}`, // ID akmasn nlemek iin prefix
        zoteroKey: d.key,
        title: d.title || "(Balksz)",
        authors: authors,
        year: year,
        type: type,
        status: "to_read", // Varsaylan olarak "Okunacak" eklenir
        tags: d.tags ? d.tags.map((t: any) => t.tag) : [],
        url: d.url || "",
        doi: d.DOI || "",
        notes: d.abstractNote || "", // zeti notlara ekle
        updatedAt: Date.now(),
      };
    });

    return mappedItems;
  };

  // 2. Butona basldnda alacak ana fonksiyon
  const handleZoteroSync = async () => {
    if (!zoteroApiKey || !zoteroUserId) {
      toast("error", "Lütfen API Key ve User ID alanlarını doldurun.");
      return;
    }

    setIsSyncingZotero(true);
    try {
      const newItems = await fetchZoteroItems({ apiKey: zoteroApiKey, userId: zoteroUserId });

      setReading((prev) => {
        // Zaten ekli olanları tekrar ekleme (zoteroKey kontrolü)
        const existingKeys = new Set(prev.map((p) => p.zoteroKey).filter(Boolean));
        const uniqueNew = newItems.filter((i) => !existingKeys.has(i.zoteroKey));

        if (uniqueNew.length === 0) {
          toast("info", "Kütüphaneniz güncel, yeni kaynak bulunamadı.");
          return prev;
        }

        toast("success", `${uniqueNew.length} yeni kaynak Zotero'dan eklendi.`);
        // Yeni gelenleri listenin en başına koy
        return [...uniqueNew, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
      });

      setLocalUpdatedAt(Date.now());
      setZoteroDialogOpen(false); // İşlem bitince pencereyi kapat
    } catch (err: any) {
      toast("error", err.message || "Zotero eşitleme hatası.");
    } finally {
      setIsSyncingZotero(false);
    }
  };

  const handleSignIn = async () => {
    if (!supabase) return;
    const email = authEmail.trim();
    if (!email) return;

    setCloudStatus("syncing");
    setCloudMsg("Link gönderiliyor...");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    if (error) {
      setCloudStatus("error");
      setCloudMsg(formatCloudError(error.message || "Giriş hatası"));
      toast("error", error.message || "Giriş hatası");
      return;
    }

    setCloudStatus("signed_out");
    setCloudMsg("E-postanı kontrol et: giriş linki gönderildi");
    toast("success", "Giriş linki gönderildi. E-postanı kontrol et.");
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setCloudStatus("signed_out");
    setCloudMsg("Çıkış yapıldı");
    toast("info", "Çıkış yapıldı.");
  };

  /** ========= Analytics helpers ========= */
  const getDailyTotalMs = useCallback(
    (dateMs: number) => {
      const start = startOfDayMs(new Date(dateMs));
      const end = start + 86400000;

      let total = 0;
      for (const s of sessions ?? []) total += overlapActiveMs(s, start, end);
      return total;
    },
    [sessions]
  );

  const getWeekTotalMs = useCallback(
    (dateMs: number) => {
      const start = startOfWeekMs(new Date(dateMs));
      const end = start + 7 * 86400000;

      let total = 0;
      for (const s of sessions ?? []) total += overlapActiveMs(s, start, end);
      return total;
    },
    [sessions]
  );

  const todayTotal = useMemo(() => getDailyTotalMs(Date.now()), [getDailyTotalMs, nowForCalculations, sessions]);
  const weekTotal = useMemo(() => getWeekTotalMs(Date.now()), [getWeekTotalMs, nowForCalculations, sessions]);

  const targetMs = Math.max(0.01, dailyTarget) * 3600000;
  const progressPercent = Math.min(100, (todayTotal / targetMs) * 100);

  const todayHuman = useMemo(() => fmtHmFromMs(todayTotal), [todayTotal]);
  const weekHuman = useMemo(() => fmtHmFromMs(weekTotal), [weekTotal]);
  const targetHuman = useMemo(() => fmtHmFromMs(targetMs), [targetMs]);

  const streakDays = useMemo(() => {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const total = getDailyTotalMs(d.getTime());
      if (total >= targetMs) streak++;
      else break;
    }
    return streak;
  }, [getDailyTotalMs, targetMs, sessions]);

  const yesterdayDeltaMin = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = getDailyTotalMs(d.getTime());
    return Math.round((todayTotal - y) / 60000);
  }, [todayTotal, getDailyTotalMs, nowForCalculations]);

  /** ========= Charts ========= */
  const chartData = useMemo(() => {
    const mkByCat = () => {
      const by: Record<string, number> = {};
      for (const k of stackKeys) by[k] = 0;
      return by;
    };

    // Daily last 7
    const daily: Array<any> = [];
    let dailyTotalHours = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const start = d.getTime();
      const end = start + 86400000;

      const byCat = mkByCat();

      for (const s of sessions ?? []) {
        const ms = overlapActiveMs(s, start, end);
        if (ms <= 0) continue;
        if (!(s.categoryId in byCat)) byCat[s.categoryId] = 0;
        byCat[s.categoryId] += ms / 3600000;
      }

      for (const k of Object.keys(byCat)) byCat[k] = Number(byCat[k].toFixed(1));
      const totalHrs = Object.values(byCat).reduce((a, b) => a + b, 0);
      dailyTotalHours += totalHrs;

      daily.push({
        name: d.toLocaleDateString("tr-TR", { weekday: "short" }),
        fullDate: d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }),
        ...byCat,
        total: Number(totalHrs.toFixed(1)),
        _start: start,
      });
    }

    // Weekly last 4
    const weekly: Array<any> = [];
    let weeklyTotalHours = 0;

    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const start = startOfWeekMs(d);
      const end = start + 7 * 86400000;

      const byCat = mkByCat();

      for (const s of sessions ?? []) {
        const ms = overlapActiveMs(s, start, end);
        if (ms <= 0) continue;
        if (!(s.categoryId in byCat)) byCat[s.categoryId] = 0;
        byCat[s.categoryId] += ms / 3600000;
      }

      for (const k of Object.keys(byCat)) byCat[k] = Number(byCat[k].toFixed(1));
      const totalHrs = Object.values(byCat).reduce((a, b) => a + b, 0);
      weeklyTotalHours += totalHrs;

      const monday = new Date(start);
      weekly.push({
        name: `${monday.getDate()} ${monday.toLocaleDateString("tr-TR", { month: "short" })}`,
        ...byCat,
        total: Number(totalHrs.toFixed(1)),
        _start: start,
      });
    }

    // Monthly last 6 (total hours)
    const monthly: Array<{ name: string; saat: number; _start: number; _end: number }> = [];
    let monthlyTotalHours = 0;

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);

      const start = d.getTime();
      const nextMonth = new Date(d);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const end = nextMonth.getTime();

      let msTotal = 0;
      for (const s of sessions ?? []) msTotal += overlapActiveMs(s, start, end);
      const hrs = msTotal / 3600000;

      monthlyTotalHours += hrs;

      monthly.push({
        name: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
        saat: Number(hrs.toFixed(1)),
        _start: start,
        _end: end,
      });
    }

    return {
      daily,
      dailyTotalHours: Number(dailyTotalHours.toFixed(1)),
      weekly,
      weeklyTotalHours: Number(weeklyTotalHours.toFixed(1)),
      monthly,
      monthlyTotalHours: Number(monthlyTotalHours.toFixed(1)),
    };
  }, [sessions, stackKeys]);
  /** ========= YENİ: Kelime Sayısı Analizi (Word Count Analytics) ========= */
  const wordChartData = useMemo(() => {
    // 1. Günlük (Son 7 Gün)
    const daily: Array<{ name: string; fullDate: string; words: number }> = [];
    let dailyTotalWords = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("tr-TR").split(".").reverse().join("-"); // YYYY-MM-DD (Yerel saate göre basit format)
      // Alternatif (ISO): const dateStr = d.toISOString().slice(0, 10);

      // dailyLogs içindeki format ile eşleşmeli. (Genelde YYYY-MM-DD tutuyoruz)
      // En garantisi: dailyLogs'daki tarih stringi ile buradaki üretilen stringi karşılaştırmak.
      // Basitlik adına burada tarih stringini dailyLogs'daki formata uyduruyoruz.

      // dailyLogs.find... yerine filter kullanıp toplamak daha güvenli olabilir (aynı güne birden fazla kayıt varsa)
      // Ancak şu anki yapımızda günde tek kayıt var.

      // Eşleşme için basit yöntem:
      const matchLog = dailyLogs.find(l => {
        const lDate = new Date(l.date);
        return lDate.getDate() === d.getDate() && lDate.getMonth() === d.getMonth() && lDate.getFullYear() === d.getFullYear();
      });

      const count = matchLog ? matchLog.wordCount : 0;
      dailyTotalWords += count;

      daily.push({
        name: d.toLocaleDateString("tr-TR", { weekday: "short" }),
        fullDate: d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" }),
        words: count,
      });
    }

    // 2. Haftalık (Son 4 Hafta)
    const weekly: Array<{ name: string; words: number }> = [];
    let weeklyTotalWords = 0;

    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);

      const start = startOfWeekMs(d);
      const end = start + 7 * 86400000;

      let total = 0;
      dailyLogs.forEach(log => {
        const logTime = new Date(log.date).getTime();
        // logTime bazen 00:00 olmayabilir, gün bazlı kontrol daha sağlıklıdır ama şimdilik ms ile:
        if (logTime >= start && logTime < end) {
          total += log.wordCount;
        }
      });

      weeklyTotalWords += total;

      const monday = new Date(start);
      weekly.push({
        name: `${monday.getDate()} ${monday.toLocaleDateString("tr-TR", { month: "short" })}`,
        words: total,
      });
    }

    // 3. Aylık (Son 6 Ay)
    const monthly: Array<{ name: string; words: number }> = [];
    let monthlyTotalWords = 0;

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);

      const currentMonth = d.getMonth();
      const currentYear = d.getFullYear();

      let total = 0;
      dailyLogs.forEach(log => {
        const logDate = new Date(log.date);
        if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
          total += log.wordCount;
        }
      });

      monthlyTotalWords += total;

      monthly.push({
        name: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
        words: total,
      });
    }

    return {
      daily,
      dailyTotalWords,
      weekly,
      weeklyTotalWords,
      monthly,
      monthlyTotalWords
    };
  }, [dailyLogs]);

  /** ========= Category distribution (7d) ========= */
  const categoryDistribution7d = useMemo(() => {
    const end = Date.now();
    const start = startOfDayMs(new Date(end)) - 6 * 86400000;

    const bucket = new Map<string, number>();
    for (const s of sessions ?? []) {
      const ms = overlapActiveMs(s, start, end + 1);
      if (ms <= 0) continue;
      bucket.set(s.categoryId, (bucket.get(s.categoryId) ?? 0) + ms);
    }

    const rows = Array.from(bucket.entries())
      .map(([categoryId, ms]) => ({
        categoryId,
        name: categoryMap.get(categoryId)?.name ?? `Silinmiş: ${categoryId}`,
        hours: ms / 3600000,
        color: getCatHex(categoryId),
      }))
      .sort((a, b) => b.hours - a.hours);

    const totalHours = rows.reduce((acc, r) => acc + r.hours, 0);
    return { rows, totalHours };
  }, [sessions, categoryMap, getCatHex]);

  /** ========= Top sources by time (all-time) ========= */
  const sourceTotalsAllTime = useMemo(() => {
    const totals = new Map<string, number>();
    for (const s of sessions ?? []) {
      if (!s.sourceId) continue;
      const ms = sessionDurationMs(s);
      totals.set(s.sourceId, (totals.get(s.sourceId) ?? 0) + ms);
    }
    return totals;
  }, [sessions]);

  /** ========= Reading list ========= */
  const filteredReadingList = useMemo(() => {
    const list = reading ?? [];
    const q = readingQuery.trim().toLowerCase();
    return list
      .filter((r) => {
        if (readingStatusFilter !== "all" && r.status !== readingStatusFilter) return false;
        if (!q) return true;
        const t = (r.title || "").toLowerCase();
        const a = (r.authors || "").toLowerCase();
        const tags = (r.tags || []).join(" ").toLowerCase();
        const doi = (r.doi || "").toLowerCase();
        return t.includes(q) || a.includes(q) || tags.includes(q) || doi.includes(q);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [reading, readingQuery, readingStatusFilter]);

  const readingTimeLabel = useCallback((sourceId: string) => fmtHmFromMs(sourceTotalsAllTime.get(sourceId) ?? 0), [sourceTotalsAllTime]);

  /** ========= Sessions filtering ========= */
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const nowMs = Date.now();
    const dayStart = startOfDayMs(new Date(nowMs));
    const dayEnd = dayStart + 86400000;
    const weekStart = startOfWeekMs(new Date(nowMs));
    const weekEnd = weekStart + 7 * 86400000;

    return (sessions ?? [])
      .filter((s) => {
        // Project filter (based on selected project)
        if (activeProject && activeProject.id !== "default-thesis") {
          if (s.projectId && s.projectId !== activeProject.id) return false;
          // For legacy sessions without projectId, check categoryId
          if (!s.projectId && activeProject.categoryId && s.categoryId !== activeProject.categoryId) return false;
        }

        if (rangeFilter === "today") {
          if (overlapActiveMs(s, dayStart, dayEnd) <= 0) return false;
        }
        if (rangeFilter === "week") {
          if (overlapActiveMs(s, weekStart, weekEnd) <= 0) return false;
        }

        if (categoryFilter !== "all" && s.categoryId !== categoryFilter) return false;

        if (!q) return true;
        const catName = (categoryMap.get(s.categoryId)?.name ?? s.categoryId).toLowerCase();
        const label = (s.label ?? "").toLowerCase();
        const topicName = (s.topicId ? (topicMap.get(s.topicId)?.name ?? s.topicId) : "").toLowerCase();
        const sourceTitle = (s.sourceId ? (readingMap.get(s.sourceId)?.title ?? s.sourceId) : "").toLowerCase();
        const dateStr = new Date(s.start).toLocaleDateString("tr-TR").toLowerCase();

        return catName.includes(q) || label.includes(q) || dateStr.includes(q) || topicName.includes(q) || sourceTitle.includes(q);
      })
      .sort((a, b) => b.start - a.start);
  }, [sessions, searchQuery, rangeFilter, categoryFilter, categoryMap, topicMap, readingMap, activeProject]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, rangeFilter, categoryFilter, pageSize]);

  const totalItems = filteredSessions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedSessions = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, safePage, pageSize]);

  /** ========= CSV export ========= */
  const escapeCsv = (v: string) => {
    const needs = /[;"\n\r]/.test(v);
    const safe = v.replace(/"/g, '""');
    return needs ? `"${safe}"` : safe;
  };

  const handleExportCSV = () => {
    const delimiter = ";";
    const headers = ["ID", "Kategori", "Konu", "Kaynak", "Etiket", "Başlangıç", "Bitiş", "Süre", "Duraklatma"];

    const rows = filteredSessions.map((s) => [
      s.id,
      categoryMap.get(s.categoryId)?.name || s.categoryId,
      s.topicId ? topicMap.get(s.topicId)?.name || s.topicId : "",
      s.sourceId ? readingMap.get(s.sourceId)?.title || s.sourceId : "",
      (s.label || "").trim(),
      new Date(s.start).toLocaleString("tr-TR"),
      new Date(s.end).toLocaleString("tr-TR"),
      fmtHmFromMs(sessionDurationMs(s)),
      fmtHmFromMs(s.pausedMs ?? 0),
    ]);

    const lines = [
      `sep=${delimiter}`,
      headers.map(escapeCsv).join(delimiter),
      ...rows.map((r) => r.map((x) => escapeCsv(String(x ?? ""))).join(delimiter)),
    ];

    const bom = "\ufeff";
    const csv = bom + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `zaman_takip_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
    toast("success", "CSV indirildi.");
  };

  const loadComprehensiveDemo = () => {
    const now = Date.now();

    // Demo Projeler
    const demoProjects: Project[] = [
      { id: "demo-thesis", title: "PhD Tez", type: "thesis", goal: 80000, deadline: now + 180 * 24 * 60 * 60 * 1000, createdAt: now - 90 * 24 * 60 * 60 * 1000, categoryId: "thesis" },
      { id: "demo-article", title: "Akademik Makale", type: "article", goal: 8000, deadline: now + 30 * 24 * 60 * 60 * 1000, createdAt: now - 30 * 24 * 60 * 60 * 1000, categoryId: "writing" },
    ];

    // Demo Bolumler
    const demoChapters: Chapter[] = [
      { id: "ch1", title: "Giris ve Arastirma Sorusu", projectId: "demo-thesis", wordCountGoal: 5000, currentWordCount: 4200, status: "revision", order: 1, deadline: now + 14 * 24 * 60 * 60 * 1000 },
      { id: "ch2", title: "Literatur Taramasi", projectId: "demo-thesis", wordCountGoal: 15000, currentWordCount: 12500, status: "revision", order: 2, deadline: now + 30 * 24 * 60 * 60 * 1000 },
      { id: "ch3", title: "Metodoloji", projectId: "demo-thesis", wordCountGoal: 8000, currentWordCount: 3200, status: "draft", order: 3, deadline: now + 45 * 24 * 60 * 60 * 1000 },
      { id: "ch4", title: "Bulgular", projectId: "demo-thesis", wordCountGoal: 20000, currentWordCount: 0, status: "draft", order: 4, deadline: now + 90 * 24 * 60 * 60 * 1000 },
      { id: "ch5", title: "Tartisma ve Sonuc", projectId: "demo-thesis", wordCountGoal: 10000, currentWordCount: 0, status: "draft", order: 5, deadline: now + 120 * 24 * 60 * 60 * 1000 },
      { id: "art1", title: "Makale Taslagi", projectId: "demo-article", wordCountGoal: 8000, currentWordCount: 5500, status: "revision", order: 1, deadline: now + 21 * 24 * 60 * 60 * 1000 },
    ];

    // Demo Kategoriler
    const demoCats: Category[] = [
      { id: "thesis", name: "PhD / Tez", color: "#6366f1" },
      { id: "reading", name: "Okuma", color: "#10b981" },
      { id: "writing", name: "Yazma", color: "#f97316" },
      { id: "notes", name: "Not / Zettelkasten", color: "#06b6d4" },
      { id: "admin", name: "Idari", color: "#64748b" },
    ];

    // Demo Konular
    const demoTopics: Topic[] = [
      { id: "topic-theory", name: "Teori", color: "#8b5cf6" },
      { id: "topic-method", name: "Metodoloji", color: "#ec4899" },
      { id: "topic-data", name: "Veri Analizi", color: "#14b8a6" },
    ];

    // Demo Okuma Listesi
    const demoReadings: ReadingItem[] = [
      { id: "r1", title: "Debt: The First 5000 Years", authors: "David Graeber", year: "2011", type: "book", status: "done", tags: ["antropoloji", "ekonomi"], updatedAt: now - 5 * 24 * 60 * 60 * 1000, notes: "Anahtar kaynak - borc ve toplum iliskisi" },
      { id: "r2", title: "The Undercommons", authors: "Fred Moten, Stefano Harney", year: "2013", type: "book", status: "reading", tags: ["akademi", "elestiri"], updatedAt: now - 2 * 24 * 60 * 60 * 1000 },
      { id: "r3", title: "Institutional Ethnography", authors: "Dorothy Smith", year: "2005", type: "book", status: "reading", tags: ["metodoloji", "etnografi"], updatedAt: now - 1 * 24 * 60 * 60 * 1000 },
      { id: "r4", title: "Writing Culture", authors: "Clifford, Marcus", year: "1986", type: "book", status: "to_read", tags: ["etnografi", "yazim"], updatedAt: now },
      { id: "r5", title: "Actor-Network Theory", authors: "Bruno Latour", year: "2005", type: "article", status: "done", tags: ["teori", "ANT"], updatedAt: now - 10 * 24 * 60 * 60 * 1000 },
    ];

    // Demo Oturumlar (son 30 gun)
    const mkSession = (daysAgo: number, startH: number, startM: number, durMin: number, categoryId: string, label: string, projectId?: string, chapterId?: string, sourceId?: string, topicId?: string) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      d.setHours(startH, startM, 0, 0);
      const start = d.getTime();
      const end = start + durMin * 60_000;
      const pausedMs = durMin >= 60 ? 5 * 60_000 : 0;
      const s: Session = { id: uid(), categoryId, label, start, end, pausedMs, projectId, chapterId, sourceId, topicId };
      return s;
    };

    const demoSessions: Session[] = [
      // Bugun
      mkSession(0, 9, 0, 75, "reading", "Literatur okumasi", "demo-thesis", "ch2", "r3", "topic-theory"),
      mkSession(0, 11, 0, 45, "notes", "Not cikarmak", "demo-thesis", "ch2"),
      mkSession(0, 14, 30, 90, "writing", "Tez yazimi", "demo-thesis", "ch3"),
      // Dun
      mkSession(1, 10, 0, 60, "reading", "Graeber okumasi", "demo-thesis", "ch2", "r1"),
      mkSession(1, 14, 0, 80, "thesis", "Metodoloji taslagi", "demo-thesis", "ch3", undefined, "topic-method"),
      // 2 gun once
      mkSession(2, 9, 30, 50, "reading", "Moten & Harney", "demo-thesis", undefined, "r2"),
      mkSession(2, 15, 0, 70, "writing", "Makale revizyonu", "demo-article", "art1"),
      // 3 gun once
      mkSession(3, 10, 0, 45, "admin", "E-posta ve planlama"),
      mkSession(3, 13, 30, 90, "thesis", "Literatur haritalama", "demo-thesis", "ch2"),
      // 5 gun once
      mkSession(5, 9, 0, 65, "writing", "Giris bolumu", "demo-thesis", "ch1"),
      mkSession(5, 14, 0, 55, "reading", "Latour ANT", undefined, undefined, "r5", "topic-theory"),
      // 7 gun once
      mkSession(7, 10, 15, 80, "thesis", "Arastirma sorusu taslagi", "demo-thesis", "ch1"),
      mkSession(7, 16, 0, 40, "notes", "Zotero duzenleme"),
      // 14 gun once
      mkSession(14, 9, 0, 120, "thesis", "Tez toplantisi hazirlik", "demo-thesis"),
      mkSession(14, 14, 30, 60, "reading", "Smith - IE", undefined, undefined, "r3", "topic-method"),
      // 21 gun once
      mkSession(21, 10, 0, 90, "writing", "Makale ilk taslak", "demo-article", "art1"),
      mkSession(21, 15, 30, 45, "admin", "Konferans basvurusu"),
    ].sort((a, b) => b.start - a.start);

    // Demo Gunluk Loglar (son 14 gun kelime sayilari)
    const demoLogs: DailyLog[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const wordCount = i === 0 ? 850 : i === 1 ? 1200 : i === 2 ? 0 : i === 5 ? 1500 : i === 7 ? 2100 : i === 14 ? 800 : Math.floor(Math.random() * 600);
      if (wordCount > 0) {
        demoLogs.push({
          date: dateStr,
          wordCount,
          projectBreakdown: { "demo-thesis": Math.floor(wordCount * 0.7), "demo-article": Math.floor(wordCount * 0.3) }
        });
      }
    }

    // Demo Milestone'lar
    const demoMilestones: Milestone[] = [
      { id: "m1", title: "Literatur taramasi tamamla", date: now + 30 * 24 * 60 * 60 * 1000, done: false },
      { id: "m2", title: "Metodoloji bolumu teslim", date: now + 60 * 24 * 60 * 60 * 1000, done: false },
      { id: "m3", title: "Tez taslagi tamamla", date: now + 150 * 24 * 60 * 60 * 1000, done: false },
      { id: "m4", title: "Makale gonderi", date: now + 28 * 24 * 60 * 60 * 1000, done: false },
    ];

    // Verileri yukle
    setProjects(demoProjects);
    setChapters(demoChapters);
    setCategories(demoCats);
    setTopics(demoTopics);
    setReading(demoReadings);
    setSessions(demoSessions);
    setDailyLogs(demoLogs);
    setMilestones(demoMilestones);
    setDailyTarget(3);
    setLocalUpdatedAt(now);
    setRunning(null);
    setQuickCat(demoCats[0].id);
    setSelectedProjectId(demoProjects[0].id);
    setQuickProjectId(demoProjects[0].id);
    setQuickLabel("");
    toast("success", "Demo veri yuklendi! Tum ozellikleri kesfedebilirsiniz.");
  };

  const clearAllDemo = () => {
    const now = Date.now();
    setProjects([{ id: "default-thesis", title: "Ana Proje", type: "thesis", goal: 50000, createdAt: now }]);
    setChapters([]);
    setCategories(DEFAULT_CATEGORIES);
    setTopics([]);
    setReading([]);
    setSessions([]);
    setDailyLogs([]);
    setMilestones([]);
    setDailyTarget(2);
    setLocalUpdatedAt(now);
    setRunning(null);
    setSelectedProjectId("default-thesis");
    setQuickCat(DEFAULT_CATEGORIES[0]?.id || "other");
    setQuickProjectId("none");
    setQuickLabel("");
    toast("info", "Tum veriler temizlendi.");
  };


  /** ========= Legend ========= */
  const renderLegend = useCallback(() => {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        {(categories ?? []).map((c) => (
          <div key={c.id} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
            <span className="text-slate-700 dark:text-slate-200">{c.name}</span>
          </div>
        ))}
      </div>
    );
  }, [categories]);

  /** ========= Derived strings ========= */
  const dailyTotalHuman7d = fmtHmFromHours(chartData.dailyTotalHours);
  const weeklyTotalHuman4w = fmtHmFromHours(chartData.weeklyTotalHours);
  const monthlyTotalHuman6m = fmtHmFromHours(chartData.monthlyTotalHours);

  const lastSession = (sessions ?? [])[0] ?? null;

  const activeFilterBadges: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (searchQuery.trim()) {
    activeFilterBadges.push({ key: "q", label: `Arama: ${searchQuery.trim()}`, onClear: () => setSearchQuery("") });
  }
  if (categoryFilter !== "all") {
    const catName = categoryMap.get(categoryFilter)?.name ?? categoryFilter;
    activeFilterBadges.push({ key: "cat", label: `Kategori: ${catName}`, onClear: () => setCategoryFilter("all") });
  }
  if (rangeFilter !== "all") {
    activeFilterBadges.push({
      key: "range",
      label: `Aralık: ${rangeFilter === "today" ? "Bugün" : "Bu hafta"}`,
      onClear: () => setRangeFilter("all"),
    });
  }

  /** ========= UI: Skeleton Loading ========= */
  const allHydrated = catsHydrated && topicsHydrated && readingHydrated && sessionsHydrated;
  if (!isMounted || !allHydrated) {
    return (
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 px-4 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-28 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-10 w-80" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="animate-spin h-4 w-4" /> Yükleniyor...
          </div>
        </div>

        <ToastViewport toasts={toasts} remove={removeToast} onAction={handleToastAction} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <ToastViewport toasts={toasts} remove={removeToast} onAction={handleToastAction} />

      <ChapterDialog
        isOpen={!!editingChapter}
        onOpenChange={(open) => !open && setEditingChapter(null)}
        initialData={editingChapter}
        onSave={handleChapterSave}
      />

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!confirmDeleteSessionId}
        onOpenChange={(o) => setConfirmDeleteSessionId(o ? confirmDeleteSessionId : null)}
        title="Kayıt silinsin mi?"
        description="Silme işleminden sonra kısa süreli “Geri al” seçeneği çıkar."
        destructive
        confirmText="Evet, sil"
        onConfirm={deleteSessionConfirmed}
      />

      <ConfirmDialog
        open={!!confirmDeleteCategoryId}
        onOpenChange={(o) => setConfirmDeleteCategoryId(o ? confirmDeleteCategoryId : null)}
        title="Kategori silinsin mi?"
        description="Kategori listeden kaldırılır. Bu kategoriye ait eski kayıtlar silinmez."
        destructive
        confirmText="Evet, sil"
        onConfirm={deleteCategoryConfirmed}
      />

      <ConfirmDialog
        open={!!confirmDeleteTopicId}
        onOpenChange={(o) => setConfirmDeleteTopicId(o ? confirmDeleteTopicId : null)}
        title="Konu silinsin mi?"
        description="Konu listeden kaldırılır. Eski kayıtlardaki konu alanı boşa düşebilir."
        destructive
        confirmText="Evet, sil"
        onConfirm={deleteTopicConfirmed}
      />

      <ConfirmDialog
        open={!!confirmDeleteReadingId}
        onOpenChange={(o) => setConfirmDeleteReadingId(o ? confirmDeleteReadingId : null)}
        title="Kaynak silinsin mi?"
        description="Kaynak listeden kaldırılır. Eski oturumlar silinmez; listede “silinmiş kaynak” gibi görünebilir."
        destructive
        confirmText="Evet, sil"
        onConfirm={deleteReadingConfirmed}
      />
      <ConfirmDialog
        open={confirmLoadDemoData}
        onOpenChange={setConfirmLoadDemoData}
        title="Kapsamli demo verisi yuklensin mi?"
        description="Tum ozellikleri iceren demo verisi yuklenecek: Projeler, bolumler, kategoriler, konular, okuma listesi, oturumlar ve daha fazlasi. Mevcut veriler değistirilecek."
        destructive
        confirmText="Evet, yukle"
        cancelText="Vazgec"
        onConfirm={loadComprehensiveDemo}
      />
      <div className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:pb-10">
        {/* Dialogs */}
        <SessionDialog
          isOpen={sessionDialogOpen}
          onOpenChange={setSessionDialogOpen}
          initialData={editingSession}
          categories={categories}
          topics={topics}
          reading={reading}
          sessions={sessions}
          projects={projects}
          chapters={chapters}
          onSave={handleSessionSave}
          onQuickAddSource={quickAddSourceFromSessionDialog}
          toast={(type, message, title) => toast(type, message, title)}
        />

        <ReadingDialog
          isOpen={readingDialogOpen}
          onOpenChange={setReadingDialogOpen}
          initialData={editingReading}
          chapters={chapters}
          onSave={(item) => {
            saveReadingItem(item);
            setQuickSourceId(item.id);
          }}
          toast={(type, message, title) => toast(type, message, title)}
        />

        <Dialog open={zoteroDialogOpen} onOpenChange={setZoteroDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-red-600" />
                Zotero Entegrasyonu
              </DialogTitle>
              <ShadcnDialogDescription>
                Zotero kütüphanendeki son kaynakları çekmek için API bilgilerini gir.
                Bu bilgiler sadece tarayıcında saklanır.
              </ShadcnDialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input
                  placeholder="Örn: 1234567"
                  value={zoteroUserId}
                  onChange={(e) => setZoteroUserId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Zotero API Key (gizli)"
                  value={zoteroApiKey}
                  onChange={(e) => setZoteroApiKey(e.target.value)}
                />
                <div className="text-[11px] text-muted-foreground">
                  <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noreferrer" className="underline hover:text-primary">
                    Anahtarları almak için tıkla (Zotero.org)
                  </a>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setZoteroDialogOpen(false)}>İptal</Button>
              <Button onClick={handleZoteroSync} disabled={isSyncingZotero}>
                {isSyncingZotero ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {isSyncingZotero ? "Çekiliyor..." : "Kütüphanemi Getir"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <WordCountDialog
          isOpen={wordCountOpen}
          onOpenChange={setWordCountOpen}
          initialCount={todayLog?.wordCount || 0}
          dateStr={new Date().toLocaleDateString("tr-TR")}
          onSave={handleWordCountSave}
        />

        <MilestoneDialog
          isOpen={milestoneOpen}
          onOpenChange={setMilestoneOpen}
          onSave={handleAddMilestone}
        />
        <ChapterDialog
          isOpen={isChapterDialogOpen}
          onOpenChange={setIsChapterDialogOpen}
          initialData={editingChapter}
          onSave={handleChapterSave}
          readingItems={reading}
        />

        <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Proje Oluştur</DialogTitle>
              <ShadcnDialogDescription>
                Tez, makale veya kitap gibi farklı yazma projelerini ayrı ayrı takip et.
              </ShadcnDialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Proje Başlığı</Label>
                <Input value={newProjectTitle} onChange={e => setNewProjectTitle(e.target.value)} placeholder="Örn: Yapay Zeka Etiği Makalesi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tür</Label>
                  <Select value={newProjectType} onValueChange={(v: any) => setNewProjectType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thesis">Tez</SelectItem>
                      <SelectItem value="article">Makale</SelectItem>
                      <SelectItem value="book">Kitap</SelectItem>
                      <SelectItem value="other">Diğer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Hedef Kelime</Label>
                  <Input type="number" value={newProjectGoal} onChange={e => setNewProjectGoal(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewProjectDialogOpen(false)}>İptal</Button>
              <Button onClick={handleAddProject} disabled={!newProjectTitle.trim()}>Oluştur</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* ----------------------- */}

        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <div className="text-primary-foreground p-2 rounded-xl" style={{ backgroundColor: theme.hex }}>
                  <Layout className="h-6 w-6" />
                </div>
                Çalışalım
              </h1>

              {/* Project Selector */}
              {activeProject && (
                <div className="flex items-center gap-2 ml-0 sm:ml-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <Select
                    value={activeProject.id}
                    onValueChange={(val) => {
                      if (val === "new-project-trigger") {
                        setIsNewProjectDialogOpen(true);
                      } else {
                        setSelectedProjectId(val);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 border-0 bg-white dark:bg-slate-950 shadow-sm min-w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new-project-trigger" className="text-indigo-600 font-medium focus:text-indigo-700 focus:bg-indigo-50">
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" /> Yeni Proje...
                        </span>
                      </SelectItem>
                      <DropdownMenuSeparator />
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            {p.type === 'thesis' ? <GraduationCap className="h-4 w-4" /> :
                              p.type === 'book' ? <Book className="h-4 w-4" /> :
                                p.type === 'article' ? <FileText className="h-4 w-4" /> :
                                  <Layout className="h-4 w-4" />}
                            {p.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Target className="h-4 w-4" />
                Bugün: <span className="text-slate-900 dark:text-slate-50 font-medium">{todayHuman}</span> /{" "}
                <span className="font-medium">{targetHuman}</span>
              </span>

              <span className="text-muted-foreground">•</span>

              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Hafta: <span className="text-slate-900 dark:text-slate-50 font-medium">{weekHuman}</span>
              </span>

              <span className="text-muted-foreground">•</span>

              <span className="inline-flex items-center gap-1">
                <Flame className="h-4 w-4" />
                Streak: <span className="text-slate-900 dark:text-slate-50 font-medium">{streakDays} gün</span>
              </span>

              <span className="text-muted-foreground">•</span>

              <span className="inline-flex items-center gap-1">
                <span className="text-xs">
                  Dün’e göre:{" "}
                  <span className={yesterdayDeltaMin >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    {yesterdayDeltaMin >= 0 ? `+${yesterdayDeltaMin}` : yesterdayDeltaMin} dk
                  </span>
                </span>
              </span>

              <span className="text-muted-foreground">•</span>

              <span className="inline-flex items-center gap-1 text-xs">
                Hedefe kalan:{" "}
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {fmtHmFromMs(Math.max(0, targetMs - todayTotal))}
                </span>
              </span>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            {/* Cloud */}
            {supabase ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={user ? "outline" : "default"}
                    className={`gap-2 ${!user ? "text-white" : ""}`}
                    style={!user ? { backgroundColor: theme.hex } : undefined}
                    type="button"
                  >
                    {cloudStatus === "syncing" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                    {user ? "Senkronize" : "Giriş Yap"}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Bulut Senkronizasyonu</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <div className="px-2 py-1.5">
                    <Badge
                      variant="outline"
                      className={`rounded-full ${cloudStatus === "error"
                        ? "border-rose-200 text-rose-600"
                        : cloudStatus === "syncing"
                          ? "border-amber-200 text-amber-700"
                          : "border-emerald-200 text-emerald-700"
                        }`}
                    >
                      {cloudStatus === "error" ? "Hata" : cloudStatus === "syncing" ? "Senkron" : user ? "Bağlı" : "Bağlı değil"}
                    </Badge>

                    <div className="text-[11px] text-muted-foreground mt-1 whitespace-pre-line">
                      {cloudStatus === "error" ? `Hata: ${cloudMsg}` : cloudMsg}
                    </div>

                    <div className="text-[11px] text-muted-foreground mt-2">
                      Son yerel güncelleme: {localUpdatedAt ? new Date(localUpdatedAt).toLocaleString("tr-TR") : "-"}
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  {user ? (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground break-all">
                        Giriş yapıldı: <br /> {user.email}
                      </div>
                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={() => loadFromCloud(user)}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Şimdi Eşitle
                      </DropdownMenuItem>

                      <DropdownMenuItem className="text-red-600" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <div className="p-2 space-y-2">
                      <p className="text-xs text-muted-foreground">Verilerini kaybetmemek ve cihazlar arası eşitlemek için giriş yap.</p>
                      <Input
                        placeholder="ornek@email.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="h-8 text-sm"
                        inputMode="email"
                      />
                      <Button size="sm" className="w-full h-8" disabled={!supabase} onClick={handleSignIn} type="button">
                        <Mail className="mr-2 h-3 w-3" /> Link Gönder
                      </Button>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge variant="outline" className="rounded-full">
                <Cloud className="mr-2 h-3.5 w-3.5" /> Bulut: kapalı
              </Badge>
            )}

            {/* Export */}
            <Button variant="outline" size="icon" onClick={handleExportCSV} title="CSV İndir (filtreli)" aria-label="CSV indir" type="button">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Reminder Panel */}
        <ReminderPanel
          reminders={reminders}
          onDismiss={dismissReminder}
        />

        {/* Thesis Dashboard (Project Specific) */}
        {activeProject && (
          <ThesisDashboard
            dailyLogs={dailyLogs}
            milestones={milestones}
            project={activeProject}
            sessions={sessions}
          />
        )}

        {/* Active Timer Card (Moved Up) */}
        <div className="mb-8">
          {!running ? (
            <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/20 shadow-none hover:bg-slate-50 transition-colors">
              <CardContent className="flex flex-col gap-4 py-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Kategori</Label>
                    <Select value={quickCat} onValueChange={setQuickCat}>
                      <SelectTrigger className="h-12 bg-white dark:bg-slate-950 border-slate-200">
                        <SelectValue placeholder={categories[0]?.name} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Konu</Label>
                    <Select value={quickTopicId} onValueChange={setQuickTopicId}>
                      <SelectTrigger className="h-12 bg-white dark:bg-slate-950 border-slate-200">
                        <SelectValue placeholder="(opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">(Seçme)</SelectItem>
                        {topics.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Proje</Label>
                    <Select value={quickProjectId} onValueChange={setQuickProjectId}>
                      <SelectTrigger className="h-12 bg-white dark:bg-slate-950 border-slate-200">
                        <SelectValue placeholder="(opsiyonel) Proje sec" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">(Secme)</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Kaynak</Label>
                    <div className="flex gap-2">
                      <Select value={quickSourceId} onValueChange={setQuickSourceId}>
                        <SelectTrigger className="h-12 bg-white dark:bg-slate-950 border-slate-200 flex-1">
                          <SelectValue placeholder="(opsiyonel) Okunan kaynak" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">(Seçme)</SelectItem>
                          {reading
                            .slice()
                            .sort((a, b) => b.updatedAt - a.updatedAt)
                            .map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      <Button type="button" variant="outline" className="h-12 rounded-xl" onClick={openCreateReading} title="Yeni kaynak ekle">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Etiket</Label>
                    <Input
                      className="h-12 bg-white dark:bg-slate-950 border-slate-200"
                      placeholder={quickStartPlaceholder}
                      value={quickLabel}
                      onChange={(e) => setQuickLabel(e.target.value)}
                      list="quick-labels"
                      autoComplete="off"
                    />
                    <datalist id="quick-labels">
                      {quickStartSuggestions.map((label) => (
                        <option key={label} value={label} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {lastSession ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground -mt-1">
                    <span>Son kayıt:</span>
                    <Badge variant="outline" className="rounded-full">
                      {categoryMap.get(lastSession.categoryId)?.name ?? lastSession.categoryId}
                      {lastSession.topicId ? ` · ${topicMap.get(lastSession.topicId)?.name ?? lastSession.topicId}` : ""}
                      {lastSession.sourceId ? ` · ${readingMap.get(lastSession.sourceId)?.title ?? lastSession.sourceId}` : ""}
                      {lastSession.label ? ` · ${lastSession.label}` : " · (etiketsiz)"}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 px-2 rounded-lg"
                      onClick={() => {
                        setQuickCat(lastSession.categoryId);
                        setQuickTopicId(lastSession.topicId ?? "none");
                        setQuickSourceId(lastSession.sourceId ?? "none");
                        setQuickLabel(lastSession.label || "");
                        window.setTimeout(() => startSession(), 0);
                      }}
                    >
                      Devam et
                    </Button>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 w-full">
                  <Button
                    size="lg"
                    className="h-12 px-8 flex-1 rounded-xl shadow-lg border-0 text-white"
                    style={{ backgroundColor: theme.hex }}
                    onClick={startSession}
                    type="button"
                  >
                    <Play className="mr-2 h-5 w-5 fill-current" /> Başlat
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-4 rounded-xl border-slate-200"
                    title="Manuel Ekle"
                    aria-label="Manuel kayıt ekle"
                    onClick={openCreateDialog}
                    type="button"
                  >
                    <Plus className="h-5 w-5 text-slate-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ActiveTimer
              running={running}
              onStop={stopSessionFixed}
              onPause={pauseRunning}
              onResume={resumeRunning}
              categoryMap={categoryMap}
              topicMap={topicMap}
              readingMap={readingMap}
              projectMap={projectMap}
              themeColor={theme.hex}
            />
          )}
        </div>

        {/* Chapter Progress (Project Specific) */}
        <section className="mt-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {activeProject ? `${activeProject.title} Bölümleri` : "Bölüm İlerlemesi"}
              </h2>
            </div>
            <Button size="sm" onClick={() => { setEditingChapter(null); setIsChapterDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Yeni Bölüm
            </Button>
          </div>
          <ChapterBoard
            chapters={filteredChapters}
            onUpdateChapter={handleChapterSave}
            onChapterClick={(c) => { setEditingChapter(c); setIsChapterDialogOpen(true); }}
            onDeleteChapter={(id) => {
              setChapters(prev => prev.filter(c => c.id !== id));
              setLocalUpdatedAt(Date.now());
            }}
          />
        </section>



        {/* KPI Row */}
        {/* --- GÜNCELLENMİŞ KPI ROW --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* 1. KART: Bugün (Kelime Sayısı Eklendi) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Target className="h-4 w-4" /> Bugün
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div className="text-3xl font-bold">{todayHuman}</div>
                <div className="text-xs text-muted-foreground">{targetHuman} hedef</div>
              </div>
              <div className="mt-3 h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-700 ease-out" style={{ width: `${progressPercent}%`, backgroundColor: theme.hex }} />
              </div>

              <Separator className="my-3" />

              {/* Kelime Sayısı Alanı */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-bold flex items-center gap-1">
                    {todayLog?.wordCount || 0}
                    <span className="text-xs font-normal text-muted-foreground">kelime</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setWordCountOpen(true)}>
                  <Pencil className="h-3 w-3 mr-1" /> Gir
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 2. KART: Bu Hafta (Aynı Kaldı) */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Bu Hafta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{weekHuman}</div>
              <div className="text-xs text-muted-foreground mt-1">Haftalık toplam çalışma süresi</div>
              <div className="mt-4 text-xs text-muted-foreground">
                Toplam Yazılan: <span className="font-semibold text-foreground">{dailyLogs.reduce((acc, l) => acc + l.wordCount, 0)}</span> kelime
              </div>
            </CardContent>
          </Card>

          {/* 3. KART: YENİ Milestone Widget */}
          <div className="md:col-span-1">
            <div className="flex justify-end mb-1">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setMilestoneOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> Hedef Ekle
              </Button>
            </div>
            <MilestonesWidget milestones={milestones} onDelete={deleteMilestone} onToggle={toggleMilestone} />
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="sessions" className="space-y-4">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
            <TabsTrigger value="sessions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 font-semibold">
              Kayıtlar
            </TabsTrigger>
            <TabsTrigger value="library" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 font-semibold">
              Kütüphane
            </TabsTrigger>
            <TabsTrigger value="analysis" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 font-semibold">
              Analiz
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 font-semibold">
              Ayarlar
            </TabsTrigger>
          </TabsList>

          {/* Sessions */}
          <TabsContent value="sessions" className="mt-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-xl">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Kategori, konu, kaynak, etiket veya tarih ara..."
                    className="pl-9 rounded-xl bg-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Kayıt arama"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-10 rounded-xl w-[170px] bg-white" aria-label="Kategori filtresi">
                      <SelectValue placeholder="Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm kategoriler</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="rounded-xl gap-2" type="button">
                        <Filter className="h-4 w-4" />
                        {rangeFilter === "all" ? "Tümü" : rangeFilter === "today" ? "Bugün" : "Bu hafta"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Zaman Aralığı</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setRangeFilter("all")}>Tümü</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRangeFilter("today")}>Bugün</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRangeFilter("week")}>Bu hafta</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="outline" className="rounded-xl" onClick={handleExportCSV} type="button" title="Filtreli CSV indir">
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                </div>
              </div>

              {/* Active filter chips */}
              {activeFilterBadges.length ? (
                <div className="flex flex-wrap items-center gap-2">
                  {activeFilterBadges.map((c) => (
                    <Badge key={c.key} variant="outline" className="rounded-full gap-2">
                      <span className="truncate">{c.label}</span>
                      <button type="button" className="hover:opacity-80" aria-label="Filtreyi kaldır" onClick={c.onClear}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </Badge>
                  ))}

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 rounded-xl"
                    onClick={() => {
                      setSearchQuery("");
                      setRangeFilter("all");
                      setCategoryFilter("all");
                    }}
                  >
                    Tüm filtreleri temizle
                  </Button>
                </div>
              ) : null}

              {filteredSessions.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 border border-dashed rounded-2xl">
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Timer className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                    {sessions.length === 0 ? "Henüz kayıt yok" : "Sonuç bulunamadı"}
                  </h3>
                  <p className="text-slate-500 max-w-md mx-auto mt-2">
                    {sessions.length === 0 ? "Bir kategori seç ve çalışmayı başlat." : "Filtreleri değiştirerek tekrar dene."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {pagedSessions.map((session) => {
                      const leftColor = getCatHex(session.categoryId);
                      const durationMs = sessionDurationMs(session);
                      const pausedMs = session.pausedMs ?? 0;

                      const catName = categoryMap.get(session.categoryId)?.name ?? `Silinmiş: ${session.categoryId}`;
                      const topicName = session.topicId ? topicMap.get(session.topicId)?.name ?? `Silinmiş: ${session.topicId}` : null;
                      const srcTitle = session.sourceId ? readingMap.get(session.sourceId)?.title ?? `Silinmiş: ${session.sourceId}` : null;

                      return (
                        <div
                          key={session.id}
                          className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-slate-200 dark:hover:border-slate-800"
                          style={{ borderLeftWidth: 4, borderLeftColor: leftColor }}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0" style={{ backgroundColor: leftColor }}>
                              {catName.substring(0, 2).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {catName}
                                <span className="ml-2 inline-flex flex-wrap gap-2">
                                  {topicName ? (
                                    <Badge variant="outline" className="rounded-full">
                                      {topicName}
                                    </Badge>
                                  ) : null}
                                  {srcTitle ? (
                                    <Badge variant="outline" className="rounded-full">
                                      <BookOpen className="mr-1 h-3.5 w-3.5" /> <span className="truncate max-w-[280px]">{srcTitle}</span>
                                    </Badge>
                                  ) : null}
                                  {session.label ? (
                                    <Badge variant="outline" className="rounded-full">
                                      {session.label}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="rounded-full text-muted-foreground">
                                      (etiketsiz)
                                    </Badge>
                                  )}
                                </span>
                              </div>

                              <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                                <span className="inline-flex items-center gap-1">
                                  <CalendarIcon className="h-3.5 w-3.5" />
                                  {new Date(session.start).toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" })}
                                </span>
                                <span>•</span>
                                <span className="font-mono">
                                  {fmtTime(session.start)} - {fmtTime(session.end)}
                                </span>
                                <span>•</span>
                                <span className="font-mono">{fmtHmFromMs(durationMs)}</span>
                                {pausedMs > 0 ? (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-500">Duraklatma: {fmtHmFromMs(pausedMs)}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden sm:block font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtCompact(durationMs)}</div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Kayıt işlemleri menüsü" type="button">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(session)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteSessionId(session.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Sil
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination controls */}
                  <div className="flex items-center justify-between flex-wrap gap-3 pt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Sayfa başına</span>
                      <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                        <SelectTrigger className="h-9 w-[110px] rounded-xl bg-white" aria-label="Sayfa başına kayıt sayısı">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="rounded-xl" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} type="button">
                        Önceki
                      </Button>

                      <Badge variant="outline" className="rounded-full">
                        {safePage} / {totalPages}
                      </Badge>

                      <Button
                        variant="outline"
                        className="rounded-xl"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        type="button"
                      >
                        Sonraki
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Library */}
          <TabsContent value="library" className="mt-6 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Okuma Kütüphanesi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="flex-1 max-w-xl relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 rounded-xl bg-white" placeholder="Başlık, yazar veya etiket ara..." value={readingQuery} onChange={(e) => setReadingQuery(e.target.value)} />
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={readingStatusFilter} onValueChange={(v) => setReadingStatusFilter(v as ReadingStatusFilter)}>
                      <SelectTrigger className="h-10 rounded-xl w-[180px] bg-white">
                        <SelectValue placeholder="Durum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Hepsi</SelectItem>
                        <SelectItem value="to_read">Okunacak</SelectItem>
                        <SelectItem value="reading">Okunuyor</SelectItem>
                        <SelectItem value="done">Bitti</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button className="rounded-xl" onClick={openCreateReading} type="button">
                      <Plus className="mr-2 h-4 w-4" /> Kaynak Ekle
                    </Button>
                    {/* Mevcut "Kaynak Ekle" butonu burada... onun yanına veya soluna: */}

                    {/* "Kaynak Ekle" butonunun yanı... */}

                    {/* .bib Yükle Butonu (BUNU EKLE) */}
                    <Button
                      variant="outline"
                      className="rounded-xl gap-2 text-slate-700 dark:text-slate-200"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImportingBib}
                    >
                      {isImportingBib ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4 text-orange-600" />}
                      {isImportingBib ? "Yükleniyor..." : ".bib Yükle"}
                    </Button>

                    {/* Gizli Input (BUNU EKLE) */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".bib,.txt"
                      onChange={handleBibtexFileChange}
                    />

                    <Button variant="outline" className="rounded-xl gap-2 text-slate-700 dark:text-slate-200" onClick={() => setZoteroDialogOpen(true)}>
                      {/* Zotero iconu yerine BookOpen kullanıp kırmızı yapıyoruz */}
                      <BookOpen className="h-4 w-4 text-red-600" />
                      Zotero
                    </Button>


                  </div>
                </div>

                <Separator />

                {filteredReadingList.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-10 text-center">Henüz kaynak yok. “Kaynak Ekle” ile başlayabilirsin.</div>
                ) : (
                  <div className="space-y-2">
                    {filteredReadingList.map((r) => {
                      const timeLabel = readingTimeLabel(r.id);
                      const statusLabel = r.status === "to_read" ? "Okunacak" : r.status === "reading" ? "Okunuyor" : "Bitti";

                      return (
                        <div key={r.id} className="flex items-start justify-between gap-4 p-4 border rounded-2xl bg-white dark:bg-slate-900">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold truncate">{r.title}</div>
                              <Badge variant="outline" className="rounded-full">
                                {statusLabel}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                Süre: {timeLabel}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                Tür: {r.type}
                              </Badge>
                              {r.doi && (
                                <Badge variant="outline" className="rounded-full">
                                  DOI: {r.doi}
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                              {r.authors ? <span>{r.authors}</span> : null}
                              {r.year ? <span>• {r.year}</span> : null}
                              {r.url ? (
                                <>
                                  <span>•</span>
                                  <a className="inline-flex items-center gap-1 hover:underline" href={r.url} target="_blank" rel="noreferrer">
                                    <LinkIcon className="h-3.5 w-3.5" /> link
                                  </a>
                                </>
                              ) : null}
                            </div>

                            {r.tags?.length ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {r.tags.slice(0, 8).map((t) => (
                                  <Badge key={t} variant="secondary" className="rounded-full">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            ) : null}

                            {r.notes ? (
                              <div className="mt-2 text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{r.notes}</div>
                            ) : (
                              <div className="mt-2 text-sm text-muted-foreground">Not yok.</div>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <Button variant="outline" className="rounded-xl" onClick={() => openEditReading(r)} type="button">
                              <Pencil className="mr-2 h-4 w-4" /> Düzenle
                            </Button>
                            <Button variant="destructive" className="rounded-xl" onClick={() => setConfirmDeleteReadingId(r.id)} type="button">
                              <Trash2 className="mr-2 h-4 w-4" /> Sil
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analysis */}
          <TabsContent value="analysis" className="mt-6 space-y-6">
            <WritingAnalytics
              dailyLogs={dailyLogs}
              sessions={sessions}
              categories={categories}
              selectedProject={activeProject}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="shadow-sm md:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4" /> Son 7 Gün · Kategori
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryDistribution7d.rows.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-10 text-center">Henüz veri yok</div>
                  ) : (
                    <>
                      <div className="h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Tooltip formatter={(v: any, _n: any, p: any) => [fmtHmFromHours(Number(v) || 0), p?.payload?.name ?? ""]} />
                            <Legend verticalAlign="bottom" height={40} />
                            <Pie data={categoryDistribution7d.rows} dataKey="hours" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3} stroke="transparent">
                              {categoryDistribution7d.rows.map((entry) => (
                                <Cell key={entry.categoryId} fill={entry.color} />
                              ))}
                            </Pie>
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        Toplam: <span className="font-medium">{fmtHmFromHours(categoryDistribution7d.totalHours)}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> 7 Gün / 4 Hafta / 6 Ay
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 shadow-none border" style={{ backgroundColor: `${theme.hex}10`, borderColor: `${theme.hex}25` }}>
                      <div className="text-xs text-muted-foreground">Toplam (7 gün)</div>
                      <div className="text-2xl font-bold" style={{ color: theme.hex }}>
                        {dailyTotalHuman7d}
                      </div>
                    </Card>
                    <Card className="p-4 shadow-none border" style={{ backgroundColor: `${theme.hex}10`, borderColor: `${theme.hex}25` }}>
                      <div className="text-xs text-muted-foreground">Toplam (4 hafta)</div>
                      <div className="text-2xl font-bold" style={{ color: theme.hex }}>
                        {weeklyTotalHuman4w}
                      </div>
                    </Card>
                    <Card className="p-4 shadow-none border" style={{ backgroundColor: `${theme.hex}10`, borderColor: `${theme.hex}25` }}>
                      <div className="text-xs text-muted-foreground">Toplam (6 ay)</div>
                      <div className="text-2xl font-bold" style={{ color: theme.hex }}>
                        {monthlyTotalHuman6m}
                      </div>
                    </Card>
                  </div>

                  <div className="h-[330px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap={18} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(v: any, name: any) => [fmtHmFromHours(Number(v) || 0), categoryMap.get(name)?.name ?? name]}
                          labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.fullDate ?? ""}
                        />
                        <Legend verticalAlign="bottom" content={renderLegend} />
                        {stackKeys.map((id) => (
                          <Bar key={id} dataKey={id} stackId="a" fill={getCatHex(id)} barSize={32} radius={0} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={theme.hex} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={theme.hex} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v: any) => [fmtHmFromHours(Number(v) || 0), "Süre"]} />
                        <Area type="monotone" dataKey="saat" stroke={theme.hex} fillOpacity={1} fill="url(#monthGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              {/* --- YENİ: KELİME SAYISI ANALİZİ KARTI --- */}
              <Card className="shadow-sm border-l-4 border-l-emerald-500 md:col-span-3">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-emerald-600" /> Yazma Performansı (Kelime)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                  {/* Özet Kutuları */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                      <div className="text-xs text-muted-foreground uppercase font-semibold">Son 7 Gün</div>
                      <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {wordChartData.dailyTotalWords.toLocaleString("tr-TR")} <span className="text-sm font-normal text-muted-foreground">kelime</span>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                      <div className="text-xs text-muted-foreground uppercase font-semibold">Son 4 Hafta</div>
                      <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {wordChartData.weeklyTotalWords.toLocaleString("tr-TR")} <span className="text-sm font-normal text-muted-foreground">kelime</span>
                      </div>
                    </div>
                    <div className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                      <div className="text-xs text-muted-foreground uppercase font-semibold">Son 6 Ay</div>
                      <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                        {wordChartData.monthlyTotalWords.toLocaleString("tr-TR")} <span className="text-sm font-normal text-muted-foreground">kelime</span>
                      </div>
                    </div>
                  </div>

                  {/* Grafikler */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Günlük Grafik */}
                    <div className="h-[220px] w-full border rounded-xl p-2 bg-slate-50/30 dark:bg-slate-900/30">
                      <div className="text-[10px] font-semibold text-center mb-2 text-muted-foreground uppercase tracking-widest">Günlük Dağılım</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={wordChartData.daily}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={5} />
                          <Tooltip
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                            formatter={(value: any) => [`${value} kelime`, "Yazılan"]}
                            labelFormatter={(l, p) => p?.[0]?.payload?.fullDate || l}
                          />
                          <Bar dataKey="words" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Aylık Grafik */}
                    <div className="h-[220px] w-full border rounded-xl p-2 bg-slate-50/30 dark:bg-slate-900/30">
                      <div className="text-[10px] font-semibold text-center mb-2 text-muted-foreground uppercase tracking-widest">Aylık İlerleme</div>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={wordChartData.monthly}>
                          <defs>
                            <linearGradient id="wordGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={5} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                            formatter={(value: any) => [`${value} kelime`, "Toplam"]}
                          />
                          <Area type="monotone" dataKey="words" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#wordGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Heatmap */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" /> Aktivite Izgarası (Son 52 Hafta)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityHeatmap sessions={sessions} themeColor={theme.hex} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Categories */}
              <Card className="shadow-sm md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Kategoriler</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {categories.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 p-3 border rounded-lg bg-white dark:bg-slate-900">
                        <Input type="color" className="w-8 h-8 p-0 border-0 rounded-full cursor-pointer shrink-0" value={c.color} onChange={(e) => updateCategory(c.id, "color", e.target.value)} />
                        <Input value={c.name} onChange={(e) => updateCategory(c.id, "name", e.target.value)} className="h-8 text-sm" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => setConfirmDeleteCategoryId(c.id)} type="button">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-end gap-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed">
                    <div className="space-y-1 flex-1">
                      <Label>Yeni Kategori</Label>
                      <Input placeholder="Örn: Arşiv" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Renk</Label>
                      <Input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer" />
                    </div>
                    <Button onClick={addCategory} disabled={!newCatName.trim()} type="button">
                      <Plus className="mr-2 h-4 w-4" /> Ekle
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Topics */}
              <Card className="shadow-sm md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Konular</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {topics.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 p-3 border rounded-lg bg-white dark:bg-slate-900">
                        <Input
                          type="color"
                          className="w-8 h-8 p-0 border-0 rounded-full cursor-pointer shrink-0"
                          value={t.color || "#0ea5e9"}
                          onChange={(e) => updateTopic(t.id, "color", e.target.value)}
                        />
                        <Input value={t.name} onChange={(e) => updateTopic(t.id, "name", e.target.value)} className="h-8 text-sm" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => setConfirmDeleteTopicId(t.id)} type="button">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-end gap-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed">
                    <div className="space-y-1 flex-1">
                      <Label>Yeni Konu</Label>
                      <Input placeholder="Örn: Kuramsal Çerçeve" value={newTopicName} onChange={(e) => setNewTopicName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Renk</Label>
                      <Input type="color" value={newTopicColor} onChange={(e) => setNewTopicColor(e.target.value)} className="w-10 h-10 p-1 rounded-lg cursor-pointer" />
                    </div>
                    <Button onClick={addTopic} disabled={!newTopicName.trim()} type="button">
                      <Plus className="mr-2 h-4 w-4" /> Ekle
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Targets */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Hedefler</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Günlük Hedef (Saat)</Label>
                    <Input
                      type="number"
                      value={dailyTarget}
                      min={0}
                      step={0.25}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setDailyTarget(Number.isFinite(v) ? v : 0);
                        setLocalUpdatedAt(Date.now());
                      }}
                      className="max-w-[200px]"
                    />
                    <div className="text-xs text-muted-foreground">Gösterimler “X saat Y dk” formatında.</div>
                  </div>
                </CardContent>
              </Card>

              {/* Data */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Veri Yönetimi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Export Section */}
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Dışa Aktarma</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                          import("@/lib/export").then(({ exportToJSON, downloadFile, generateFilename }) => {
                            const json = exportToJSON({
                              categories,
                              topics,
                              reading,
                              sessions,
                              dailyLogs,
                              milestones,
                              chapters,
                              projects
                            });
                            downloadFile(json, generateFilename("zaman-takip", "json"), "application/json");
                            toast("success", "Tüm veriler JSON olarak indirildi.");
                          });
                        }}
                        type="button"
                      >
                        <Download className="mr-2 h-4 w-4" /> Tüm Veriyi İndir (JSON)
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                          import("@/lib/export").then(({ exportSessionsToCSV, downloadFile, generateFilename }) => {
                            const csv = exportSessionsToCSV(sessions, categoryMap, topicMap);
                            downloadFile(csv, generateFilename("oturumlar", "csv"), "text/csv");
                            toast("success", "Oturumlar CSV olarak indirildi.");
                          });
                        }}
                        type="button"
                      >
                        <Download className="mr-2 h-4 w-4" /> Oturumları İndir (CSV)
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                          import("@/lib/export").then(({ exportDailyLogsToCSV, downloadFile, generateFilename }) => {
                            const csv = exportDailyLogsToCSV(dailyLogs);
                            downloadFile(csv, generateFilename("kelime-sayilari", "csv"), "text/csv");
                            toast("success", "Kelime sayıları CSV olarak indirildi.");
                          });
                        }}
                        type="button"
                      >
                        <Download className="mr-2 h-4 w-4" /> Kelime Sayıları (CSV)
                      </Button>

                      <Button variant="outline" className="justify-start" onClick={handleExportCSV} type="button">
                        <Download className="mr-2 h-4 w-4" /> Filtreli Kayıtlar (CSV)
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Demo Data Section */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Demo Veri</div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Kapsamli demo ile tum ozellikleri kesfedebilirsiniz.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setConfirmLoadDemoData(true)} type="button">
                        Demo Yukle
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearAllDemo} type="button">
                        Tumunu Temizle
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Sıfırlama</div>
                    <div className="text-xs text-muted-foreground">Bu işlem geri alınamaz.</div>

                    <Button
                      variant="destructive"
                      className="w-full justify-start"
                      type="button"
                      onClick={() => {
                        setSessions([]);
                        setLocalUpdatedAt(Date.now());
                        toast("success", "Tüm kayıtlar silindi.");
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Tüm kayıtları sil
                    </Button>
                  </div>

                  <Separator />

                  <div className="text-xs text-muted-foreground">
                    Yerel güncelleme: {localUpdatedAt ? new Date(localUpdatedAt).toLocaleString("tr-TR") : "-"}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="mt-10 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-900 dark:text-slate-100">🤍D🩵</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <a
                href="https://github.com/talipakcelik"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                GitHub
              </a>

              <a
                href="https://twitter.com/talipqi"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
              >
                Twitter
              </a>
            </div>
          </div>
        </div>
      </footer>
      <Scratchpad />
    </div>
  );
}