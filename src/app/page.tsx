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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  Calendar,
  PieChart,
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
} from "recharts";

/** ========= Types ========= */
type Category = { id: string; name: string; color: string };
type Session = { id: string; categoryId: string; label: string; start: number; end: number };
type Running = { categoryId: string; label: string; start: number };
type Snapshot = { categories: Category[]; sessions: Session[]; dailyTarget: number };
type CloudStatus = "disabled" | "signed_out" | "signed_in" | "syncing" | "error";

/** ========= Defaults ========= */
const DEFAULT_CATEGORIES: Category[] = [
  { id: "phd", name: "PhD / Tez", color: "bg-indigo-500" },
  { id: "work", name: "İş", color: "bg-blue-500" },
  { id: "reading", name: "Okuma", color: "bg-emerald-500" },
  { id: "sport", name: "Spor", color: "bg-rose-500" },
  { id: "social", name: "Sosyal", color: "bg-amber-500" },
  { id: "other", name: "Diğer", color: "bg-slate-500" },
];

/** ========= Storage keys (v2) ========= */
const LS_CATEGORIES = "talip-v2.categories";
const LS_SESSIONS = "talip-v2.sessions";
const LS_TARGET = "talip-v2.target";
const LS_UPDATED_AT = "talip-v2.updatedAt";

/** ========= Helpers ========= */
const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

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

