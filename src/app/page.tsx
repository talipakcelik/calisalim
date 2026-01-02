"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription as ShadcnDialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

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


/** ========= Types ========= */
type Category = { id: string; name: string; color: string };
type Topic = { id: string; name: string; color?: string };

type ReadingStatus = "to_read" | "reading" | "done";
type ReadingType = "book" | "article" | "chapter" | "thesis" | "other";
type ReadingItem = {
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
  zoteroKey?: string; // <-- BU SATIRI EKLE (Opsiyonel alan)
};

type Session = {
  id: string;
  categoryId: string;
  topicId?: string;
  sourceId?: string;
  label: string;
  start: number;
  end: number;
  pausedMs?: number;
};

type Running = {
  categoryId: string;
  topicId?: string;
  sourceId?: string;
  label: string;
  wallStart: number;
  lastStart: number;
  elapsedActiveMs: number;
  isPaused: boolean;
  pausedAt?: number;
};

type Snapshot = {
  categories: Category[];
  topics: Topic[];
  reading: ReadingItem[];
  sessions: Session[];
  dailyTarget: number;
};

type CloudStatus = "disabled" | "signed_out" | "signed_in" | "syncing" | "error";
type RangeFilter = "all" | "today" | "week";
type ReadingStatusFilter = "all" | ReadingStatus;

/** ========= Defaults & Helpers ========= */

const OLD_COLOR_MAP: Record<string, string> = {
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

const DEFAULT_CATEGORIES: Category[] = [
  { id: "phd", name: "PhD / Tez", color: "#6366f1" },
  { id: "work", name: "İş", color: "#3b82f6" },
  { id: "reading", name: "Okuma", color: "#10b981" },
  { id: "writing", name: "Yazma", color: "#f43f5e" },
  { id: "admin", name: "İdari", color: "#f59e0b" },
  { id: "other", name: "Diğer", color: "#64748b" },
];

const DEFAULT_TOPICS: Topic[] = [
  { id: "lit", name: "Literatür Tarama", color: "#0ea5e9" },
  { id: "methods", name: "Yöntem", color: "#8b5cf6" },
  { id: "analysis", name: "Analiz", color: "#f97316" },
];

const getRandomBrightColor = () => {
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

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;

const pad2 = (n: number) => String(n).padStart(2, "0");

const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}sa ${m % 60}dk`;
  return `${m}dk ${s % 60}sn`;
};

const fmtCompact = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  if (hh > 0) return `${hh}:${pad2(mm)}`;
  return `${mm}:${pad2(ss)}`;
};

const fmtHmFromMs = (ms: number) => {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} dk`;
  if (m === 0) return `${h} saat`;
  return `${h} saat ${m} dk`;
};

const fmtHmFromHours = (hours: number) => fmtHmFromMs(Math.round(hours * 3600000));

const startOfDayMs = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const startOfWeekMs = (d: Date) => {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const sessionDurationMs = (s: Session) => Math.max(0, (s.end - s.start) - (s.pausedMs ?? 0));
const wallDurationMs = (s: Session) => Math.max(0, s.end - s.start);

const overlapActiveMs = (s: Session, rangeStart: number, rangeEnd: number) => {
  const w = wallDurationMs(s);
  if (w <= 0) return 0;
  const o = Math.max(0, Math.min(s.end, rangeEnd) - Math.max(s.start, rangeStart));
  if (o <= 0) return 0;
  const active = sessionDurationMs(s);
  return Math.max(0, Math.round(active * (o / w)));
};

const getCategoryPlaceholder = (catId: string, catName?: string) => {
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

const getUniqueLabelsForCategory = (sessions: Session[], categoryId: string) => {
  const labels = sessions
    .filter((s) => s.categoryId === categoryId && s.label && s.label.trim().length > 0)
    .map((s) => s.label.trim());
  return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b, "tr-TR"));
};

const parseTags = (raw: string) =>
  raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/** ========= Persistent State Hook ========= */
function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setState(JSON.parse(stored));
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state, hydrated]);

  return [state, setState, hydrated];
}

/** ========= Supabase (ENV only) ========= */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/** ========= Storage keys ========= */
const LS_CATEGORIES = "talip-v2.categories";
const LS_TOPICS = "talip-v2.topics";
const LS_READING = "talip-v2.reading";
const LS_SESSIONS = "talip-v2.sessions";
const LS_TARGET = "talip-v2.target";
const LS_UPDATED_AT = "talip-v2.updatedAt";
const LS_RUNNING = "talip-v2.running";

/** ========= Tiny Toast System ========= */
type ToastType = "success" | "error" | "info";
type ToastItem = { id: string; type: ToastType; title?: string; message: string; actionLabel?: string; actionId?: string };

