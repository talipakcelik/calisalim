"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Palette,
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
type Session = { id: string; categoryId: string; label: string; start: number; end: number };
type Running = { categoryId: string; label: string; start: number };
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
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981", 
    "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e"
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
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/** ========= Storage keys ========= */
const LS_CATEGORIES = "talip-v2.categories";
const LS_SESSIONS = "talip-v2.sessions";
const LS_TARGET = "talip-v2.target";
const LS_UPDATED_AT = "talip-v2.updatedAt";

// --- ActiveTimer Component (Performance Optimization) ---
// This component handles its own interval, so the main page doesn't re-render every second.
const ActiveTimer = ({
  running,
  onStop,
  categoryMap,
  themeColor,
}: {
  running: Running;
  onStop: () => void;
  categoryMap: Map<string, Category>;
  themeColor: string;
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="text-white border-none shadow-xl relative overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${themeColor} 0%, rgba(15, 23, 42, 1) 70%)`,
        }}
      />
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
      <CardContent className="flex flex-col sm:flex-row items-center justify-between py-8 gap-6 relative z-10">
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
              <span className="text-xs text-white/60">• Başlangıç: {fmtTime(running.start)}</span>
            </h3>
            <div className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight mt-1 font-mono">
              {fmtDuration(now - running.start)}
            </div>
          </div>
        </div>

        <Button
          variant="destructive"
          size="lg"
          className="h-14 px-8 rounded-xl bg-white/10 hover:bg-white/15 text-white shadow-lg border border-white/10"
          onClick={onStop}
        >
          <Square className="mr-2 h-5 w-5 fill-current" /> Durdur & Kaydet
        </Button>
      </CardContent>
    </Card>
  );
};

