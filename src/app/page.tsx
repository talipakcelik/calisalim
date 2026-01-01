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
  DialogTrigger,
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
type Session = {
  id: string;
  categoryId: string;
  label: string;
  start: number;
  end: number;
  pausedMs?: number;
};

type Running = {
  categoryId: string;
  label: string;
  wallStart: number; // ilk başlat anı (persist edilir)
  lastStart: number; // son resume anı (persist edilir)
  elapsedActiveMs: number; // pause öncesi birikmiş aktif süre
  isPaused: boolean;
  pausedAt?: number;
};

type Snapshot = { categories: Category[]; sessions: Session[]; dailyTarget: number };
type CloudStatus = "disabled" | "signed_out" | "signed_in" | "syncing" | "error";
type RangeFilter = "all" | "today" | "week";

/** ========= Defaults & Helpers ========= */

// Eski versiyondaki tailwind class'larını hex'e çevirmek için harita
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
  { id: "sport", name: "Spor", color: "#f43f5e" },
  { id: "social", name: "Sosyal", color: "#f59e0b" },
  { id: "other", name: "Diğer", color: "#64748b" },
];

/** Rastgele canlı renk üretici (bozuk renkler için fallback) */
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

/** Unified human time format */
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

/** Datetime input helper (YYYY-MM-DDTHH:mm) */
const toInputDateTime = (ms: number) => {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Helper: Bir kategori için akıllı placeholder metni */
const getCategoryPlaceholder = (catId: string, catName?: string) => {
  const lowerName = (catName || "").toLowerCase();
  const lowerId = catId.toLowerCase();

  if (lowerId === "phd" || lowerId.includes("tez") || lowerName.includes("tez") || lowerName.includes("doktora")) {
    return "Hangi kitap, makale veya bölüm?";
  }
  if (lowerId === "reading" || lowerName.includes("okuma")) {
    return "Kitap veya makale adı...";
  }
  if (lowerId === "work" || lowerName.includes("iş")) {
    return "Proje veya görev adı...";
  }
  return "Ne üzerinde çalışıyorsun?";
};

/** Helper: Geçmiş oturumlardan o kategoride kullanılmış benzersiz etiketleri getirir */
const getUniqueLabelsForCategory = (sessions: Session[], categoryId: string) => {
  const labels = sessions
    .filter((s) => s.categoryId === categoryId && s.label && s.label.trim().length > 0)
    .map((s) => s.label.trim());

  return Array.from(new Set(labels)).sort((a, b) => a.localeCompare(b, "tr-TR"));
};

function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
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
const LS_SESSIONS = "talip-v2.sessions";
const LS_TARGET = "talip-v2.target";
const LS_UPDATED_AT = "talip-v2.updatedAt";
const LS_RUNNING = "talip-v2.running";

/** ========= Duration helpers (pause aware) ========= */
const sessionDurationMs = (s: Session) => Math.max(0, (s.end - s.start) - (s.pausedMs ?? 0));
const wallDurationMs = (s: Session) => Math.max(0, s.end - s.start);

/**
 * Bir session'ın aktif süresini (paused düşülmüş) gün/hafta gibi bucket aralıklarına dağıtmak için:
 * - session wall aralığı ile bucket aralığının kesişimini bul
 * - aktif süreyi wall içinde oransal kabul edip overlap kısmına paylaştır
 */
const overlapActiveMs = (s: Session, rangeStart: number, rangeEnd: number) => {
  const w = wallDurationMs(s);
  if (w <= 0) return 0;

  const o = Math.max(0, Math.min(s.end, rangeEnd) - Math.max(s.start, rangeStart));
  if (o <= 0) return 0;

  const active = sessionDurationMs(s);
  return Math.max(0, Math.round(active * (o / w)));
};

/** ========= Tiny Toast System (single-file, with optional action) ========= */
type ToastType = "success" | "error" | "info";
type ToastItem = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  actionLabel?: string;
  actionId?: string;
};

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
          className="rounded-2xl border bg-white shadow-lg p-3 flex gap-3 items-start"
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
            <div className="text-sm text-slate-600">{t.message}</div>

            {t.actionLabel && t.actionId ? (
              <div className="mt-2">
                <button
                  className="text-sm font-semibold text-slate-900 hover:underline"
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
            className="rounded-lg p-1 hover:bg-slate-100 text-slate-500"
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

/** ========= Skeleton (single-file) ========= */
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60 ${className}`} />
);

/** ========= ConfirmDialog (Dialog-based, single-file) ========= */
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

/** ========= Mini DateTime Picker (Popover + Calendar + Time) ========= */
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
  const [viewYear, setViewYear] = useState(d.getFullYear());
  const [viewMonth, setViewMonth] = useState(d.getMonth()); // 0-11

  useEffect(() => {
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [d.getFullYear(), d.getMonth()]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
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
  const firstDay = useMemo(() => new Date(viewYear, viewMonth, 1).getDay(), [viewYear, viewMonth]); // 0 sunday
  const mondayIndex = useMemo(() => (firstDay === 0 ? 6 : firstDay - 1), [firstDay]); // 0 monday

  const selectedY = d.getFullYear();
  const selectedM = d.getMonth();
  const selectedDay = d.getDate();

  const hours = d.getHours();
  const minutes = d.getMinutes();

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
    next.setHours(hh, min, 0, 0);
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
          className="w-full justify-between rounded-xl"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="truncate">{display}</span>
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </div>

      {open ? (
        <div className="relative">
          <div className="absolute z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-white shadow-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => {
                  const m = viewMonth - 1;
                  if (m < 0) {
                    setViewMonth(11);
                    setViewYear((y) => y - 1);
                  } else {
                    setViewMonth(m);
                  }
                }}
                aria-label="Önceki ay"
              >
                ‹
              </Button>

              <div className="text-sm font-semibold">{monthName}</div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl"
                onClick={() => {
                  const m = viewMonth + 1;
                  if (m > 11) {
                    setViewMonth(0);
                    setViewYear((y) => y + 1);
                  } else {
                    setViewMonth(m);
                  }
                }}
                aria-label="Sonraki ay"
              >
                ›
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 mt-3 text-xs text-slate-500">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((x) => (
                <div key={x} className="text-center py-1">
                  {x}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 mt-1">
              {Array.from({ length: mondayIndex }).map((_, i) => (
                <div key={`e-${i}`} className="h-9" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const isSelected = selectedY === viewYear && selectedM === viewMonth && selectedDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDatePreserveTime(viewYear, viewMonth, day)}
                    className={`h-9 rounded-xl text-sm hover:bg-slate-100 ${
                      isSelected ? "bg-slate-900 text-white hover:bg-slate-900" : "text-slate-900"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Saat</div>
                <Select value={String(hours)} onValueChange={(v) => setTimePreserveDate(Number(v), minutes)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hoursOptions.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {pad2(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Dakika</div>
                <Select
                  value={String(minutes - (minutes % 5))}
                  onValueChange={(v) => setTimePreserveDate(hours, Number(v))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {pad2(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                Kapat
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** ========= ActiveTimer Component (Performance Optimization) ========= */
const ActiveTimer = React.memo(
  ({
    running,
    onStop,
    onPause,
    onResume,
    categoryMap,
    themeColor,
  }: {
    running: Running;
    onStop: () => void;
    onPause: () => void;
    onResume: () => void;
    categoryMap: Map<string, Category>;
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
              <div>
                <h3 className="text-sm font-medium text-white/80 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">
                    {categoryMap.get(running.categoryId)?.name ?? running.categoryId}
                  </span>
                  {running.label ? (
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white border-0">
                      {running.label}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white border-0">
                      (etiketsiz)
                    </Badge>
                  )}
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

/** ========= Session Dialog (Manual Add / Edit) ========= */
const SessionDialog = ({
  isOpen,
  onOpenChange,
  initialData,
  categories,
  sessions,
  onSave,
  toast,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: Session | null;
  categories: Category[];
  sessions: Session[];
  onSave: (s: Partial<Session>) => void;
  toast: (type: ToastType, message: string, title?: string) => void;
}) => {
  const [formData, setFormData] = useState({
    categoryId: "",
    label: "",
    startMs: Date.now(),
    endMs: Date.now(),
  });

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      setFormData({
        categoryId: initialData.categoryId,
        label: initialData.label,
        startMs: initialData.start,
        endMs: initialData.end,
      });
    } else {
      const now = Date.now();
      setFormData({
        categoryId: categories[0]?.id || "",
        label: "",
        startMs: now - 3600000,
        endMs: now,
      });
    }
  }, [isOpen, initialData, categories]);

  const suggestedLabels = useMemo(() => {
    if (!formData.categoryId) return [];
    return getUniqueLabelsForCategory(sessions, formData.categoryId);
  }, [sessions, formData.categoryId]);

  const selectedCategory = categories.find((c) => c.id === formData.categoryId);
  const placeholder = getCategoryPlaceholder(formData.categoryId, selectedCategory?.name);

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
      label: formData.label,
      start,
      end,
    });

    toast("success", initialData ? "Kayıt güncellendi." : "Kayıt eklendi.");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? "Kaydı Düzenle" : "Manuel Kayıt Ekle"}</DialogTitle>
          <ShadcnDialogDescription>
            {initialData ? "Mevcut çalışma kaydını güncelle." : "Geçmişe dönük bir çalışma kaydı oluştur."}
          </ShadcnDialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Kategori</Label>
            <Select value={formData.categoryId} onValueChange={(v) => setFormData({ ...formData, categoryId: v })}>
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
            <Label className="text-right">Etiket</Label>
            <div className="col-span-3">
              <Input
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
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

          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Başlangıç</Label>
            <MiniDateTimePicker
              valueMs={formData.startMs}
              onChange={(ms) => setFormData((p) => ({ ...p, startMs: ms }))}
              label="Tarih seç + saat/dakika ayarla"
            />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Bitiş</Label>
            <MiniDateTimePicker
              valueMs={formData.endMs}
              onChange={(ms) => setFormData((p) => ({ ...p, endMs: ms }))}
              label="Tarih seç + saat/dakika ayarla"
            />
          </div>

          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Hızlı düzenleme</Label>
            <div className="col-span-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setFormData((p) => ({ ...p, startMs: p.startMs - 15 * 60000 }))}
              >
                -15dk
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setFormData((p) => ({ ...p, endMs: p.endMs + 15 * 60000 }))}
              >
                +15dk
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  const now = Date.now();
                  setFormData((p) => ({ ...p, endMs: now }));
                }}
              >
                Bitiş: şimdi
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} type="button">
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function Page() {
  /** ========= Toast state ========= */
  const toastActionsRef = useRef<Map<string, () => void>>(new Map());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const handleToastAction = useCallback(
    (actionId: string) => {
      const fn = toastActionsRef.current.get(actionId);
      if (fn) fn();
    },
    [toastActionsRef]
  );

  const toast = useCallback(
    (type: ToastType, message: string, title?: string, action?: { label: string; onClick: () => void }) => {
      const id = uid();
      const actionId = action ? uid() : undefined;

      if (actionId && action) {
        toastActionsRef.current.set(actionId, action.onClick);
      }

      setToasts((prev) => [{ id, type, message, title, actionLabel: action?.label, actionId }, ...prev].slice(0, 4));

      // auto close (action'lı toast biraz daha uzun)
      const ttl = action ? 6000 : 3200;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
        if (actionId) toastActionsRef.current.delete(actionId);
      }, ttl);
    },
    []
  );

  // --- Persistent local state ---
  const [categories, setCategories, catsHydrated] = usePersistentState<Category[]>(LS_CATEGORIES, DEFAULT_CATEGORIES);
  const [sessions, setSessions, sessionsHydrated] = usePersistentState<Session[]>(LS_SESSIONS, []);
  const [dailyTarget, setDailyTarget] = usePersistentState<number>(LS_TARGET, 2);
  const [localUpdatedAt, setLocalUpdatedAt] = usePersistentState<number>(LS_UPDATED_AT, 0);

  // --- Runtime state ---
  const [running, setRunning] = useState<Running | null>(null);

  // Update every minute for relative times/charts
  const [nowForCalculations, setNowForCalculations] = useState(Date.now());

  // Quick start
  const [quickCat, setQuickCat] = useState<string>("");
  const [quickLabel, setQuickLabel] = useState("");

  // List filters
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Pagination
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);

  // Mobile start sheet
  const [mobileStartOpen, setMobileStartOpen] = useState(false);

  // Dialogs
  const [resetOpen, setResetOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  // Confirm dialogs
  const [confirmDeleteSessionId, setConfirmDeleteSessionId] = useState<string | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);

  // Category Management State
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");

  // Undo buffers
  const undoSessionRef = useRef<{ item: Session; timer: number } | null>(null);
  const undoCategoryRef = useRef<{ item: Category; timer: number } | null>(null);

  // --- Cloud state ---
  const [user, setUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(supabase ? "signed_out" : "disabled");
  const [cloudMsg, setCloudMsg] = useState<string>(supabase ? "Bulut hazır" : "Bulut kapalı (ENV yok)");
  const [authEmail, setAuthEmail] = useState("");

  const isHydratingFromCloud = useRef(false);
  const saveDebounceRef = useRef<number | null>(null);

  // Keep latest snapshot in ref
  const stateRef = useRef({ categories, sessions, dailyTarget, localUpdatedAt });
  useEffect(() => {
    stateRef.current = { categories, sessions, dailyTarget, localUpdatedAt };
  }, [categories, sessions, dailyTarget, localUpdatedAt]);

  // --- MIGRATION: Fix legacy Tailwind colors ---
  useEffect(() => {
    if (!catsHydrated) return;

    const needsFix = categories.some((c) => !c.color || !c.color.startsWith("#"));

    if (needsFix) {
      const fixedCategories = categories.map((c) => {
        if (!c.color || !c.color.startsWith("#")) {
          const newColor = OLD_COLOR_MAP[c.color] || getRandomBrightColor();
          return { ...c, color: newColor };
        }
        return c;
      });
      setCategories(fixedCategories);
      setLocalUpdatedAt(Date.now());
    }
  }, [catsHydrated, categories, setCategories, setLocalUpdatedAt]);

  // Update `nowForCalculations` every minute
  useEffect(() => {
    const t = window.setInterval(() => setNowForCalculations(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, []);

  // Ensure quickCat always valid
  useEffect(() => {
    const first = categories[0]?.id;
    if (!first) return;
    if (!quickCat) setQuickCat(first);
    else if (!categories.find((c) => c.id === quickCat)) setQuickCat(first);
  }, [categories, quickCat]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const getCatHex = useCallback(
    (catId: string) => {
      const cat = categories.find((c) => c.id === catId);
      return cat ? cat.color : "#64748b";
    },
    [categories]
  );

  /** Stack keys with stable visual hierarchy */
  const stackKeys = useMemo(() => categories.map((c) => c.id), [categories]);

  const theme = useMemo(() => {
    const activeCat = running?.categoryId || quickCat || categories[0]?.id || "other";
    const hex = getCatHex(activeCat);
    const cat = categoryMap.get(activeCat);
    const name = cat?.name ?? "Çalışma";
    return { activeCat, hex, name };
  }, [running?.categoryId, quickCat, categories, categoryMap, getCatHex]);

  // Suggested labels for Quick Start
  const quickStartSuggestions = useMemo(() => {
    if (!quickCat) return [];
    return getUniqueLabelsForCategory(sessions, quickCat);
  }, [sessions, quickCat]);

  const quickStartPlaceholder = useMemo(() => {
    const cat = categoryMap.get(quickCat);
    return getCategoryPlaceholder(quickCat, cat?.name);
  }, [quickCat, categoryMap]);

  // Custom Legend
  const renderLegend = useCallback(() => {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        {categories.map((c) => (
          <div key={c.id} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
            <span className="text-slate-700 dark:text-slate-200">{c.name}</span>
          </div>
        ))}
      </div>
    );
  }, [categories]);

  /** ========= Running persistence (refresh sonrası devam) ========= */
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

  /** ========= Pause/Resume runtime helpers ========= */
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
    const catId = quickCat || categories[0]?.id;
    if (!catId) return;

    const now = Date.now();
    const next: Running = {
      categoryId: catId,
      label: quickLabel.trim(),
      wallStart: now,
      lastStart: now,
      elapsedActiveMs: 0,
      isPaused: false,
    };

    setRunning(next);
    setMobileStartOpen(false);
  }, [running, quickCat, categories, quickLabel]);

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
      label: running.label,
      start: wallStart,
      end: now,
      pausedMs,
    };

    setSessions((prev) => [newSession, ...prev]);
    setLocalUpdatedAt(Date.now());
    setRunning(null);
    setQuickLabel("");
    toast("success", "Kayıt kaydedildi.");
  }, [running, currentActiveMs, setSessions, setLocalUpdatedAt, toast]);

  /** ========= Undo helpers ========= */
  const scheduleUndoSession = useCallback(
    (deleted: Session) => {
      if (undoSessionRef.current) {
        window.clearTimeout(undoSessionRef.current.timer);
        undoSessionRef.current = null;
      }

      const timer = window.setTimeout(() => {
        undoSessionRef.current = null;
      }, 7000);

      undoSessionRef.current = { item: deleted, timer };

      toast("info", "Kayıt silindi.", undefined, {
        label: "Geri al",
        onClick: () => {
          const cur = undoSessionRef.current?.item;
          if (!cur) return;

          setSessions((prev) => {
            const next = [cur, ...prev].sort((a, b) => b.start - a.start);
            return next;
          });
          setLocalUpdatedAt(Date.now());

          if (undoSessionRef.current) {
            window.clearTimeout(undoSessionRef.current.timer);
            undoSessionRef.current = null;
          }

          toast("success", "Kayıt geri alındı.");
        },
      });
    },
    [setSessions, setLocalUpdatedAt, toast]
  );

  const scheduleUndoCategory = useCallback(
    (deleted: Category) => {
      if (undoCategoryRef.current) {
        window.clearTimeout(undoCategoryRef.current.timer);
        undoCategoryRef.current = null;
      }

      const timer = window.setTimeout(() => {
        undoCategoryRef.current = null;
      }, 7000);

      undoCategoryRef.current = { item: deleted, timer };

      toast("info", "Kategori silindi.", undefined, {
        label: "Geri al",
        onClick: () => {
          const cur = undoCategoryRef.current?.item;
          if (!cur) return;

          setCategories((prev) => {
            if (prev.some((c) => c.id === cur.id)) return prev;
            return [...prev, cur];
          });
          setLocalUpdatedAt(Date.now());

          if (undoCategoryRef.current) {
            window.clearTimeout(undoCategoryRef.current.timer);
            undoCategoryRef.current = null;
          }

          toast("success", "Kategori geri alındı.");
        },
      });
    },
    [setCategories, setLocalUpdatedAt, toast]
  );

  const openDeleteSession = useCallback((id: string) => setConfirmDeleteSessionId(id), []);
  const openDeleteCategory = useCallback((id: string) => setConfirmDeleteCategoryId(id), []);

  const deleteSessionConfirmed = useCallback(() => {
    if (!confirmDeleteSessionId) return;

    const deleted = sessions.find((s) => s.id === confirmDeleteSessionId);
    setSessions((prev) => prev.filter((s) => s.id !== confirmDeleteSessionId));
    setLocalUpdatedAt(Date.now());

    if (deleted) scheduleUndoSession(deleted);
    else toast("success", "Kayıt silindi.");
  }, [confirmDeleteSessionId, sessions, setSessions, setLocalUpdatedAt, scheduleUndoSession, toast]);

  /** ========= CRUD Operations ========= */
  const handleSessionSave = (data: Partial<Session>) => {
    if (data.id) {
      setSessions((prev) => prev.map((s) => (s.id === data.id ? ({ ...s, ...data } as Session) : s)));
      setLocalUpdatedAt(Date.now());
      return;
    }

    const newSession: Session = {
      id: uid(),
      categoryId: data.categoryId!,
      label: data.label || "",
      start: data.start!,
      end: data.end!,
      pausedMs: 0,
    };

    setSessions((prev) => [newSession, ...prev]);
    setLocalUpdatedAt(Date.now());
  };

  const openEditDialog = (session: Session) => {
    setEditingSession(session);
    setSessionDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSession(null);
    setSessionDialogOpen(true);
  };

  /** ========= Category Management ========= */
  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newId = `cat_${Date.now()}`;
    const newCat: Category = {
      id: newId,
      name: newCatName.trim(),
      color: newCatColor,
    };
    setCategories((prev) => [...prev, newCat]);
    setNewCatName("");
    setLocalUpdatedAt(Date.now());
    toast("success", "Kategori eklendi.");
  };

  const deleteCategoryConfirmed = useCallback(() => {
    if (!confirmDeleteCategoryId) return;
    if (categories.length <= 1) {
      toast("error", "En az bir kategori kalmalı.");
      return;
    }

    const deleted = categories.find((c) => c.id === confirmDeleteCategoryId);

    setCategories((prev) => prev.filter((c) => c.id !== confirmDeleteCategoryId));
    setLocalUpdatedAt(Date.now());

    if (deleted) scheduleUndoCategory(deleted);
    else toast("success", "Kategori silindi.");
  }, [confirmDeleteCategoryId, categories, setCategories, setLocalUpdatedAt, scheduleUndoCategory, toast]);

  const updateCategory = (id: string, field: keyof Category, value: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    setLocalUpdatedAt(Date.now());
  };

  /** ========= Cloud sync functions ========= */
  const pushToCloud = useCallback(
    async (u: User, label?: string) => {
      if (!supabase) return;
      setCloudStatus("syncing");
      setCloudMsg(label ? `Senkronlanıyor (${label})...` : "Senkronlanıyor...");

      const { categories, sessions, dailyTarget } = stateRef.current;
      const snapshot: Snapshot = { categories, sessions, dailyTarget };
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("user_data")
        .upsert({ user_id: u.id, data: snapshot, updated_at: nowIso }, { onConflict: "user_id" });

      if (error) {
        setCloudStatus("error");
        setCloudMsg(error.message || "Yükleme hatası");
        return;
      }

      // kritik: localUpdatedAt'i de ilerlet
      const ms = Date.parse(nowIso);
      setLocalUpdatedAt(ms);

      setCloudStatus("signed_in");
      setCloudMsg(label ? `Senkronlandı (${label})` : "Senkronlandı");
    },
    [setLocalUpdatedAt]
  );

  const loadFromCloud = useCallback(
    async (u: User) => {
      if (!supabase) return;
      setCloudStatus("syncing");
      setCloudMsg("Veriler çekiliyor...");

      const { data, error } = await supabase
        .from("user_data")
        .select("data, updated_at")
        .eq("user_id", u.id)
        .maybeSingle();

      if (error) {
        setCloudStatus("error");
        setCloudMsg(error.message || "Veri çekme hatası");
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
        setCategories(snap.categories?.length ? snap.categories : DEFAULT_CATEGORIES);
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
    [pushToCloud, setCategories, setSessions, setDailyTarget, setLocalUpdatedAt, toast]
  );

  // Auth init + listener
  useEffect(() => {
    if (!supabase) return;
    if (!catsHydrated || !sessionsHydrated) return;

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
  }, [catsHydrated, sessionsHydrated, loadFromCloud]);

  // Auto save to cloud
  useEffect(() => {
    if (!supabase || !user) return;
    if (!catsHydrated || !sessionsHydrated) return;
    if (isHydratingFromCloud.current) return;

    if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = window.setTimeout(() => {
      pushToCloud(user);
    }, 1800);

    return () => {
      if (saveDebounceRef.current) window.clearTimeout(saveDebounceRef.current);
    };
  }, [categories, sessions, dailyTarget, user?.id, catsHydrated, sessionsHydrated, pushToCloud]);

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
      setCloudMsg(error.message || "Giriş hatası");
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

  /** ========= Analytics helpers (pause-aware + overlap) ========= */
  const getDailyTotalMs = useCallback(
    (dateMs: number) => {
      const start = startOfDayMs(new Date(dateMs));
      const end = start + 86400000;

      let total = 0;
      for (const s of sessions) total += overlapActiveMs(s, start, end);
      return total;
    },
    [sessions]
  );

  const getWeekTotalMs = useCallback(
    (dateMs: number) => {
      const start = startOfWeekMs(new Date(dateMs));
      const end = start + 7 * 86400000;

      let total = 0;
      for (const s of sessions) total += overlapActiveMs(s, start, end);
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

  // streak
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

  // yesterday delta
  const yesterdayDeltaMin = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = getDailyTotalMs(d.getTime());
    return Math.round((todayTotal - y) / 60000);
  }, [todayTotal, getDailyTotalMs, nowForCalculations]);

  // Charts (daily/weekly/monthly) pause-aware + overlap-based
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

      for (const s of sessions) {
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

      for (const s of sessions) {
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
      for (const s of sessions) msTotal += overlapActiveMs(s, start, end);
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

  // Category distribution (last 7 days) - overlap-based
  const categoryDistribution7d = useMemo(() => {
    const end = Date.now();
    const start = startOfDayMs(new Date(end)) - 6 * 86400000;

    const bucket = new Map<string, number>();
    for (const s of sessions) {
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

  // Top labels (last 7 days) - overlap-based
  const topLabels7d = useMemo(() => {
    const end = Date.now();
    const start = startOfDayMs(new Date(end)) - 6 * 86400000;

    const bucket = new Map<string, number>();
    for (const s of sessions) {
      const ms = overlapActiveMs(s, start, end + 1);
      if (ms <= 0) continue;
      const key = (s.label || "").trim() ? s.label.trim() : "(etiketsiz)";
      bucket.set(key, (bucket.get(key) ?? 0) + ms);
    }

    return Array.from(bucket.entries())
      .map(([label, ms]) => ({ label, ms }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5);
  }, [sessions]);

  // Filters & list view (range filter is overlap-aware)
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const nowMs = Date.now();
    const dayStart = startOfDayMs(new Date(nowMs));
    const dayEnd = dayStart + 86400000;
    const weekStart = startOfWeekMs(new Date(nowMs));
    const weekEnd = weekStart + 7 * 86400000;

    return sessions
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
        const dateStr = new Date(s.start).toLocaleDateString("tr-TR").toLowerCase();
        return catName.includes(q) || label.includes(q) || dateStr.includes(q);
      })
      .sort((a, b) => b.start - a.start);
  }, [sessions, searchQuery, rangeFilter, categoryFilter, categoryMap]);

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

  /** ========= CSV export (Excel/TR uyumlu, proper escaping) ========= */
  const escapeCsv = (v: string) => {
    const needs = /[;"\n\r]/.test(v);
    const safe = v.replace(/"/g, '""');
    return needs ? `"${safe}"` : safe;
  };

  const handleExportCSV = () => {
    const delimiter = ";";
    const headers = ["ID", "Kategori", "Etiket", "Başlangıç", "Bitiş", "Süre", "Duraklatma"];

    const rows = filteredSessions.map((s) => [
      s.id,
      categoryMap.get(s.categoryId)?.name || s.categoryId,
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

  /** ========= UI: Skeleton Loading ========= */
  if (!catsHydrated || !sessionsHydrated) {
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

  const dailyTotalHuman7d = fmtHmFromHours(chartData.dailyTotalHours);
  const weeklyTotalHuman4w = fmtHmFromHours(chartData.weeklyTotalHours);
  const monthlyTotalHuman6m = fmtHmFromHours(chartData.monthlyTotalHours);

  const lastSession = sessions[0] ?? null;

const activeFilterBadges: Array<{ key: string; label: string; onClear: () => void }> = [];

if (searchQuery.trim()) {
  activeFilterBadges.push({
    key: "q",
    label: `Arama: ${searchQuery.trim()}`,
    onClear: () => setSearchQuery(""),
  });
}

if (categoryFilter !== "all") {
  const catName = categoryMap.get(categoryFilter)?.name ?? categoryFilter;
  activeFilterBadges.push({
    key: "cat",
    label: `Kategori: ${catName}`,
    onClear: () => setCategoryFilter("all"),
  });
}

if (rangeFilter !== "all") {
  activeFilterBadges.push({
    key: "range",
    label: `Aralık: ${rangeFilter === "today" ? "Bugün" : "Bu hafta"}`,
    onClear: () => setRangeFilter("all"),
  });
}


  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <ToastViewport toasts={toasts} remove={removeToast} onAction={handleToastAction} />

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!confirmDeleteSessionId}
        onOpenChange={(o) => setConfirmDeleteSessionId(o ? confirmDeleteSessionId : null)}
        title="Kayıt silinsin mi?"
        description="İstersen silmeden önce CSV alabilirsin. Silme işleminden sonra kısa süreli “Geri al” seçeneği çıkar."
        destructive
        confirmText="Evet, sil"
        onConfirm={deleteSessionConfirmed}
      />

      <ConfirmDialog
        open={!!confirmDeleteCategoryId}
        onOpenChange={(o) => setConfirmDeleteCategoryId(o ? confirmDeleteCategoryId : null)}
        title="Kategori silinsin mi?"
        description="Kategori listeden kaldırılır. Bu kategoriye ait eski kayıtlar silinmez (listede “Silinmiş: …” gibi görünebilir)."
        destructive
        confirmText="Evet, sil"
        onConfirm={deleteCategoryConfirmed}
      />

      <div className="mx-auto max-w-5xl px-4 py-6 pb-32 sm:pb-10">
        {/* Session Dialog */}
        <SessionDialog
          isOpen={sessionDialogOpen}
          onOpenChange={setSessionDialogOpen}
          initialData={editingSession}
          categories={categories}
          sessions={sessions}
          onSave={handleSessionSave}
          toast={toast}
        />

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
                    {cloudStatus === "syncing" ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Cloud className="h-4 w-4" />
                    )}
                    {user ? "Senkronize" : "Giriş Yap"}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Bulut Senkronizasyonu</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <div className="px-2 py-1.5">
                    <Badge
                      variant="outline"
                      className={`rounded-full ${
                        cloudStatus === "error"
                          ? "border-rose-200 text-rose-600"
                          : cloudStatus === "syncing"
                          ? "border-amber-200 text-amber-700"
                          : "border-emerald-200 text-emerald-700"
                      }`}
                    >
                      {cloudStatus === "error"
                        ? "Hata"
                        : cloudStatus === "syncing"
                        ? "Senkron"
                        : user
                        ? "Bağlı"
                        : "Bağlı değil"}
                    </Badge>

                    <div className="text-[11px] text-muted-foreground mt-1">
                      {cloudStatus === "error" ? `Hata: ${cloudMsg}` : cloudMsg}
                    </div>

                    <div className="text-[11px] text-muted-foreground mt-2">
                      Son yerel güncelleme:{" "}
                      {localUpdatedAt ? new Date(localUpdatedAt).toLocaleString("tr-TR") : "-"}
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
                      <p className="text-xs text-muted-foreground">
                        Verilerini kaybetmemek ve cihazlar arası eşitlemek için giriş yap.
                      </p>
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
            <Button
              variant="outline"
              size="icon"
              onClick={handleExportCSV}
              title="CSV İndir (filtreli)"
              aria-label="CSV indir"
              type="button"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Active Timer Card */}
        <div className="mb-8">
          {!running ? (
            <Card className="border-dashed border-2 bg-slate-50/50 dark:bg-slate-900/20 shadow-none hover:bg-slate-50 transition-colors">
              <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-6">
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  {lastSession ? (
                    <div className="sm:col-span-2 -mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Son kayıt:</span>
                      <Badge variant="outline" className="rounded-full">
                        {categoryMap.get(lastSession.categoryId)?.name ?? lastSession.categoryId}
                        {lastSession.label ? ` · ${lastSession.label}` : " · (etiketsiz)"}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 px-2 rounded-lg"
                        onClick={() => {
                          setQuickCat(lastSession.categoryId);
                          setQuickLabel(lastSession.label || "");
                          // küçük gecikme ile hemen başlat
                          window.setTimeout(() => startSession(), 0);
                        }}
                      >
                        Devam et
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="h-12 px-8 flex-1 sm:flex-auto rounded-xl shadow-lg border-0 text-white"
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
                <div
                  className="h-full transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%`, backgroundColor: theme.hex }}
                />
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                {progressPercent >= 100 ? "Harika! Hedef tamam 🎉" : "Hedefe ulaşmak için devam."}
              </p>
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
            <TabsTrigger
              value="sessions"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 font-semibold"
            >
              Kayıt Geçmişi
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 font-semibold"
            >
              Analizler
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 font-semibold"
            >
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
                    placeholder="Kategori, etiket veya tarih ara..."
                    className="pl-9 rounded-xl bg-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Kayıt arama"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-10 rounded-xl w-[160px] bg-white" aria-label="Kategori filtresi">
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
                      const cat = categoryMap.get(session.categoryId);
                      const leftColor = getCatHex(session.categoryId);
                      const durationMs = sessionDurationMs(session);
                      const pausedMs = session.pausedMs ?? 0;

                      const catName = cat?.name ?? `Silinmiş: ${session.categoryId}`;

                      return (
                        <div
                          key={session.id}
                          className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-slate-200 dark:hover:border-slate-800"
                          style={{ borderLeftWidth: 4, borderLeftColor: leftColor }}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0"
                              style={{ backgroundColor: leftColor }}
                            >
                              {catName.substring(0, 2).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {catName}
                                <span className="ml-2">
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
                                  {new Date(session.start).toLocaleDateString("tr-TR", {
                                    weekday: "short",
                                    day: "numeric",
                                    month: "short",
                                  })}
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
                            <div className="hidden sm:block font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {fmtCompact(durationMs)}
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-xl"
                                  aria-label="Kayıt işlemleri menüsü"
                                  type="button"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(session)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => openDeleteSession(session.id)}>
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
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        type="button"
                      >
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

          {/* Analytics */}
          <TabsContent value="analytics" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Category distribution */}
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
                            <Tooltip
                              formatter={(v: any, _n: any, p: any) => [
                                fmtHmFromHours(Number(v) || 0),
                                p?.payload?.name ?? "",
                              ]}
                            />
                            <Legend verticalAlign="bottom" height={40} />
                            <Pie
                              data={categoryDistribution7d.rows}
                              dataKey="hours"
                              nameKey="name"
                              innerRadius={55}
                              outerRadius={80}
                              paddingAngle={3}
                              stroke="transparent"
                            >
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

              {/* Top labels */}
              <Card className="shadow-sm md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Son 7 Gün · En çok etiket
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topLabels7d.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-10 text-center">Henüz veri yok</div>
                  ) : (
                    <div className="space-y-3">
                      {topLabels7d.map((x) => (
                        <div key={x.label} className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{x.label}</div>
                            <div className="text-xs text-muted-foreground">Son 7 günde toplam</div>
                          </div>
                          <Badge variant="outline" className="rounded-full">
                            {fmtHmFromMs(x.ms)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="daily" className="w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" style={{ color: theme.hex }} />
                    Performans Analizi
                  </h3>
                  <p className="text-sm text-muted-foreground">Çalışma sürelerinin zaman içindeki dağılımı.</p>
                </div>
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <TabsTrigger value="daily" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Günlük
                  </TabsTrigger>
                  <TabsTrigger value="weekly" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Haftalık
                  </TabsTrigger>
                  <TabsTrigger value="monthly" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Aylık
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* DAILY */}
              <TabsContent value="daily" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="md:col-span-3 shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Son 7 Gün (Kategori Dağılımı)</CardTitle>
                    </CardHeader>
                    <CardContent>
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
                    </CardContent>
                  </Card>

                  <Card className="flex flex-col justify-center items-center text-center p-6 shadow-none border" style={{ backgroundColor: `${theme.hex}15`, borderColor: `${theme.hex}30` }}>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${theme.hex}25`, color: theme.hex }}>
                      <CalendarIcon className="h-6 w-6" />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: theme.hex }}>
                      {dailyTotalHuman7d}
                    </div>
                    <div className="text-sm font-medium" style={{ color: theme.hex }}>
                      Toplam (7 Gün)
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">Günlük Ort: {fmtHmFromHours(chartData.dailyTotalHours / 7)}</div>
                  </Card>
                </div>
              </TabsContent>

              {/* WEEKLY */}
              <TabsContent value="weekly" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="md:col-span-3 shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Son 4 Hafta (Kategori Dağılımı)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[330px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.weekly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barCategoryGap={18} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: any, name: any) => [fmtHmFromHours(Number(v) || 0), categoryMap.get(name)?.name ?? name]} />
                            <Legend verticalAlign="bottom" content={renderLegend} />
                            {stackKeys.map((id) => (
                              <Bar key={id} dataKey={id} stackId="a" fill={getCatHex(id)} barSize={40} radius={0} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="flex flex-col justify-center items-center text-center p-6 shadow-none border" style={{ backgroundColor: `${theme.hex}15`, borderColor: `${theme.hex}30` }}>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${theme.hex}25`, color: theme.hex }}>
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: theme.hex }}>
                      {weeklyTotalHuman4w}
                    </div>
                    <div className="text-sm font-medium" style={{ color: theme.hex }}>
                      Toplam (4 Hafta)
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">Haftalık Ort: {fmtHmFromHours(chartData.weeklyTotalHours / 4)}</div>
                  </Card>
                </div>
              </TabsContent>

              {/* MONTHLY */}
              <TabsContent value="monthly" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="md:col-span-3 shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Son 6 Ay</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
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

                  <Card className="flex flex-col justify-center items-center text-center p-6 shadow-none border" style={{ backgroundColor: `${theme.hex}15`, borderColor: `${theme.hex}30` }}>
                    <div className="h-12 w-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: `${theme.hex}25`, color: theme.hex }}>
                      <PieChartIcon className="h-6 w-6" />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: theme.hex }}>
                      {monthlyTotalHuman6m}
                    </div>
                    <div className="text-sm font-medium" style={{ color: theme.hex }}>
                      Toplam (6 Ay)
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Management */}
              <Card className="shadow-sm md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Kategoriler</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {categories.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                        <Input
                          type="color"
                          className="w-8 h-8 p-0 border-0 rounded-full cursor-pointer shrink-0"
                          value={c.color}
                          onChange={(e) => updateCategory(c.id, "color", e.target.value)}
                          aria-label={`${c.name} renk`}
                        />
                        <Input
                          value={c.name}
                          onChange={(e) => updateCategory(c.id, "name", e.target.value)}
                          className="h-8 text-sm"
                          aria-label={`${c.name} ad`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-500"
                          onClick={() => openDeleteCategory(c.id)}
                          title="Sil"
                          aria-label="Kategori sil"
                          type="button"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-end gap-4 p-4 bg-slate-50 rounded-xl border border-dashed">
                    <div className="space-y-1 flex-1">
                      <Label>Yeni Kategori Adı</Label>
                      <Input placeholder="Örn: Yazılım" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Renk</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={newCatColor}
                          onChange={(e) => setNewCatColor(e.target.value)}
                          className="w-10 h-10 p-1 rounded-lg cursor-pointer"
                          aria-label="Yeni kategori renk"
                        />
                      </div>
                    </div>
                    <Button onClick={addCategory} disabled={!newCatName.trim()} type="button">
                      <Plus className="mr-2 h-4 w-4" /> Ekle
                    </Button>
                  </div>
                </CardContent>
              </Card>

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

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Veri & Dışa Aktarım</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start" onClick={handleExportCSV} type="button">
                    <Download className="mr-2 h-4 w-4" /> Filtreli kayıtları CSV indir
                  </Button>

                  <Separator />

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Sıfırlama</div>

                    <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full justify-start" type="button">
                          <Trash2 className="mr-2 h-4 w-4" /> Tüm kayıtları sil
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Tüm kayıtlar silinsin mi?</DialogTitle>
                          <ShadcnDialogDescription>
                            Bu işlem geri alınamaz. Tüm çalışma kayıtları kalıcı olarak silinir.
                          </ShadcnDialogDescription>
                        </DialogHeader>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setResetOpen(false)} type="button">
                            Vazgeç
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setSessions([]);
                              setLocalUpdatedAt(Date.now());
                              setResetOpen(false);
                              toast("success", "Tüm kayıtlar silindi.");
                            }}
                            type="button"
                          >
                            Evet, sil
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
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

      {/* Mobile Start FAB + Bottom Sheet */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        {!running && (
          <Dialog open={mobileStartOpen} onOpenChange={setMobileStartOpen}>
            <DialogTrigger asChild>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full shadow-xl border-0 text-white"
                style={{ backgroundColor: theme.hex }}
                aria-label="Hızlı başlat"
                type="button"
              >
                <Play className="h-6 w-6 text-white" />
              </Button>
            </DialogTrigger>

            <DialogContent className="fixed bottom-0 left-0 right-0 translate-y-0 top-auto rounded-t-2xl p-4">
              <DialogHeader>
                <DialogTitle>Hızlı Başlat</DialogTitle>
                <ShadcnDialogDescription>Kategori seç, istersen etiket ekle ve başlat.</ShadcnDialogDescription>
              </DialogHeader>

              <div className="grid gap-4 mt-2">
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

                <Button
                  size="lg"
                  className="h-12 rounded-xl shadow-lg border-0 text-white"
                  style={{ backgroundColor: theme.hex }}
                  onClick={startSession}
                  type="button"
                >
                  <Play className="mr-2 h-5 w-5 fill-current" /> Başlat
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
         <footer className="mt-10 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-900 dark:text-slate-100">🤍D🩵</span>{" "}
              <span className="text-rose-500">{}</span>
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