function ToastViewport({
  toasts,
  remove,
  onAction,
}: {
  toasts: ToastItem[];
  remove: (id: string) => void;
  onAction: (actionId: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-2xl border bg-white dark:bg-slate-950 shadow-lg p-3 flex gap-3 items-start"
          role="status"
          aria-live="polite"
        >
          <div className="mt-0.5">
            {t.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : t.type === "error" ? (
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            ) : (
              <Info className="h-5 w-5 text-slate-600" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {t.title ? <div className="font-semibold text-sm">{t.title}</div> : null}
            <div className="text-sm text-slate-600 dark:text-slate-300">{t.message}</div>

            {t.actionLabel && t.actionId ? (
              <div className="mt-2">
                <button
                  className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline"
                  onClick={() => onAction(t.actionId!)}
                  type="button"
                >
                  {t.actionLabel}
                </button>
              </div>
            ) : null}
          </div>

          <button
            onClick={() => remove(t.id)}
            className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500"
            aria-label="Kapat"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** ========= Skeleton ========= */
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60 ${className}`} />
);

/** ========= ConfirmDialog ========= */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Evet",
  cancelText = "Vazgeç",
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <ShadcnDialogDescription>{description}</ShadcnDialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            {cancelText}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            type="button"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ========= Mini DateTime Picker ========= */
function roundToNearest5Min(ms: number) {
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


function MiniDateTimePicker({
  valueMs,
  onChange,
  label,
}: {
  valueMs: number;
  onChange: (ms: number) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const d = useMemo(() => new Date(valueMs), [valueMs]);
  
  // Takvim görünümü için state
  const [viewYear, setViewYear] = useState(d.getFullYear());
  const [viewMonth, setViewMonth] = useState(d.getMonth());

  // Popup her açıldığında takvim görünümünü seçili tarihe eşitle
  useEffect(() => {
    if (open) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [open, d]);

  // Click-Outside Mantığı (Düzeltildi)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!open) return;
      if (!wrapRef.current) return;

      const target = e.target as HTMLElement;

      // 1. Tıklama bizim bileşenin içindeyse kapatma
      if (wrapRef.current.contains(target)) return;

      // 2. KRİTİK DÜZELTME: Tıklama Shadcn/Radix Select portalının (açılan menü) içindeyse kapatma.
      // Radix UI genelde [data-radix-popper-content-wrapper] veya role="listbox" kullanır.
      if (target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]')) {
        return;
      }

      setOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    if (open) {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const daysInMonth = useMemo(() => new Date(viewYear, viewMonth + 1, 0).getDate(), [viewYear, viewMonth]);
  const firstDay = useMemo(() => new Date(viewYear, viewMonth, 1).getDay(), [viewYear, viewMonth]);
  const mondayIndex = useMemo(() => (firstDay === 0 ? 6 : firstDay - 1), [firstDay]);

  const selectedY = d.getFullYear();
  const selectedM = d.getMonth();
  const selectedDay = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();

  // Dakikayı en yakın 5'liğe görsel olarak eşlemek için (Select value eşleşmesi)
  const displayMinutes = String(Math.round(minutes / 5) * 5 % 60);

  const monthName = useMemo(
    () => new Date(viewYear, viewMonth, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
    [viewYear, viewMonth]
  );

  const setDatePreserveTime = (yy: number, mm: number, dd: number) => {
    const next = new Date(valueMs);
    next.setFullYear(yy, mm, dd);
    onChange(next.getTime());
  };

  const setTimePreserveDate = (hh: number, min: number) => {
    const next = new Date(valueMs);
    next.setHours(hh, min);
    // Saniye ve milisaniyeyi sıfırlayalım ki temiz görünsün
    next.setSeconds(0, 0); 
    onChange(next.getTime());
  };

  const display = useMemo(() => {
    const dt = new Date(valueMs);
    const dateStr = dt.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
    return `${dateStr} • ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
  }, [valueMs]);

  const hoursOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minuteOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

  return (
    <div className="col-span-3" ref={wrapRef}>
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between rounded-xl h-10 px-3 font-normal"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="truncate">{display}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground opacity-50" />
        </Button>
        <div className="text-[11px] text-muted-foreground px-1">{label}</div>
      </div>

      {open && (
        <div className="relative z-[100]">
          <div className="absolute top-2 left-0 z-[100] w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-white dark:bg-slate-950 shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-100">
            {/* Takvim Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => {
                  const m = viewMonth - 1;
                  if (m < 0) {
                    setViewMonth(11);
                    setViewYear((y) => y - 1);
                  } else setViewMonth(m);
                }}
              >
                ‹
              </Button>

              <div className="text-sm font-semibold">{monthName}</div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={() => {
                  const m = viewMonth + 1;
                  if (m > 11) {
                    setViewMonth(0);
                    setViewYear((y) => y + 1);
                  } else setViewMonth(m);
                }}
              >
                ›
              </Button>
            </div>

            {/* Gün İsimleri */}
            <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] text-slate-500 font-medium text-center">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((x) => (
                <div key={x}>{x}</div>
              ))}
            </div>

            {/* Günler Grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: mondayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-8" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const isSelected = selectedY === viewYear && selectedM === viewMonth && selectedDay === day;
                const isToday =
                  new Date().getDate() === day &&
                  new Date().getMonth() === viewMonth &&
                  new Date().getFullYear() === viewYear;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDatePreserveTime(viewYear, viewMonth, day)}
                    className={`h-8 rounded-lg text-sm transition-colors ${
                      isSelected
                        ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                        : isToday
                        ? "bg-slate-100 text-slate-900 font-semibold dark:bg-slate-800 dark:text-slate-100"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <Separator className="my-3" />

            {/* Saat Seçimi */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Saat</span>
                <Select value={String(hours)} onValueChange={(v) => setTimePreserveDate(Number(v), minutes)}>
                  <SelectTrigger className="h-9 rounded-lg text-xs">
                    <SelectValue placeholder="Saat" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[200px]">
                    {hoursOptions.map((h) => (
                      <SelectItem key={h} value={String(h)} className="text-xs">
                        {pad2(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Dakika</span>
                <Select
                  value={displayMinutes === "0" && minutes !== 0 && minutes !== 60 ? undefined : displayMinutes} 
                  onValueChange={(v) => setTimePreserveDate(hours, Number(v))}
                >
                  <SelectTrigger className="h-9 rounded-lg text-xs">
                    <SelectValue placeholder={pad2(minutes)} /> 
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[200px]">
                    {minuteOptions.map((m) => (
                      <SelectItem key={m} value={String(m)} className="text-xs">
                        {pad2(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button size="sm" type="button" variant="secondary" className="h-8 text-xs" onClick={() => setOpen(false)}>
                Tamam
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ========= ActiveTimer ========= */
const ActiveTimer = React.memo(
  ({
    running,
    onStop,
    onPause,
    onResume,
    categoryMap,
    topicMap,
    readingMap,
    themeColor,
  }: {
    running: Running;
    onStop: () => void;
    onPause: () => void;
    onResume: () => void;
    categoryMap: Map<string, Category>;
    topicMap: Map<string, Topic>;
    readingMap: Map<string, ReadingItem>;
    themeColor: string;
  }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
      const t = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(t);
    }, []);

    const liveActiveMs = useMemo(() => {
      if (running.isPaused) return running.elapsedActiveMs;
      return running.elapsedActiveMs + (now - running.lastStart);
    }, [running, now]);

    const catName = categoryMap.get(running.categoryId)?.name ?? running.categoryId;
    const topicName = running.topicId ? topicMap.get(running.topicId)?.name ?? running.topicId : null;
    const srcTitle = running.sourceId ? readingMap.get(running.sourceId)?.title ?? `Silinmiş: ${running.sourceId}` : null;

    return (
      <Card className="text-white border-none shadow-xl relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${themeColor} 0%, rgba(15, 23, 42, 1) 70%)`,
          }}
        />
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <CardContent className="flex flex-col gap-6 py-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/10 shadow-inner">
                <Timer className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-white/80 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{catName}</span>

                  {topicName ? (
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white border-0">
                      {topicName}
                    </Badge>
                  ) : null}

                  {srcTitle ? (
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white border-0">
                      <BookOpen className="mr-1 h-3.5 w-3.5" />
                      <span className="truncate max-w-[280px]">{srcTitle}</span>
                    </Badge>
                  ) : null}

                  <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white border-0">
                    {running.label ? running.label : "(etiketsiz)"}
                  </Badge>

                  <span className="text-xs text-white/60">• Başlangıç: {fmtTime(running.wallStart)}</span>
                </h3>

                <div className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight mt-1 font-mono">
                  {fmtDuration(liveActiveMs)}
                </div>

                {running.isPaused ? <div className="mt-2 text-xs text-white/70">Duraklatıldı</div> : null}
              </div>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {!running.isPaused ? (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 px-6 rounded-xl bg-white/10 hover:bg-white/15 text-white shadow-lg border border-white/10"
                  onClick={onPause}
                  type="button"
                >
                  <Pause className="mr-2 h-5 w-5" /> Duraklat
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-14 px-6 rounded-xl bg-white/10 hover:bg-white/15 text-white shadow-lg border border-white/10"
                  onClick={onResume}
                  type="button"
                >
                  <Play className="mr-2 h-5 w-5 fill-current" /> Devam
                </Button>
              )}

              <Button
                variant="destructive"
                size="lg"
                className="h-14 px-8 rounded-xl bg-white/10 hover:bg-white/15 text-white shadow-lg border border-white/10"
                onClick={onStop}
                type="button"
              >
                <Square className="mr-2 h-5 w-5 fill-current" /> Durdur & Kaydet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);
ActiveTimer.displayName = "ActiveTimer";

/** ========= Activity Heatmap Component ========= */
/** ========= Activity Heatmap Component (GitHub-like labels) ========= */
/** ========= Activity Heatmap Component (GitHub-like labels) ========= */
function ActivityHeatmap({ sessions, themeColor }: { sessions: Session[]; themeColor: string }) {
  // --- Build a 52-week grid aligned to Monday (like GitHub) ---
  const { days, weeks } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(start.getDate() - 363);
    start.setHours(0, 0, 0, 0);

    const day = start.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - mondayOffset);

    const totalDays = 53 * 7;

    const _days: Date[] = [];
    const d = new Date(start);
    for (let i = 0; i < totalDays; i++) {
      _days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }

    const _weeks: Date[][] = [];
    for (let i = 0; i < _days.length; i += 7) _weeks.push(_days.slice(i, i + 7));

    return { days: _days, weeks: _weeks };
  }, []);

  // --- Calculate totals per day (by day start) ---
  const dailyTotals = useMemo(() => {
    const map = new Map<number, number>();
    for (const day of days) {
      const start = day.getTime();
      const end = start + 86400000;
      let total = 0;
      for (const s of sessions) total += overlapActiveMs(s, start, end);
      if (total > 0) map.set(start, total);
    }
    return map;
  }, [sessions, days]);

  // --- Determine levels (0-4) ---
  const getLevel = (ms: number) => {
    if (ms <= 0) return 0;
    if (ms < 30 * 60 * 1000) return 1;
    if (ms < 60 * 60 * 1000) return 2;
    if (ms < 2 * 60 * 60 * 1000) return 3;
    return 4;
  };

  const getCellStyle = (level: number) => {
    if (level === 0) return {};
    const opacities = [0.18, 0.35, 0.6, 1.0];
    return { backgroundColor: themeColor, opacity: opacities[level - 1] };
  };

  // --- Month labels (top) ---
  const monthLabels = useMemo(() => {
    let prevMonth = -1;
    return weeks.map((week) => {
      const nextMonth =
        prevMonth === -1 ? week[0].getMonth() : week.find((d) => d.getMonth() !== prevMonth)?.getMonth();

      if (nextMonth === undefined || nextMonth === prevMonth) return "";
      prevMonth = nextMonth;

      const sampleDay = week.find((d) => d.getMonth() === nextMonth)!;
      return sampleDay.toLocaleDateString("tr-TR", { month: "short" });
    });
  }, [weeks]);

  const weekdayLabels = [
    { row: 0, label: "Pzt" },
    { row: 1, label: "Sal" },
    { row: 2, label: "Çar" },
    { row: 3, label: "Per" },
    { row: 4, label: "Cum" },
    { row: 5, label: "Cmt" },
    { row: 6, label: "Paz" },
  ];

  /** ======= NEW: Pretty tooltip state ======= */
  const [tip, setTip] = useState<null | {
    x: number;
    y: number;
    dateStr: string;
    durStr: string;
    ms: number;
    level: number;
  }>(null);

  const hideTip = useCallback(() => setTip(null), []);

  useEffect(() => {
    if (!tip) return;

    const onScroll = () => setTip((t) => (t ? { ...t } : null)); // keep open but position updates via mouse move
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideTip();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [tip, hideTip]);

  const setTipFromEvent = useCallback(
    (e: React.MouseEvent | React.FocusEvent, day: Date, total: number) => {
      const level = getLevel(total);
      const dateStr = day.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
      const durStr = fmtHmFromMs(total);

      // Prefer mouse position; fallback to element rect center for focus
      const isMouse = "clientX" in e;
      const x = isMouse ? (e as React.MouseEvent).clientX : (e.target as HTMLElement).getBoundingClientRect().left + (e.target as HTMLElement).getBoundingClientRect().width / 2;
      const y = isMouse ? (e as React.MouseEvent).clientY : (e.target as HTMLElement).getBoundingClientRect().top;

      setTip({ x, y, dateStr, durStr, ms: total, level });
    },
    []
  );

  const moveTip = useCallback((e: React.MouseEvent) => {
    setTip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  }, []);

  return (
    <div className="w-full relative">
      {/* NEW: Pretty tooltip */}
      {tip ? (
        <div
          className="pointer-events-none fixed z-[200] select-none"
          style={{
            left: tip.x,
            top: tip.y,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-950/95 backdrop-blur shadow-2xl px-3 py-2 min-w-[190px]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{tip.dateStr}</div>
              <div className="text-[11px] text-muted-foreground">Seviye {tip.level}</div>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{
                  backgroundColor: tip.level === 0 ? "transparent" : themeColor,
                  opacity: tip.level === 0 ? 1 : [0.18, 0.35, 0.6, 1.0][Math.max(0, tip.level - 1)],
                  border: tip.level === 0 ? "1px solid rgba(148,163,184,.6)" : "none",
                }}
              />
              <div className="text-sm text-slate-700 dark:text-slate-200">
                Toplam: <span className="font-semibold">{tip.durStr}</span>
              </div>
            </div>

            <div className="mt-1 text-[11px] text-muted-foreground">
              (Esc ile kapat)
            </div>
          </div>

          {/* arrow */}
          <div
            className="mx-auto h-2 w-2 rotate-45 border-b border-r border-slate-200/70 dark:border-slate-800/70 bg-white/95 dark:bg-slate-950/95"
            style={{ marginTop: -1 }}
          />
        </div>
      ) : null}

      {/* Top month row */}
      <div className="flex gap-2">
        <div className="w-10 shrink-0" />
        <div className="flex gap-1 overflow-x-auto w-full pb-2 scrollbar-hide">
          {monthLabels.map((label, idx) => (
            <div key={idx} className="w-[14px] text-[10px] text-muted-foreground leading-none">
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex gap-2">
        {/* Weekday labels */}
        <div className="w-10 shrink-0 pt-[2px]">
          <div className="grid grid-rows-7 gap-[3px]">
            {Array.from({ length: 7 }).map((_, r) => {
              const hit = weekdayLabels.find((x) => x.row === r);
              return (
                <div key={r} className="h-[11px] flex items-center justify-end pr-1">
                  {hit ? <span className="text-[10px] text-muted-foreground">{hit.label}</span> : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Weeks */}
        <div className="flex gap-1 overflow-x-auto w-full pb-2 scrollbar-hide">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="w-[14px] grid grid-rows-7 gap-[3px]">
              {week.map((day, dIdx) => {
                const ts = day.getTime();
                const total = dailyTotals.get(ts) || 0;
                const level = getLevel(total);

                return (
                  <button
                    key={`${wIdx}-${dIdx}`}
                    type="button"
                    className={[
                      "mx-auto flex-none w-[11px] h-[11px] rounded-sm transition-all",
                      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 dark:focus:ring-slate-600",
                      "hover:ring-1 hover:ring-offset-1 hover:ring-slate-400",
                      level === 0 ? "bg-transparent border border-slate-200/60 dark:border-slate-800/60" : "",
                    ].join(" ")}
                    style={getCellStyle(level)}
                    onMouseEnter={(e) => setTipFromEvent(e, day, total)}
                    onMouseMove={moveTip}
                    onMouseLeave={hideTip}
                    onFocus={(e) => setTipFromEvent(e, day, total)}
                    onBlur={hideTip}
                    aria-label={`${day.toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}: ${fmtHmFromMs(total)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Az</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <div
            key={l}
            className="w-[11px] h-[11px] rounded-sm border border-slate-200/60 dark:border-slate-800/60"
            style={getCellStyle(l)}
          />
        ))}
        <span>Çok</span>
      </div>
    </div>
  );
}

/** ========= Session Dialog ========= */
function SessionDialog({
  isOpen,
  onOpenChange,
  initialData,
  categories,
  topics,
  reading,
  sessions,
  onSave,
  onQuickAddSource,
  toast,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: Session | null;
  categories: Category[];
  topics: Topic[];
  reading: ReadingItem[];
  sessions: Session[];
  onSave: (s: Partial<Session>) => void;
  onQuickAddSource: () => void;
  toast: (type: ToastType, message: string, title?: string) => void;
}) {
  const [formData, setFormData] = useState({
    categoryId: "",
    topicId: "",
    sourceId: "",
    label: "",
    startMs: Date.now(),
    endMs: Date.now(),
  });

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData({
        categoryId: initialData.categoryId,
        topicId: initialData.topicId ?? "none",
        sourceId: initialData.sourceId ?? "none",
        label: initialData.label,
        startMs: initialData.start,
        endMs: initialData.end,
      });
    } else {
      // Temiz bir başlangıç saati (saniyesiz)
      const now = new Date();
      now.setSeconds(0, 0);
      const nowMs = now.getTime();
      
      setFormData({
        categoryId: categories[0]?.id || "",
        topicId: "none",
        sourceId: "none",
        label: "",
        startMs: nowMs - 3600000, // 1 saat önce
        endMs: nowMs,
      });
    }
  }, [isOpen, initialData, categories]);

  const suggestedLabels = useMemo(() => {
    if (!formData.categoryId) return [];
    return getUniqueLabelsForCategory(sessions, formData.categoryId);
  }, [sessions, formData.categoryId]);

  const selectedCategory = categories.find((c) => c.id === formData.categoryId);
  const placeholder = getCategoryPlaceholder(formData.categoryId, selectedCategory?.name);

  // Hızlı Ayar Fonksiyonları (Saniye temizliği ile)
  const shiftTime = (amountMinutes: number) => {
    // Hem başlangıcı hem bitişi kaydırmak yerine genelde kullanıcı
    // süreyi uzatmak/kısaltmak veya başlangıç zamanını düzeltmek ister.
    // Burada basitçe seçili olan zamanları kaydıracağız.
    setFormData(prev => {
      const s = new Date(prev.startMs);
      s.setMinutes(s.getMinutes() + amountMinutes);
      s.setSeconds(0, 0);
      
      // Bitişi değiştirmek istemiyorsak sadece start'ı oynatabiliriz, 
      // ama genelde "-15dk" demek "15dk daha erken başladım" demektir.
      return { ...prev, startMs: s.getTime() };
    });
  };

  const setEndToNow = () => {
    const now = new Date();
    now.setSeconds(0, 0);
    setFormData(prev => ({ ...prev, endMs: now.getTime() }));
  };

  const handleSave = () => {
    const start = formData.startMs;
    const end = formData.endMs;

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      toast("error", "Lütfen geçerli bir tarih seçin.", "Hatalı tarih");
      return;
    }
    if (end <= start) {
      toast("error", "Bitiş zamanı başlangıçtan sonra olmalıdır.", "Hatalı zaman aralığı");
      return;
    }

    onSave({
      id: initialData?.id,
      categoryId: formData.categoryId,
      topicId: formData.topicId && formData.topicId !== "none" ? formData.topicId : undefined,
      sourceId: formData.sourceId && formData.sourceId !== "none" ? formData.sourceId : undefined,
      label: formData.label,
      start,
      end,
    });

    toast("success", initialData ? "Kayıt güncellendi." : "Kayıt eklendi.");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{initialData ? "Kaydı Düzenle" : "Manuel Kayıt Ekle"}</DialogTitle>
          <ShadcnDialogDescription>
            {initialData ? "Mevcut çalışma kaydını güncelle." : "Geçmişe dönük bir çalışma kaydı oluştur."}
          </ShadcnDialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 overflow-y-auto flex-1 pr-2">
          {/* 1. TEMEL ALANLAR */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Kategori</Label>
            <Select value={formData.categoryId} onValueChange={(v) => setFormData((p) => ({ ...p, categoryId: v }))}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Kategori seç" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Konu</Label>
            <Select value={formData.topicId} onValueChange={(v) => setFormData((p) => ({ ...p, topicId: v }))}>
              <SelectTrigger className="col-span-3">
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

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Kaynak</Label>
            <div className="col-span-3 flex gap-2">
              <Select value={formData.sourceId} onValueChange={(v) => setFormData((p) => ({ ...p, sourceId: v }))}>
                <SelectTrigger className="flex-1">
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

              <Button type="button" variant="outline" className="rounded-xl px-3" onClick={onQuickAddSource} title="Yeni kaynak ekle">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Etiket</Label>
            <div className="col-span-3">
              <Input
                value={formData.label}
                onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                placeholder={placeholder}
                list="dialog-labels"
                autoComplete="off"
              />
              <datalist id="dialog-labels">
                {suggestedLabels.map((label) => (
                  <option key={label} value={label} />
                ))}
              </datalist>
            </div>
          </div>

          <Separator className="my-1" />

          {/* 2. TARİH ALANLARI */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right pt-2 self-start">Başlangıç</Label>
            <MiniDateTimePicker
              valueMs={formData.startMs}
              onChange={(ms) => setFormData((p) => ({ ...p, startMs: ms }))}
              label="Başlangıç Tarihi ve Saati"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right pt-2 self-start">Bitiş</Label>
            <MiniDateTimePicker
              valueMs={formData.endMs}
              onChange={(ms) => setFormData((p) => ({ ...p, endMs: ms }))}
              label="Bitiş Tarihi ve Saati"
            />
          </div>

          {/* 3. HIZLI AYARLAR */}
          <div className="grid grid-cols-4 items-start gap-4 mt-2">
            <Label className="text-right pt-2 text-xs text-muted-foreground">Hızlı Ayar</Label>
            <div className="col-span-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs"
                onClick={() => shiftTime(-15)}
              >
                Başlangıç -15dk
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs"
                onClick={() => shiftTime(15)}
              >
                Başlangıç +15dk
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-xs"
                onClick={setEndToNow}
              >
                Bitiş: Şimdi
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
            İptal
          </Button>
          <Button onClick={handleSave} type="button">
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ========= Reading Dialog (with DOI/BibTeX) ========= */
function normalizeDoi(input: string) {
  const raw = input.trim();
  if (!raw) return "";
  // accept "https://doi.org/..." or "doi:10...."
  return raw
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .trim();
}

function extractBibtexField(text: string, key: string) {
  // supports: key = {..} or key = ".." (simple, non-nested)
  const re = new RegExp(`${key}\\s*=\\s*(\\{([^}]*)\\}|"([^"]*)")`, "i");
  const m = text.match(re);
  if (!m) return "";
  return (m[2] ?? m[3] ?? "").trim();
}

function mapBibtexTypeToReadingType(entryType: string): ReadingType {
  const t = (entryType || "").toLowerCase();

  // books
  if (t === "book") return "book";

  // chapters
  if (t === "incollection" || t === "inbook" || t === "bookchapter" || t === "chapter") return "chapter";

  // theses
  if (t === "phdthesis" || t === "mastersthesis" || t === "thesis") return "thesis";

  // articles / proceedings
  if (t === "article" || t === "inproceedings" || t === "proceedings" || t === "conference") return "article";

  return "other";
}

function pickYearFromCrossref(message: any): string {
  const candidates = [
    message?.issued,
    message?.published,
    message?.["published-print"],
    message?.["published-online"],
    message?.created,
    message?.deposited,
  ];

  for (const c of candidates) {
    const y = c?.["date-parts"]?.[0]?.[0];
    if (y && Number.isFinite(Number(y))) return String(y);
  }

  // sometimes it's a plain date string
  const dateStr =
    message?.created?.["date-time"] ||
    message?.published?.["date-time"] ||
    message?.issued?.["date-time"] ||
    message?.["published-online"]?.["date-time"] ||
    "";

  const m = String(dateStr).match(/(\d{4})/);
  return m ? m[1] : "";
}

function ReadingDialog({
  isOpen,
  onOpenChange,
  initialData,
  onSave,
  toast,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: ReadingItem | null;
  onSave: (item: ReadingItem) => void;
  toast: (type: ToastType, message: string, title?: string) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    authors: "",
    year: "",
    type: "book" as ReadingType,
    status: "to_read" as ReadingStatus,
    tags: "",
    url: "",
    doi: "",
    notes: "",
  });
  const [isFetchingDoi, setIsFetchingDoi] = useState(false);
  const [showBibtexInput, setShowBibtexInput] = useState(false);
  const [bibtexInput, setBibtexInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setForm({
        title: initialData.title,
        authors: initialData.authors ?? "",
        year: initialData.year ?? "",
        type: initialData.type,
        status: initialData.status,
        tags: (initialData.tags ?? []).join(", "),
        url: initialData.url ?? "",
        doi: initialData.doi ?? "",
        notes: initialData.notes ?? "",
      });
    } else {
      setForm({ title: "", authors: "", year: "", type: "book", status: "to_read", tags: "", url: "", doi: "", notes: "" });
      setShowBibtexInput(false);
      setBibtexInput("");
    }
  }, [isOpen, initialData]);

  // DOI Fetch Logic (Crossref) — includes year parsing fix
  const handleFetchDoi = async () => {
    const doiNorm = normalizeDoi(form.doi);
    if (!doiNorm) {
      toast("error", "Lütfen bir DOI girin.", "DOI Hatası");
      return;
    }
    setIsFetchingDoi(true);
    try {
      const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doiNorm)}`);
      if (!response.ok) throw new Error("Kaynak bulunamadı");

      const data = await response.json();
      const item = data.message;

      const title = Array.isArray(item.title) ? item.title[0] : item.title || "";
      const authors = item.author ? item.author.map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean).join(", ") : "";
      const year = pickYearFromCrossref(item);

      if (!title) throw new Error("Başlık bulunamadı");

      const crossrefUrl = item.URL || (doiNorm ? `https://doi.org/${doiNorm}` : "");

      setForm((prev) => ({
        ...prev,
        title,
        authors: authors || prev.authors,
        year: year || prev.year,
        doi: doiNorm,
        url: prev.url || crossrefUrl,
      }));
      toast("success", "Bilgiler çekildi.");
    } catch (err: any) {
      toast("error", err.message || "DOI çekilemedi.", "Hata");
    } finally {
      setIsFetchingDoi(false);
    }
  };

  // BibTeX Parse Logic — includes type mapping
  const handleImportBibtex = () => {
    const text = bibtexInput.trim();
    if (!text) {
      setShowBibtexInput(false);
      return;
    }

    const entryTypeMatch = text.match(/@(\w+)\s*{/i);
    const entryType = entryTypeMatch?.[1] ?? "";

    const title = extractBibtexField(text, "title");
    const author = extractBibtexField(text, "author");
    const year = extractBibtexField(text, "year");
    const doi = extractBibtexField(text, "doi");
    const url = extractBibtexField(text, "url");

    const mappedType = entryType ? mapBibtexTypeToReadingType(entryType) : undefined;

    if (title || author) {
      // normalize authors: "A and B and C" -> "A, B, C"
      const normalizedAuthors = author ? author.replace(/\s+and\s+/gi, ", ").trim() : "";

      setForm((prev) => ({
        ...prev,
        title: title || prev.title,
        authors: normalizedAuthors || prev.authors,
        year: year || prev.year,
        doi: doi ? normalizeDoi(doi) : prev.doi,
        url: url || prev.url,
        type: mappedType ?? prev.type,
      }));

      toast("success", "BibTeX içe aktarıldı.");
      setShowBibtexInput(false);
      setBibtexInput("");
    } else {
      toast("error", "Geçerli bir BibTeX formatı bulunamadı.", "Hata");
    }
  };

  const save = () => {
    if (!form.title.trim()) {
      toast("error", "Başlık boş olamaz.", "Hata");
      return;
    }

    const item: ReadingItem = {
      id: initialData?.id ?? uid(),
      title: form.title.trim(),
      authors: form.authors.trim() || undefined,
      year: form.year.trim() || undefined,
      type: form.type,
      status: form.status,
      tags: parseTags(form.tags),
      url: form.url.trim() || undefined,
      doi: normalizeDoi(form.doi) || undefined,
      notes: form.notes.trim() || undefined,
      updatedAt: Date.now(),
    };

    onSave(item);
    toast("success", initialData ? "Kaynak güncellendi." : "Kaynak eklendi.");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[780px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Kaynağı Düzenle" : "Yeni Kaynak Ekle"}</DialogTitle>
          <ShadcnDialogDescription>Okuduğun kitap/makaleyi kütüphanene ekle.</ShadcnDialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowBibtexInput(!showBibtexInput)}>
              <Database className="mr-2 h-4 w-4" /> {showBibtexInput ? "BibTeX Gizle" : "BibTeX Yapıştır"}
            </Button>
          </div>

          {showBibtexInput ? (
            <div className="space-y-2">
              <Label>BibTeX Metni</Label>
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm font-mono"
                value={bibtexInput}
                onChange={(e) => setBibtexInput(e.target.value)}
                placeholder='@article{key, title={...}, author={...}, year={...}, doi={...}}'
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowBibtexInput(false)}>
                  İptal
                </Button>
                <Button type="button" onClick={handleImportBibtex}>
                  İçe Aktar
                </Button>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Desteklenen tür eşleşmeleri: book→Kitap, incollection/inbook→Bölüm, phdthesis/mastersthesis→Tez, article/inproceedings→Makale.
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Başlık</Label>
                <Input className="col-span-3" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Örn: Debt (Graeber)" />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">DOI</Label>
                <div className="col-span-3 flex gap-2">
                  <Input className="flex-1" value={form.doi} onChange={(e) => setForm((p) => ({ ...p, doi: e.target.value }))} placeholder="10.1080/... veya https://doi.org/..." />
                  <Button type="button" variant="secondary" onClick={handleFetchDoi} disabled={isFetchingDoi}>
                    {isFetchingDoi ? <Loader2 className="h-4 w-4 animate-spin" /> : "Getir"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Yazar(lar)</Label>
                <Input className="col-span-3" value={form.authors} onChange={(e) => setForm((p) => ({ ...p, authors: e.target.value }))} placeholder="Örn: David Graeber" />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Yıl</Label>
                <Input className="col-span-3" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} placeholder="Örn: 2011" />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Tür</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as ReadingType }))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book">Kitap</SelectItem>
                    <SelectItem value="article">Makale</SelectItem>
                    <SelectItem value="chapter">Kitap Bölümü</SelectItem>
                    <SelectItem value="thesis">Tez</SelectItem>
                    <SelectItem value="other">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Durum</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ReadingStatus }))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_read">Okunacak</SelectItem>
                    <SelectItem value="reading">Okunuyor</SelectItem>
                    <SelectItem value="done">Bitti</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Etiketler</Label>
                <Input className="col-span-3" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="virgülle ayır: antropoloji, emek, değer" />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Link</Label>
                <Input className="col-span-3" value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." />
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Notlar</Label>
                <div className="col-span-3">
                  <textarea
                    className="w-full min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-sm"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Özet, alıntı, sayfa referansı, tartışma notları..."
                  />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    İpucu: Oturumlara “Kaynak” seçerek okuma süreni kaynağa bağlayabilirsin.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} type="button">
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ========= BibTeX Parser Helper (BUNU EKLE) ========= */
function parseBulkBibtex(fileContent: string): ReadingItem[] {
  const rawEntries = fileContent.split(/^@/m).filter((e) => e.trim().length > 10);
  const items: ReadingItem[] = [];

  rawEntries.forEach((entryRaw) => {
    const typeMatch = entryRaw.match(/^(\w+)\s*\{([^,]+),/);
    if (!typeMatch) return;

    const entryType = typeMatch[1].toLowerCase();
    const bibKey = typeMatch[2].trim();

    const getField = (key: string) => {
      const re = new RegExp(`${key}\\s*=\\s*[\\{"](.*?)[\\}"](?=,\\s*\\n|\\s*\\})`, "is");
      const m = entryRaw.match(re);
      return m ? m[1].replace(/[\n\r]+/g, " ").replace(/\s+/g, " ").trim() : "";
    };

    const title = getField("title").replace(/[{}]/g, "");
    const author = getField("author").replace(/\s+and\s+/gi, ", ").replace(/[{}]/g, "");
    const year = getField("year");
    const doi = getField("doi");
    const url = getField("url");
    const abstract = getField("abstract");
    const keywords = getField("keywords"); 

    let type: ReadingType = "other";
    if (entryType.includes("book")) type = "book";
    else if (entryType.includes("article") || entryType.includes("periodical")) type = "article";
    else if (entryType.includes("incollection") || entryType.includes("chapter")) type = "chapter";
    else if (entryType.includes("thesis")) type = "thesis";

    if (title) {
      items.push({
        id: `bib_${bibKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title,
        authors: author,
        year,
        type,
        status: "to_read",
        tags: keywords ? keywords.split(/[,;]/).map(t => t.trim()) : [],
        doi,
        url,
        notes: abstract ? `Özet: ${abstract.substring(0, 300)}...` : "",
        updatedAt: Date.now(),
      });
    }
  });
  return items;
}


/** ========= Page ========= */
export default function Page() {
  // 1. BU SATIRLARI EKLE (Mevcut kodunun en başına)
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);
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
  });

  useEffect(() => {
    stateRef.current = {
      categories,
      topics,
      reading,
      sessions,
      dailyTarget,
      localUpdatedAt,
    };
  }, [categories, topics, reading, sessions, dailyTarget, localUpdatedAt]);

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
      label: quickLabel.trim(),
      wallStart: now,
      lastStart: now,
      elapsedActiveMs: 0,
      isPaused: false,
    };

    setRunning(next);
  }, [running, quickCat, categories, quickTopicId, quickSourceId, quickLabel]);

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
      label: running.label,
      start: wallStart,
      end: now,
      pausedMs,
    };

    setSessions((prev) => [newSession, ...(prev ?? [])]);
    setLocalUpdatedAt(Date.now());
    setRunning(null);
    setQuickLabel("");
    toast("success", "Kayıt kaydedildi.");
  }, [running, currentActiveMs, setSessions, setLocalUpdatedAt, toast]);

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

  // 1. Zotero API'sine giden yard�mc� fonksiyon
  const fetchZoteroLibrary = async (apiKey: string, userId: string) => {
    // Son eklenen 50 kayna�� �eker.
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

    // Zotero verisini senin uygulaman�n format�na (ReadingItem) �eviriyoruz
    const mappedItems: ReadingItem[] = data.map((z: any) => {
      const d = z.data;
      
      // Yazarlar� birle�tir
      const authors = d.creators
        ? d.creators.map((c: any) => `${c.firstName || ''} ${c.lastName || ''}`.trim()).join(", ")
        : "";

      // T�rleri e�le�tir
      let type: ReadingType = "other";
      if (d.itemType === "book") type = "book";
      else if (d.itemType === "journalArticle") type = "article";
      else if (d.itemType === "bookSection") type = "chapter";
      else if (d.itemType === "thesis") type = "thesis";

      // Y�l� bul
      const dateStr = d.date || "";
      const yearMatch = dateStr.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : "";

      return {
        id: `zotero_${d.key}`, // ID �ak��mas�n� �nlemek i�in prefix
        zoteroKey: d.key,
        title: d.title || "(Ba�l�ks�z)",
        authors: authors,
        year: year,
        type: type,
        status: "to_read", // Varsay�lan olarak "Okunacak" eklenir
        tags: d.tags ? d.tags.map((t: any) => t.tag) : [],
        url: d.url || "",
        doi: d.DOI || "",
        notes: d.abstractNote || "", // �zeti notlara ekle
        updatedAt: Date.now(),
      };
    });

    return mappedItems;
  };

  // 2. Butona bas�ld���nda �al��acak ana fonksiyon
  const handleZoteroSync = async () => {
    if (!zoteroApiKey || !zoteroUserId) {
      toast("error", "Lütfen API Key ve User ID alanlarını doldurun.");
      return;
    }

    setIsSyncingZotero(true);
    try {
      const newItems = await fetchZoteroLibrary(zoteroApiKey, zoteroUserId);
      
      setReading((prev) => {
        // Zaten ekli olanlar� tekrar ekleme (zoteroKey kontrol�)
        const existingKeys = new Set(prev.map((p) => p.zoteroKey).filter(Boolean));
        const uniqueNew = newItems.filter((i) => !existingKeys.has(i.zoteroKey));
        
        if (uniqueNew.length === 0) {
          toast("info", "Kütüphaneniz güncel, yeni kaynak bulunamadı.");
          return prev;
        }
        
        toast("success", `${uniqueNew.length} yeni kaynak Zotero'dan eklendi.`);
        // Yeni gelenleri listenin en ba��na koy
        return [...uniqueNew, ...prev].sort((a, b) => b.updatedAt - a.updatedAt);
      });
      
      setLocalUpdatedAt(Date.now());
      setZoteroDialogOpen(false); // ��lem bitince pencereyi kapat
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
  }, [sessions, searchQuery, rangeFilter, categoryFilter, categoryMap, topicMap, readingMap]);

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

  const loadDemoData = () => {
    const now = Date.now();
    const demoCats: Category[] = [
      { id: "phd", name: "PhD / Tez", color: "#6366f1" },
      { id: "reading", name: "Okuma", color: "#10b981" },
      { id: "writing", name: "Yazma", color: "#f97316" },
      { id: "notes", name: "Not / Zettelkasten", color: "#06b6d4" },
      { id: "admin", name: "İdari", color: "#64748b" },
    ];
    const mk = (daysAgo: number, startH: number, startM: number, durMin: number, categoryId: string, label: string) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      d.setHours(startH, startM, 0, 0);
      const start = d.getTime();
      const end = start + durMin * 60_000;
      const pausedMs = durMin >= 60 ? 5 * 60_000 : 0;
      const s: Session = {
        id: uid(),
        categoryId,
        label,
        start,
        end,
        pausedMs,
      };
      return s;
    };
    const demoSessions: Session[] = [
      mk(0, 9, 10, 65, "reading", "Graeber – Debt (Ch. 5)"),
      mk(0, 11, 0, 50, "notes", "Not çıkarma + alıntı fişi"),
      mk(0, 14, 20, 80, "writing", "Tez bölümü taslağı"),
      mk(1, 10, 0, 45, "reading", "Moten – Undercommons (pp. 20–35)"),
      mk(1, 16, 10, 70, "phd", "Literatür haritalama"),
      mk(2, 9, 40, 40, "admin", "E-posta + planlama"),
      mk(2, 13, 30, 90, "reading", "Institutional Ethnography makale"),
      mk(3, 10, 15, 60, "writing", "Metin revizyonu"),
      mk(5, 9, 0, 75, "phd", "Tez: araştırma soruları"),
      mk(7, 15, 0, 55, "reading", "Favret-Saada notları"),
    ].sort((a, b) => b.start - a.start);

    setCategories(demoCats);
    setSessions(demoSessions);
    setDailyTarget(3);
    setLocalUpdatedAt(now);
    setRunning(null);
    setQuickCat(demoCats[0].id);
    setQuickLabel("");
    toast("success", "Demo veri yüklendi.");
  };

  const loadHeatmapDemoData = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 363);
    start.setHours(0, 0, 0, 0);

    // Eğer hiç kategori yoksa defaultları garantiye al
    const ensuredCats = (categories?.length ? categories : DEFAULT_CATEGORIES);
    if (!categories?.length) setCategories(ensuredCats);

    const catIds = ensuredCats.map((c) => c.id);

    // Deterministic-ish random (aynı gün -> benzer dağılım)
    const seeded = (seed: number) => {
      let t = seed + 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const sessionsToAdd: Session[] = [];

    for (let i = 0; i < 364; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);

      const daySeed = day.getTime();
      const r = seeded(daySeed);

      // Bazı günler boş kalsın (heatmap seviyeleri görünür olsun)
      // ~%45 gün boş, kalan günler 1-3 oturum
      if (r < 0.45) continue;

      const sessionCount = r < 0.75 ? 1 : r < 0.92 ? 2 : 3;

      for (let k = 0; k < sessionCount; k++) {
        const rr = seeded(daySeed + k * 999);

        // Saat: 9-22 arası
        const startHour = 9 + Math.floor(rr * 14); // 9..22
        const startMin = [0, 10, 15, 20, 30, 40, 45, 50][Math.floor(seeded(daySeed + k * 77) * 8)];

        // Süre: 20m - 140m arası
        const durMin = 20 + Math.floor(seeded(daySeed + k * 123) * 120);

        const d0 = new Date(day);
        d0.setHours(startHour, startMin, 0, 0);
        const startMs = d0.getTime();
        const endMs = startMs + durMin * 60_000;

        const categoryId = catIds[Math.floor(seeded(daySeed + k * 555) * catIds.length)] || "other";

        const pausedMs = durMin >= 60 && seeded(daySeed + k * 42) > 0.6 ? 5 * 60_000 : 0;

        sessionsToAdd.push({
          id: uid(),
          categoryId,
          label: "Heatmap demo",
          start: startMs,
          end: endMs,
          pausedMs,
        });
      }
    }

    // Yeni veriyi ekle (eskiyi silme)
    setSessions((prev) => [...(sessionsToAdd), ...(prev ?? [])].sort((a, b) => b.start - a.start));
    setLocalUpdatedAt(Date.now());
    toast("success", "Heatmap demo verisi eklendi.");
  };

  const clearDemoData = () => {
    const now = Date.now();
    setSessions([]);
    setCategories(DEFAULT_CATEGORIES);
    setDailyTarget(2);
    setLocalUpdatedAt(now);
    setRunning(null);
    setQuickCat(DEFAULT_CATEGORIES[0]?.id || "other");
    setQuickLabel("");
    toast("info", "Demo veri temizlendi.");
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
  if (!isMounted ||!allHydrated) {
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
        open={confirmLoadHeatmapDemo}
        onOpenChange={setConfirmLoadHeatmapDemo}
        title="Aktivite Izgarası için demo veri yüklensin mi?"
        description="52 haftalık ızgarada günlere yayılmış örnek kayıtlar eklenecek. Mevcut kayıtlar korunur."
        confirmText="Evet, ekle"
        cancelText="Vazgeç"
        onConfirm={loadHeatmapDemoData}
      />

      <ConfirmDialog
        open={confirmLoadDemoData}
        onOpenChange={setConfirmLoadDemoData}
        title="Demo verisi yüklensin mi?"
        description="Mevcut kategoriler ve kayıtlar demo verilerle değiştirilecek. (Geri alınamaz)"
        destructive
        confirmText="Evet, yükle"
        cancelText="Vazgeç"
        onConfirm={loadDemoData}
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
          onSave={handleSessionSave}
          onQuickAddSource={quickAddSourceFromSessionDialog}
          toast={(type, message, title) => toast(type, message, title)}
        />

        <ReadingDialog
          isOpen={readingDialogOpen}
          onOpenChange={setReadingDialogOpen}
          initialData={editingReading}
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

        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <div className="text-primary-foreground p-2 rounded-xl" style={{ backgroundColor: theme.hex }}>
                <Timer className="h-6 w-6" />
              </div>
              Çalışalım
            </h1>

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

        {/* Active Timer Card */}
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
              themeColor={theme.hex}
            />
          )}
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

              <p className="text-xs text-muted-foreground mt-3">{progressPercent >= 100 ? "Harika! Hedef tamam 🎉" : "Hedefe ulaşmak için devam."}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Bu Hafta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{weekHuman}</div>
              <div className="text-xs text-muted-foreground mt-1">Haftalık toplam çalışma süresi</div>
            </CardContent>
          </Card>
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
                      {isImportingBib ? <Loader2 className="h-4 w-4 animate-spin"/> : <Database className="h-4 w-4 text-orange-600" />}
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
                  <CardTitle className="text-base">Veri</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start" onClick={handleExportCSV} type="button">
                    <Download className="mr-2 h-4 w-4" /> Filtreli kayıtları CSV indir
                  </Button>

                  <Separator />

                  <Separator className="my-3" />

                  <Button variant="outline" className="w-full justify-start" onClick={() => setConfirmLoadDemoData(true)} type="button">
                    Demo veriyi yükle
                  </Button>

                  <Button variant="outline" className="w-full justify-start" onClick={clearDemoData} type="button">
                    Demo veriyi temizle
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setConfirmLoadHeatmapDemo(true)}
                    type="button"
                  >
                    Aktivite Izgarası için demo ekle
                  </Button>

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
    </div>
  );
}