const startOfDayMs = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
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
  const [now, setNow] = useState(Date.now());
  const [quickCat, setQuickCat] = useState<string>("");
  const [quickLabel, setQuickLabel] = useState("");

  // --- Cloud state ---
  const [user, setUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>(supabase ? "signed_out" : "disabled");
  const [cloudMsg, setCloudMsg] = useState<string>(supabase ? "Bulut hazır" : "Bulut kapalı (ENV yok)");
  const [authEmail, setAuthEmail] = useState("");

  const isHydratingFromCloud = useRef(false);
  const saveDebounceRef = useRef<number | null>(null);

  // Keep latest snapshot in ref (prevents callback churn)
  const stateRef = useRef({ categories, sessions, dailyTarget, localUpdatedAt });
  useEffect(() => {
    stateRef.current = { categories, sessions, dailyTarget, localUpdatedAt };
  }, [categories, sessions, dailyTarget, localUpdatedAt]);

  // Tick
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
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

  // --- Session controls ---
  const startSession = () => {
    if (running) return;
    const catId = quickCat || categories[0]?.id;
    if (!catId) return;
    setRunning({ categoryId: catId, label: quickLabel.trim(), start: Date.now() });
  };

  const stopSession = () => {
    if (!running) return;
    const newSession: Session = {
      id: uid(),
      categoryId: running.categoryId,
      label: running.label,
      start: running.start,
      end: Date.now(),
    };

    setSessions((prev) => {
      const next = [newSession, ...prev];
      return next;
    });

    setLocalUpdatedAt(Date.now());
    setRunning(null);
    setQuickLabel("");
  };

  const deleteSession = (id: string) => {
    if (!confirm("Bu kayıt kalıcı olarak silinsin mi?")) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setLocalUpdatedAt(Date.now());
  };

  // --- Cloud sync functions ---
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
      setCloudStatus("signed_in");
      setCloudMsg(label ? `Senkronlandı (${label})` : "Senkronlandı");
    },
    []
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

      // No remote yet => push local snapshot as first sync
      if (!data?.data) {
        await pushToCloud(u, "İlk kurulum");
        return;
      }

      // Remote newer => hydrate from cloud
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

      // Local newer or equal => push local to cloud (keeps it in sync)
      if ((localUpdatedAt || 0) >= remoteMs) {
        await pushToCloud(u, "Yerel daha yeni");
      } else {
        setCloudStatus("signed_in");
        setCloudMsg("Senkronize");
      }
    },
    [pushToCloud]
  );

  // Auth init + listener (stable)
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

  // --- Analytics (same language, same logic) ---
  const getDailyTotal = useCallback(
    (dateMs: number) => {
      const start = startOfDayMs(new Date(dateMs));
      const end = start + 86400000;
      return sessions
        .filter((s) => s.start >= start && s.start < end)
        .reduce((acc, s) => acc + (s.end - s.start), 0);
    },
    [sessions]
  );

  const todayTotal = useMemo(() => getDailyTotal(Date.now()), [getDailyTotal, now]);
  const progressPercent = Math.min(100, (todayTotal / (Math.max(0.01, dailyTarget) * 3600000)) * 100);

  const chartData = useMemo(() => {
    const sumHours = (sess: Session[]) => sess.reduce((acc, s) => acc + (s.end - s.start), 0) / 3600000;

    // 1) Daily last 7
    const daily: Array<{ name: string; fullDate: string; saat: number }> = [];
    let dailyTotal = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const start = d.getTime();
      const end = start + 86400000;
      const daySessions = sessions.filter((s) => s.start >= start && s.start < end);
      const hrs = sumHours(daySessions);
      dailyTotal += hrs;

      daily.push({
        name: d.toLocaleDateString("tr-TR", { weekday: "short" }),
        fullDate: d.toLocaleDateString("tr-TR"),
        saat: Number(hrs.toFixed(1)),
      });
    }

    // 2) Weekly last 4
    const weekly: Array<{ name: string; saat: number }> = [];
    let weeklyTotal = 0;
    for (let i = 3; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);

      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);

      const start = monday.getTime();
      const end = start + 7 * 86400000;

      const weekSessions = sessions.filter((s) => s.start >= start && s.start < end);
      const hrs = sumHours(weekSessions);
      weeklyTotal += hrs;

      weekly.push({
        name: `${monday.getDate()} ${monday.toLocaleDateString("tr-TR", { month: "short" })}`,
        saat: Number(hrs.toFixed(1)),
      });
    }

    // 3) Monthly last 6
    const monthly: Array<{ name: string; saat: number }> = [];
    let monthlyTotal = 0;
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
      const hrs = sumHours(monthSessions);
      monthlyTotal += hrs;

      monthly.push({
        name: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
        saat: Number(hrs.toFixed(1)),
      });
    }

    return { daily, dailyTotal, weekly, weeklyTotal, monthly, monthlyTotal };
  }, [sessions, now]);

  const handleExportCSV = () => {
    const headers = ["ID", "Kategori", "Etiket", "Başlangıç", "Bitiş", "Süre (dk)"];
    const rows = sessions.map((s) => [
      s.id,
      categoryMap.get(s.categoryId)?.name || s.categoryId,
      s.label || "",
      new Date(s.start).toLocaleString("tr-TR"),
      new Date(s.end).toLocaleString("tr-TR"),
      ((s.end - s.start) / 60000).toFixed(2),
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

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-32 sm:pb-10">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <div className="bg-primary text-primary-foreground p-2 rounded-xl">
                <Timer className="h-6 w-6" />
              </div>
              Çalışalım
            </h1>
            <p className="text-muted-foreground mt-1"></p>
          </div>

          <div className="flex gap-2 items-center">
            {/* Cloud */}
            {supabase ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={user ? "outline" : "default"}
                    className={`gap-2 ${!user ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}`}
                  >
                    {cloudStatus === "syncing" ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Cloud className="h-4 w-4" />
                    )}
                    {user ? "Senkronize" : "Giriş Yap"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Bulut Senkronizasyonu</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user ? (
                    <>
                      <div className="px-2 py-1.5 text-xs text-muted-foreground break-all">
                        Giriş yapıldı: <br /> {user.email}
                      </div>
                      <div className="px-2 py-1.5 text-xs font-medium text-emerald-600">
                        {cloudStatus === "error" ? `Hata: ${cloudMsg}` : cloudMsg || "Veriler güvende"}
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
                      <div className="text-[11px] text-muted-foreground">
                        {cloudStatus === "error" ? `Hata: ${cloudMsg}` : cloudMsg}
                      </div>
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
            <Button variant="outline" size="icon" onClick={handleExportCSV} title="CSV İndir">
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
                            {c.name}
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

                <Button
                  size="lg"
                  className="h-12 px-8 w-full sm:w-auto rounded-xl shadow-lg shadow-primary/20"
                  onClick={startSession}
                >
                  <Play className="mr-2 h-5 w-5 fill-current" /> Başlat
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse" />
              <CardContent className="flex flex-col sm:flex-row items-center justify-between py-8 gap-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/10 shadow-inner">
                    <Timer className="h-8 w-8 animate-pulse text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-indigo-100 flex items-center gap-2">
                      {categoryMap.get(running.categoryId)?.name ?? running.categoryId}
                      {running.label ? (
                        <Badge variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0">
                          {running.label}
                        </Badge>
                      ) : null}
                    </h3>
                    <div className="text-4xl font-bold tabular-nums tracking-tight mt-1 font-mono">
                      {fmtDuration(now - running.start)}
                    </div>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  size="lg"
                  className="h-14 px-8 rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-900/20 border-0"
                  onClick={stopSession}
                >
                  <Square className="mr-2 h-5 w-5 fill-current" /> Durdur & Kaydet
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex justify-between">
                <span>Günlük Hedef</span>
                <span className="text-muted-foreground font-normal">
                  {fmtDuration(todayTotal)} / {dailyTarget}sa
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {progressPercent >= 100 ? "Harika! Hedefine ulaştın 🎉" : "Hedefe ulaşmak için çalışmaya devam et."}
              </p>

              <div className="mt-4">
                <Label>Günlük hedef (saat)</Label>
                <Input
                  className="mt-1 max-w-[220px]"
                  type="number"
                  min={0}
                  step={0.25}
                  value={dailyTarget}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setDailyTarget(Number.isFinite(v) ? v : 0);
                    setLocalUpdatedAt(Date.now());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Bu Hafta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                {chartData.weeklyTotal.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">saat</span>
              </div>
              <div className="flex items-center text-xs text-emerald-600 mt-2 font-medium">
                <TrendingUp className="h-3 w-3 mr-1" />
                Toplam çalışma süresi
              </div>
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
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Ara... (şimdilik görsel)" className="pl-9 rounded-xl bg-white" />
                </div>
                <Button variant="outline" size="icon" className="rounded-xl" title="Filtre (yakında)">
                  <Filter className="h-4 w-4" />
                </Button>
              </div>

              {sessions.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 border border-dashed rounded-xl">
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Timer className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Henüz kayıt yok</h3>
                  <p className="text-slate-500 max-w-xs mx-auto mt-2">
                    Yukarıdaki panelden bir kategori seç ve çalışmaya başla.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((session) => {
                    const cat = categoryMap.get(session.categoryId);
                    return (
                      <div
                        key={session.id}
                        className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-900"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-10 w-10 rounded-full flex items-center justify-center ${
                              cat?.color ?? "bg-slate-500"
                            } text-white font-bold text-xs shadow-md`}
                          >
                            {(cat?.name ?? session.categoryId).substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {cat?.name ?? session.categoryId}
                              {session.label ? (
                                <span className="text-muted-foreground font-normal"> · {session.label}</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground flex gap-2">
                              <span>
                                {new Date(session.start).toLocaleDateString("tr-TR", {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                              <span>•</span>
                              <span>
                                {fmtTime(session.start)} - {fmtTime(session.end)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="font-mono font-medium text-slate-700 dark:text-slate-300">
                            {fmtDuration(session.end - session.start)}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                            onClick={() => deleteSession(session.id)}
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analytics */}
          <TabsContent value="analytics" className="mt-6 space-y-6">
            <Tabs defaultValue="daily" className="w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-500" />
                    Performans Analizi
                  </h3>
                  <p className="text-sm text-muted-foreground">Çalışma sürelerinin zaman içindeki dağılımı.</p>
                </div>
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <TabsTrigger
                    value="daily"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    Günlük
                  </TabsTrigger>
                  <TabsTrigger
                    value="weekly"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    Haftalık
                  </TabsTrigger>
                  <TabsTrigger
                    value="monthly"
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    Aylık
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* DAILY */}
              <TabsContent value="daily" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="md:col-span-3 shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Son 7 Gün</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(v: any) => [`${v} Saat`, "Süre"]} />
                            <Bar dataKey="saat" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-indigo-50 border-indigo-100 flex flex-col justify-center items-center text-center p-6 shadow-none">
                    <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 text-indigo-600">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div className="text-3xl font-bold text-indigo-900">{chartData.dailyTotal.toFixed(1)}</div>
                    <div className="text-sm font-medium text-indigo-600">Toplam Saat (7 Gün)</div>
                    <div className="text-xs text-indigo-400 mt-2">Günlük Ort: {(chartData.dailyTotal / 7).toFixed(1)} sa</div>
                  </Card>
                </div>
              </TabsContent>

              {/* WEEKLY */}
              <TabsContent value="weekly" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="md:col-span-3 shadow-sm border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Son 4 Hafta</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.weekly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="saat" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-emerald-50 border-emerald-100 flex flex-col justify-center items-center text-center p-6 shadow-none">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3 text-emerald-600">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div className="text-3xl font-bold text-emerald-900">{chartData.weeklyTotal.toFixed(1)}</div>
                    <div className="text-sm font-medium text-emerald-600">Toplam Saat (4 Hafta)</div>
                    <div className="text-xs text-emerald-500 mt-2">Haftalık Ort: {(chartData.weeklyTotal / 4).toFixed(1)} sa</div>
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
                              <linearGradient id="colorMonth" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="saat" stroke="#f43f5e" fillOpacity={1} fill="url(#colorMonth)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-rose-50 border-rose-100 flex flex-col justify-center items-center text-center p-6 shadow-none">
                    <div className="h-12 w-12 rounded-full bg-rose-100 flex items-center justify-center mb-3 text-rose-600">
                      <PieChart className="h-6 w-6" />
                    </div>
                    <div className="text-3xl font-bold text-rose-900">{chartData.monthlyTotal.toFixed(1)}</div>
                    <div className="text-sm font-medium text-rose-600">Toplam Saat (6 Ay)</div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Uygulama Ayarları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Günlük Hedef (Saat)</Label>
                  <Input
                    type="number"
                    value={dailyTarget}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDailyTarget(Number.isFinite(v) ? v : 0);
                      setLocalUpdatedAt(Date.now());
                    }}
                    className="max-w-[200px]"
                  />
                </div>
                <Separator />
                <div>
                  <h4 className="font-medium mb-2">Veri Yönetimi</h4>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => confirm("Tüm kayıtlar silinsin mi?") && (setSessions([]), setLocalUpdatedAt(Date.now()))}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Tüm Kayıtları Sıfırla
                    </Button>
                  </div>
                </div>

                <Separator />
                <div className="text-xs text-muted-foreground">
                  Yerel güncelleme: {localUpdatedAt ? new Date(localUpdatedAt).toLocaleString("tr-TR") : "-"}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Mobile FAB */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        {!running && (
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-xl bg-indigo-600 hover:bg-indigo-700"
            onClick={startSession}
          >
            <Play className="h-6 w-6 text-white" />
          </Button>
        )}
      </div>
    </div>
  );
}