// --- Session Dialog (Manual Add / Edit) ---
const SessionDialog = ({
  isOpen,
  onOpenChange,
  initialData,
  categories,
  onSave,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  initialData?: Session | null;
  categories: Category[];
  onSave: (s: Partial<Session>) => void;
}) => {
  const [formData, setFormData] = useState({
    categoryId: "",
    label: "",
    startStr: "",
    endStr: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit mode
        setFormData({
          categoryId: initialData.categoryId,
          label: initialData.label,
          startStr: toInputDateTime(initialData.start),
          endStr: toInputDateTime(initialData.end),
        });
      } else {
        // Create mode (default: now - 1 hour to now)
        const now = Date.now();
        setFormData({
          categoryId: categories[0]?.id || "",
          label: "",
          startStr: toInputDateTime(now - 3600000),
          endStr: toInputDateTime(now),
        });
      }
    }
  }, [isOpen, initialData, categories]);

  const handleSave = () => {
    const start = new Date(formData.startStr).getTime();
    const end = new Date(formData.endStr).getTime();

    if (isNaN(start) || isNaN(end)) {
      alert("Lütfen geçerli bir tarih seçin.");
      return;
    }
    if (end <= start) {
      alert("Bitiş zamanı başlangıçtan sonra olmalıdır.");
      return;
    }

    onSave({
      id: initialData?.id, // Keep ID if editing
      categoryId: formData.categoryId,
      label: formData.label,
      start,
      end,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? "Kaydı Düzenle" : "Manuel Kayıt Ekle"}</DialogTitle>
          <DialogDescription>
            {initialData ? "Mevcut çalışma kaydını güncelle." : "Geçmişe dönük bir çalışma kaydı oluştur."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Kategori</Label>
            <Select
              value={formData.categoryId}
              onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
            >
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
            <Input
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="col-span-3"
              placeholder="Opsiyonel"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Başlangıç</Label>
            <Input
              type="datetime-local"
              value={formData.startStr}
              onChange={(e) => setFormData({ ...formData, startStr: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Bitiş</Label>
            <Input
              type="datetime-local"
              value={formData.endStr}
              onChange={(e) => setFormData({ ...formData, endStr: e.target.value })}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function Page() {
  // --- Persistent local state ---
  const [categories, setCategories, catsHydrated] = usePersistentState<Category[]>(
    LS_CATEGORIES,
    DEFAULT_CATEGORIES
  );
  const [sessions, setSessions, sessionsHydrated] = usePersistentState<Session[]>(LS_SESSIONS, []);
  const [dailyTarget, setDailyTarget] = usePersistentState<number>(LS_TARGET, 2);
  const [localUpdatedAt, setLocalUpdatedAt] = usePersistentState<number>(LS_UPDATED_AT, 0);

  // --- Runtime state ---
  const [running, setRunning] = useState<Running | null>(null);
  
  // NOTE: `now` removed from main component to prevent global re-renders. 
  // It is now encapsulated in ActiveTimer or calculated on demand where needed (like charts, slightly less precise live updates for charts but better perf).
  // For charts, we will use a less frequent update or just initial render time.
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

  // Category Management State
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#3b82f6");

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
        // Renk bozuksa veya hex değilse (örn. "bg-blue-500")
        if (!c.color || !c.color.startsWith("#")) {
          // Eski haritadan bak, yoksa rastgele canlı bir renk ata
          const newColor = OLD_COLOR_MAP[c.color] || getRandomBrightColor();
          return { ...c, color: newColor };
        }
        return c;
      });
      setCategories(fixedCategories);
      setLocalUpdatedAt(Date.now());
    }
  }, [catsHydrated, categories, setCategories, setLocalUpdatedAt]);

  // Update `nowForCalculations` every minute for relative times/charts, instead of every second
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
  const getCatHex = useCallback((catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.color : "#64748b";
  }, [categories]);

  /** Stack keys with stable visual hierarchy */
  const stackKeys = useMemo(() => {
    return categories.map(c => c.id);
  }, [categories]);

  const theme = useMemo(() => {
    const activeCat = running?.categoryId || quickCat || categories[0]?.id || "other";
    const hex = getCatHex(activeCat);
    const cat = categoryMap.get(activeCat);
    const name = cat?.name ?? "Çalışma";
    return { activeCat, hex, name };
  }, [running?.categoryId, quickCat, categories, categoryMap, getCatHex]);

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

  // --- Session controls ---
  const startSession = useCallback(() => {
    if (running) return;
    const catId = quickCat || categories[0]?.id;
    if (!catId) return;
    setRunning({ categoryId: catId, label: quickLabel.trim(), start: Date.now() });
    setMobileStartOpen(false);
  }, [running, quickCat, categories, quickLabel]);

  const stopSession = useCallback(() => {
    if (!running) return;
    const newSession: Session = {
      id: uid(),
      categoryId: running.categoryId,
      label: running.label,
      start: running.start,
      end: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setLocalUpdatedAt(Date.now());
    setRunning(null);
    setQuickLabel("");
  }, [running]);

  const deleteSession = useCallback((id: string) => {
    if (!confirm("Bu kayıt kalıcı olarak silinsin mi?")) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setLocalUpdatedAt(Date.now());
  }, []);

  // --- CRUD Operations ---
  const handleSessionSave = (data: Partial<Session>) => {
    if (data.id) {
      // Edit existing
      setSessions((prev) =>
        prev.map((s) => (s.id === data.id ? { ...s, ...data } as Session : s))
      );
    } else {
      // Create new
      const newSession: Session = {
        id: uid(),
        categoryId: data.categoryId!,
        label: data.label || "",
        start: data.start!,
        end: data.end!,
      };
      setSessions((prev) => [newSession, ...prev]);
    }
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

  // --- Category Management ---
  const addCategory = () => {
    if (!newCatName.trim()) return;
    const newId = `cat_${Date.now()}`;
    const newCat: Category = {
      id: newId,
      name: newCatName.trim(),
      color: newCatColor,
    };
    setCategories(prev => [...prev, newCat]);
    setNewCatName("");
    setLocalUpdatedAt(Date.now());
  };

  const deleteCategory = (id: string) => {
    if (categories.length <= 1) {
      alert("En az bir kategori kalmalı.");
      return;
    }
    if(!confirm("Bu kategoriyi silmek istediğine emin misin? Bu kategoriye ait kayıtlar silinmez ancak 'Bilinmeyen' olarak görünebilir.")) return;
    setCategories(prev => prev.filter(c => c.id !== id));
    setLocalUpdatedAt(Date.now());
  };

  const updateCategory = (id: string, field: keyof Category, value: string) => {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
      setLocalUpdatedAt(Date.now());
  };

  // --- Cloud sync functions ---
  const pushToCloud = useCallback(async (u: User, label?: string) => {
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
    setCloudStatus("signed_in");
    setCloudMsg(label ? `Senkronlandı (${label})` : "Senkronlandı");
  }, []);

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
        return;
      }

      if ((localUpdatedAt || 0) >= remoteMs) {
        await pushToCloud(u, "Yerel daha yeni");
      } else {
        setCloudStatus("signed_in");
        setCloudMsg("Senkronize");
      }
    },
    [pushToCloud]
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
      return;
    }

    setCloudStatus("signed_out");
    setCloudMsg("E-postanı kontrol et: giriş linki gönderildi");
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setCloudStatus("signed_out");
    setCloudMsg("Çıkış yapıldı");
  };

  // --- Analytics helpers (ms-based) ---
  const getDailyTotalMs = useCallback(
    (dateMs: number) => {
      const start = startOfDayMs(new Date(dateMs));
      const end = start + 86400000;
      return sessions
        .filter((s) => s.start >= start && s.start < end)
        .reduce((acc, s) => acc + (s.end - s.start), 0);
    },
    [sessions]
  );

  const getWeekTotalMs = useCallback(
    (dateMs: number) => {
      const start = startOfWeekMs(new Date(dateMs));
      const end = start + 7 * 86400000;
      return sessions
        .filter((s) => s.start >= start && s.start < end)
        .reduce((acc, s) => acc + (s.end - s.start), 0);
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

  // Charts (daily/weekly/monthly)
  const chartData = useMemo(() => {
    const sumHoursByCategory = (sess: Session[]) => {
      const byCat: Record<string, number> = {};
      for (const k of stackKeys) byCat[k] = 0;

      for (const s of sess) {
        const k = s.categoryId;
        if (!(k in byCat)) byCat[k] = 0;
        byCat[k] += (s.end - s.start) / 3600000;
      }

      // keep 1-decimal for chart smoothness
      for (const k of Object.keys(byCat)) byCat[k] = Number(byCat[k].toFixed(1));
      return byCat;
    };

    // 1) Daily last 7
    const daily: Array<any> = [];
    let dailyTotalHours = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const start = d.getTime();
      const end = start + 86400000;
      const daySessions = sessions.filter((s) => s.start >= start && s.start < end);

      const byCat = sumHoursByCategory(daySessions);
      const totalHrs = Object.values(byCat).reduce((a, b) => a + b, 0);
      dailyTotalHours += totalHrs;

      daily.push({
        name: d.toLocaleDateString("tr-TR", { weekday: "short" }),
        fullDate: d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" }),
        ...byCat,
        total: Number(totalHrs.toFixed(1)),
      });
    }

    // 2) Weekly last 4
    const weekly: Array<any> = [];
    let weeklyTotalHours = 0;

    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);

      const start = startOfWeekMs(d);
      const end = start + 7 * 86400000;

      const weekSessions = sessions.filter((s) => s.start >= start && s.start < end);

      const byCat = sumHoursByCategory(weekSessions);
      const totalHrs = Object.values(byCat).reduce((a, b) => a + b, 0);
      weeklyTotalHours += totalHrs;

      const monday = new Date(start);
      weekly.push({
        name: `${monday.getDate()} ${monday.toLocaleDateString("tr-TR", { month: "short" })}`,
        ...byCat,
        total: Number(totalHrs.toFixed(1)),
      });
    }

    // 3) Monthly last 6 (total hours)
    const monthly: Array<{ name: string; saat: number }> = [];
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

      const monthSessions = sessions.filter((s) => s.start >= start && s.start < end);
      const hrs = monthSessions.reduce((acc, s) => acc + (s.end - s.start), 0) / 3600000;
      monthlyTotalHours += hrs;

      monthly.push({
        name: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
        saat: Number(hrs.toFixed(1)),
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

  // Category distribution (last 7 days)
  const categoryDistribution7d = useMemo(() => {
    const end = Date.now();
    const start = startOfDayMs(new Date(end)) - 6 * 86400000;
    const bucket = new Map<string, number>();
    for (const s of sessions) {
      if (s.start < start || s.start > end) continue;
      bucket.set(s.categoryId, (bucket.get(s.categoryId) ?? 0) + (s.end - s.start));
    }

    const rows = Array.from(bucket.entries())
      .map(([categoryId, ms]) => ({
        categoryId,
        name: categoryMap.get(categoryId)?.name ?? categoryId,
        hours: ms / 3600000,
        color: getCatHex(categoryId),
      }))
      .sort((a, b) => b.hours - a.hours);

    const totalHours = rows.reduce((acc, r) => acc + r.hours, 0);
    return { rows, totalHours };
  }, [sessions, categoryMap, getCatHex]);

  // Top labels (last 7 days)
  const topLabels7d = useMemo(() => {
    const end = Date.now();
    const start = startOfDayMs(new Date(end)) - 6 * 86400000;
    const bucket = new Map<string, number>();
    for (const s of sessions) {
      if (s.start < start || s.start > end) continue;
      const key = (s.label || "").trim() ? s.label.trim() : "(etiketsiz)";
      bucket.set(key, (bucket.get(key) ?? 0) + (s.end - s.start));
    }
    return Array.from(bucket.entries())
      .map(([label, ms]) => ({ label, ms }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5);
  }, [sessions]);

  // Filters & list view
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const nowMs = Date.now();
    const dayStart = startOfDayMs(new Date(nowMs));
    const weekStart = startOfWeekMs(new Date(nowMs));

    return sessions.filter((s) => {
      if (rangeFilter === "today" && s.start < dayStart) return false;
      if (rangeFilter === "week" && s.start < weekStart) return false;

      if (categoryFilter !== "all" && s.categoryId !== categoryFilter) return false;

      if (!q) return true;
      const catName = (categoryMap.get(s.categoryId)?.name ?? s.categoryId).toLowerCase();
      const label = (s.label ?? "").toLowerCase();
      const dateStr = new Date(s.start).toLocaleDateString("tr-TR").toLowerCase();
      return catName.includes(q) || label.includes(q) || dateStr.includes(q);
    }).sort((a, b) => b.start - a.start); // Sort by date desc
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

  const handleExportCSV = () => {
    const headers = ["ID", "Kategori", "Etiket", "Başlangıç", "Bitiş", "Süre"];
    const rows = filteredSessions.map((s) => [
      s.id,
      categoryMap.get(s.categoryId)?.name || s.categoryId,
      (s.label || "").replace(/,/g, " "),
      new Date(s.start).toLocaleString("tr-TR"),
      new Date(s.end).toLocaleString("tr-TR"),
      fmtHmFromMs(s.end - s.start),
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zaman_takip_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // --- UI ---
  if (!catsHydrated || !sessionsHydrated) {
    return (
      <div className="flex h-screen items-center justify-center gap-2">
        <Loader2 className="animate-spin" /> Yükleniyor...
      </div>
    );
  }

  const dailyTotalHuman7d = fmtHmFromHours(chartData.dailyTotalHours);
  const weeklyTotalHuman4w = fmtHmFromHours(chartData.weeklyTotalHours);
  const monthlyTotalHuman6m = fmtHmFromHours(chartData.monthlyTotalHours);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-32 sm:pb-10">
        
        {/* Helper Dialogs */}
        <SessionDialog 
          isOpen={sessionDialogOpen} 
          onOpenChange={setSessionDialogOpen}
          initialData={editingSession}
          categories={categories}
          onSave={handleSessionSave}
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
                      />
                      <Button size="sm" className="w-full h-8" disabled={!supabase} onClick={handleSignIn}>
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
            <Button variant="outline" size="icon" onClick={handleExportCSV} title="CSV İndir (filtreli)">
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
                      placeholder="Örn: Tez Yazımı"
                      value={quickLabel}
                      onChange={(e) => setQuickLabel(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      size="lg"
                      className="h-12 px-8 flex-1 sm:flex-auto rounded-xl shadow-lg border-0 text-white"
                      style={{ backgroundColor: theme.hex }}
                      onClick={startSession}
                    >
                      <Play className="mr-2 h-5 w-5 fill-current" /> Başlat
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="h-12 px-4 rounded-xl border-slate-200"
                        title="Manuel Ekle"
                        onClick={openCreateDialog}
                    >
                        <Plus className="h-5 w-5 text-slate-500" />
                    </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Active Timer extracted to component for performance
            <ActiveTimer 
              running={running} 
              onStop={stopSession} 
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
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-10 rounded-xl w-[160px] bg-white">
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
                      <Button variant="outline" className="rounded-xl gap-2">
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
                      const durationMs = session.end - session.start;

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
                              {(cat?.name ?? session.categoryId).substring(0, 2).toUpperCase()}
                            </div>

                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {cat?.name ?? session.categoryId}
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
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="hidden sm:block font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {fmtCompact(durationMs)}
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-xl">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditDialog(session)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Düzenle
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => deleteSession(session.id)}>
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
                        <SelectTrigger className="h-9 w-[110px] rounded-xl bg-white">
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
                          <BarChart
                            data={chartData.daily}
                            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                            barCategoryGap={18}
                            barGap={2}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <Tooltip
                              formatter={(v: any, name: any) => [
                                fmtHmFromHours(Number(v) || 0),
                                categoryMap.get(name)?.name ?? name,
                              ]}
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

                  <Card
                    className="flex flex-col justify-center items-center text-center p-6 shadow-none border"
                    style={{ backgroundColor: `${theme.hex}15`, borderColor: `${theme.hex}30` }}
                  >
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${theme.hex}25`, color: theme.hex }}
                    >
                      <CalendarIcon className="h-6 w-6" />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: theme.hex }}>
                      {dailyTotalHuman7d}
                    </div>
                    <div className="text-sm font-medium" style={{ color: theme.hex }}>
                      Toplam (7 Gün)
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Günlük Ort: {fmtHmFromHours(chartData.dailyTotalHours / 7)}
                    </div>
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
                          <BarChart
                            data={chartData.weekly}
                            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                            barCategoryGap={18}
                            barGap={2}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <Tooltip
                              formatter={(v: any, name: any) => [
                                fmtHmFromHours(Number(v) || 0),
                                categoryMap.get(name)?.name ?? name,
                              ]}
                            />
                            <Legend verticalAlign="bottom" content={renderLegend} />
                            {stackKeys.map((id) => (
                              <Bar key={id} dataKey={id} stackId="a" fill={getCatHex(id)} barSize={40} radius={0} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className="flex flex-col justify-center items-center text-center p-6 shadow-none border"
                    style={{ backgroundColor: `${theme.hex}15`, borderColor: `${theme.hex}30` }}
                  >
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${theme.hex}25`, color: theme.hex }}
                    >
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div className="text-2xl font-bold" style={{ color: theme.hex }}>
                      {weeklyTotalHuman4w}
                    </div>
                    <div className="text-sm font-medium" style={{ color: theme.hex }}>
                      Toplam (4 Hafta)
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Haftalık Ort: {fmtHmFromHours(chartData.weeklyTotalHours / 4)}
                    </div>
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

                  <Card
                    className="flex flex-col justify-center items-center text-center p-6 shadow-none border"
                    style={{ backgroundColor: `${theme.hex}15`, borderColor: `${theme.hex}30` }}
                  >
                    <div
                      className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${theme.hex}25`, color: theme.hex }}
                    >
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
                        {categories.map(c => (
                            <div key={c.id} className="flex items-center gap-2 p-3 border rounded-lg bg-white">
                                <Input 
                                    type="color" 
                                    className="w-8 h-8 p-0 border-0 rounded-full cursor-pointer shrink-0"
                                    value={c.color}
                                    onChange={(e) => updateCategory(c.id, 'color', e.target.value)}
                                />
                                <Input 
                                    value={c.name}
                                    onChange={(e) => updateCategory(c.id, 'name', e.target.value)}
                                    className="h-8 text-sm"
                                />
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                                    onClick={() => deleteCategory(c.id)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-end gap-4 p-4 bg-slate-50 rounded-xl border border-dashed">
                        <div className="space-y-1 flex-1">
                            <Label>Yeni Kategori Adı</Label>
                            <Input 
                                placeholder="Örn: Yazılım" 
                                value={newCatName} 
                                onChange={(e) => setNewCatName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                             <Label>Renk</Label>
                             <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Input 
                                        type="color" 
                                        value={newCatColor} 
                                        onChange={(e) => setNewCatColor(e.target.value)}
                                        className="w-10 h-10 p-1 rounded-lg cursor-pointer"
                                    />
                                </div>
                             </div>
                        </div>
                        <Button onClick={addCategory} disabled={!newCatName.trim()}>
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
                    <div className="text-xs text-muted-foreground">
                      Gösterimler “X saat Y dk” formatında. (Hedef dahil)
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Veri & Dışa Aktarım</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button variant="outline" className="w-full justify-start" onClick={handleExportCSV}>
                    <Download className="mr-2 h-4 w-4" /> Filtreli kayıtları CSV indir
                  </Button>

                  <Separator />

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Sıfırlama</div>

                    <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" className="w-full justify-start">
                          <Trash2 className="mr-2 h-4 w-4" /> Tüm kayıtları sil
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Tüm kayıtlar silinsin mi?</DialogTitle>
                          <DialogDescription>Bu işlem geri alınamaz. Tüm çalışma kayıtları kalıcı olarak silinir.</DialogDescription>
                        </DialogHeader>

                        <DialogFooter>
                          <Button variant="outline" onClick={() => setResetOpen(false)}>
                            Vazgeç
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setSessions([]);
                              setLocalUpdatedAt(Date.now());
                              setResetOpen(false);
                            }}
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
              >
                <Play className="h-6 w-6 text-white" />
              </Button>
            </DialogTrigger>

            <DialogContent className="fixed bottom-0 left-0 right-0 translate-y-0 top-auto rounded-t-2xl p-4">
              <DialogHeader>
                <DialogTitle>Hızlı Başlat</DialogTitle>
                <DialogDescription>Kategori seç, istersen etiket ekle ve başlat.</DialogDescription>
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
                    placeholder="Örn: Tez Yazımı"
                    value={quickLabel}
                    onChange={(e) => setQuickLabel(e.target.value)}
                  />
                </div>

                <Button
                  size="lg"
                  className="h-12 rounded-xl shadow-lg border-0 text-white"
                  style={{ backgroundColor: theme.hex }}
                  onClick={startSession}
                >
                  <Play className="mr-2 h-5 w-5 fill-current" /> Başlat
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}