"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
// Supabase'i CDN üzerinden yükleyeceğiz, bu yüzden import'u kaldırdık.
// import { createClient, type User } from "@supabase/supabase-js";

// --- UI Components (Shadcn/UI Mock) ---
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

// --- Icons ---
import {
  Play, Square, Trash2, Timer, TrendingUp, Cloud, LogOut,
  RefreshCw, Mail, Search, Download, Moon, Sun, Filter, User as UserIcon, Loader2, Settings,
  BarChart3, Calendar, PieChart
} from "lucide-react";

// --- Charts ---
import { 
  BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, 
  AreaChart, Area, Legend 
} from "recharts";

/** ========= Types & Constants ========= */
// Type definitions for Supabase User since we can't import it
type User = {
  id: string;
  email?: string;
  app_metadata: {
    provider?: string;
    [key: string]: any;
  };
  user_metadata: {
    [key: string]: any;
  };
  aud: string;
  created_at: string;
};

type Category = { id: string; name: string; color: string };
type Session = { id: string; categoryId: string; label: string; start: number; end: number };
type Running = { categoryId: string; label: string; start: number };
type Snapshot = { categories: Category[]; sessions: Session[]; dailyTarget: number };
type CloudStatus = "disabled" | "signed_out" | "signed_in" | "syncing" | "error";

const DEFAULT_CATEGORIES: Category[] = [
  { id: "phd", name: "PhD / Tez", color: "bg-indigo-500" },
  { id: "work", name: "İş", color: "bg-blue-500" },
  { id: "reading", name: "Okuma", color: "bg-emerald-500" },
  { id: "sport", name: "Spor", color: "bg-rose-500" },
  { id: "social", name: "Sosyal", color: "bg-amber-500" },
  { id: "other", name: "Diğer", color: "bg-slate-500" },
];

/** ========= Helpers ========= */
const uid = () => `id_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
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

// Basit "custom hook" ile localStorage yönetimi
function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [state, setState] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        setState(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Storage parse error", e);
    } finally {
      setHydrated(true);
    }
  }, [key]);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(key, JSON.stringify(state));
    }
  }, [key, state, hydrated]);

  return [state, setState, hydrated];
}

/** ========= Supabase Setup ========= */
// Ortam değişkenlerine güvenli erişim
const getEnvVar = (key: string) => {
  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env[key] || "";
    }
  } catch (e) {
    // process erişim hatası olursa yoksay
  }
  return "";
};

export default function EnhancedApp() {
  // --- State Management ---
  const [categories, setCategories, catsHydrated] = usePersistentState<Category[]>("talip-v3.categories", DEFAULT_CATEGORIES);
  const [sessions, setSessions, sessionsHydrated] = usePersistentState<Session[]>("talip-v3.sessions", []);
  const [dailyTarget, setDailyTarget] = usePersistentState<number>("talip-v3.target", 2);
  const [localUpdatedAt, setLocalUpdatedAt] = usePersistentState<number>("talip-v3.updatedAt", 0);
  
  // Timer State
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(Date.now());
  const [quickCat, setQuickCat] = useState<string>("");
  const [quickLabel, setQuickLabel] = useState("");

  // Cloud Config State (User can input API keys)
  const [cloudConfig, setCloudConfig] = usePersistentState<{url: string, key: string}>("talip-v3.cloudConfig", {
      url: getEnvVar("NEXT_PUBLIC_SUPABASE_URL"),
      key: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  });
  const [isCloudConfigOpen, setIsCloudConfigOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState(cloudConfig);

  // Cloud State
  const [supabase, setSupabase] = useState<any>(null); // Dynamic client
  const [user, setUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("disabled");
  const [authEmail, setAuthEmail] = useState("");
  const [cloudMsg, setCloudMsg] = useState("");
  
  // Ref for preventing infinite loop during sync
  const isHydratingFromCloud = useRef(false);
  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Derived Data
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // STABILITY FIX: State verilerini Ref içinde tutarak callback'lerin sürekli yeniden oluşmasını engelliyoruz.
  const stateRef = useRef({ categories, sessions, dailyTarget, localUpdatedAt });
  useEffect(() => {
    stateRef.current = { categories, sessions, dailyTarget, localUpdatedAt };
  }, [categories, sessions, dailyTarget, localUpdatedAt]);

  // .env.local SYNC: Eğer ortam değişkenleri varsa ve config boşsa otomatik doldur
  useEffect(() => {
    const envUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
    const envKey = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    
    // Eğer env değişkenleri mevcutsa
    if (envUrl && envKey) {
        // Ve mevcut ayarlar boşsa veya eksikse, env'den güncelle
        if (!cloudConfig.url || !cloudConfig.key) {
             setCloudConfig({ url: envUrl, key: envKey });
        }
    }
  }, []); // Sadece ilk yüklemede çalışır

  // Load Supabase dynamically when config changes
  useEffect(() => {
    if (!cloudConfig.url || !cloudConfig.key) {
      setCloudStatus("disabled");
      setSupabase(null);
      return;
    }

    const initSupabase = () => {
      // @ts-ignore
      if (window.supabase) {
        try {
            // @ts-ignore
            const client = window.supabase.createClient(cloudConfig.url, cloudConfig.key);
            setSupabase(client);
            setCloudStatus("signed_out");
        } catch (err) {
            console.error("Supabase init error:", err);
            setCloudStatus("error");
            setCloudMsg("API Hatası");
        }
      }
    };

    if (typeof window !== "undefined") {
      // @ts-ignore
      if (window.supabase) {
        initSupabase();
      } else {
        // Prevent duplicate script injection
        if (document.getElementById("supabase-js")) return;
        
        const script = document.createElement("script");
        script.id = "supabase-js";
        script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        script.async = true;
        script.onload = initSupabase;
        document.body.appendChild(script);
      }
    }
  }, [cloudConfig]);


  // Timer Tick
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Logic: Session Control ---
  const startSession = () => {
    if (running) return;
    const catId = quickCat || categories[0]?.id;
    if (!catId) return;
    setRunning({ categoryId: catId, label: quickLabel, start: Date.now() });
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
    setSessions(prev => {
        const next = [newSession, ...prev];
        setLocalUpdatedAt(Date.now());
        return next;
    });
    setRunning(null);
    setQuickLabel("");
  };

  const deleteSession = (id: string) => {
    if (confirm("Bu kayıt kalıcı olarak silinsin mi?")) {
      setSessions(prev => {
          const next = prev.filter(s => s.id !== id);
          setLocalUpdatedAt(Date.now());
          return next;
      });
    }
  };

  // --- Logic: Cloud Sync ---
  // STABILITY FIX: Dependencies array is now stable (only [supabase]), preventing auth listener loops
  const pushToCloud = useCallback(async (currentUser: User, label?: string) => {
    if (!supabase) return;
    setCloudStatus("syncing");
    
    // Read directly from Ref to avoid dependency change
    const { categories, sessions, dailyTarget } = stateRef.current;
    
    const snapshot: Snapshot = { categories, sessions, dailyTarget };
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("user_data")
      .upsert({ user_id: currentUser.id, data: snapshot, updated_at: nowIso }, { onConflict: "user_id" });

    if (error) {
        console.error("Cloud push error:", error);
        setCloudStatus("error");
        setCloudMsg("Yükleme hatası");
    } else {
        setCloudStatus("signed_in");
        setCloudMsg(label ? `Senkronlandı (${label})` : "Senkronlandı");
    }
  }, [supabase]); 

  // STABILITY FIX: Dependencies array is now stable
  const loadFromCloud = useCallback(async (currentUser: User) => {
    if (!supabase) return;
    setCloudStatus("syncing");
    setCloudMsg("Veriler çekiliyor...");

    const { data, error } = await supabase
      .from("user_data")
      .select("data, updated_at")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) {
        // Tablo yoksa veya başka hata varsa
        if (error.code === "PGRST116") { // Veri yok
             pushToCloud(currentUser, "İlk kurulum");
             return;
        }
        setCloudStatus("error");
        setCloudMsg(error.message || "Veri çekme hatası");
        return;
    }

    const remoteMs = data?.updated_at ? Date.parse(data.updated_at) : 0;
    const { localUpdatedAt } = stateRef.current;
    
    // Eğer buluttaki veri yerelden daha yeniyse güncelle
    if (data?.data && remoteMs > localUpdatedAt) {
        isHydratingFromCloud.current = true;
        const remoteSnap = data.data as Snapshot;
        
        setCategories(remoteSnap.categories || DEFAULT_CATEGORIES);
        setSessions(remoteSnap.sessions || []);
        setDailyTarget(remoteSnap.dailyTarget || 2);
        setLocalUpdatedAt(remoteMs);
        
        setTimeout(() => { isHydratingFromCloud.current = false; }, 100);
        
        setCloudStatus("signed_in");
        setCloudMsg("Buluttan güncellendi");
    } else {
        // Yerel veri daha yeniyse veya eşitleme yoksa buluta gönder
        if (localUpdatedAt > remoteMs) {
            pushToCloud(currentUser, "Yerel daha yeni");
        } else {
            setCloudStatus("signed_in");
            setCloudMsg("Senkronize");
        }
    }
  }, [supabase, pushToCloud, setCategories, setSessions, setDailyTarget, setLocalUpdatedAt]);

  // Auth Listener
  // STABILITY FIX: This useEffect now relies on stable callbacks, so it won't tear down on every state change.
  useEffect(() => {
    if (!supabase || !catsHydrated || !sessionsHydrated) return;

    supabase.auth.getSession().then(({ data }: any) => {
        setUser(data.session?.user ?? null);
        if (data.session?.user) loadFromCloud(data.session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) loadFromCloud(u);
        else setCloudStatus("signed_out");
    });

    return () => subscription.unsubscribe();
  }, [supabase, catsHydrated, sessionsHydrated, loadFromCloud]);

  // Auto-Save Effect
  useEffect(() => {
    if (!user || isHydratingFromCloud.current || !catsHydrated) return;

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    
    saveDebounceRef.current = setTimeout(() => {
        pushToCloud(user);
    }, 2000); 

    return () => { if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current); };
  }, [categories, sessions, dailyTarget, user, pushToCloud, catsHydrated]);


  // --- Logic: Analytics & Charts Prep ---
  const getDailyTotal = useCallback((dateMs: number) => {
    const d = new Date(dateMs);
    d.setHours(0,0,0,0);
    const start = d.getTime();
    const end = start + 86400000;
    return sessions
      .filter(s => s.start >= start && s.end < end)
      .reduce((acc, s) => acc + (s.end - s.start), 0);
  }, [sessions]);

  const todayTotal = useMemo(() => getDailyTotal(Date.now()), [getDailyTotal, now]); 
  const progressPercent = Math.min(100, (todayTotal / (dailyTarget * 3600000)) * 100);

  // Advanced Charts Data Calculation
  const chartData = useMemo(() => {
    const sumHours = (sess: Session[]) => sess.reduce((acc, s) => acc + (s.end - s.start), 0) / 3600000;

    // 1. Daily (Son 7 gün)
    const daily = [];
    let dailyTotal = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const start = d.getTime();
        const end = start + 86400000;
        
        const daySessions = sessions.filter(s => s.start >= start && s.start < end);
        const hrs = sumHours(daySessions);
        dailyTotal += hrs;
        daily.push({
            name: d.toLocaleDateString("tr-TR", { weekday: 'short' }),
            fullDate: d.toLocaleDateString("tr-TR"),
            saat: parseFloat(hrs.toFixed(1))
        });
    }

    // 2. Weekly (Son 4 hafta)
    const weekly = [];
    let weeklyTotal = 0;
    for(let i=3; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - (i * 7));
        // Find monday
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0,0,0,0);
        
        const start = monday.getTime();
        const end = start + (7 * 86400000);
        
        const weekSessions = sessions.filter(s => s.start >= start && s.start < end);
        const hrs = sumHours(weekSessions);
        weeklyTotal += hrs;
        weekly.push({
            name: `${monday.getDate()} ${monday.toLocaleDateString("tr-TR", { month: 'short' })}`,
            saat: parseFloat(hrs.toFixed(1))
        });
    }

    // 3. Monthly (Son 6 ay)
    const monthly = [];
    let monthlyTotal = 0;
    for(let i=5; i>=0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        d.setDate(1);
        d.setHours(0,0,0,0);
        const start = d.getTime();
        
        const nextMonth = new Date(d);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const end = nextMonth.getTime();

        const monthSessions = sessions.filter(s => s.start >= start && s.start < end);
        const hrs = sumHours(monthSessions);
        monthlyTotal += hrs;
        monthly.push({
            name: d.toLocaleDateString("tr-TR", { month: 'short', year: '2-digit' }),
            saat: parseFloat(hrs.toFixed(1))
        });
    }

    return { 
        daily, dailyTotal, 
        weekly, weeklyTotal, 
        monthly, monthlyTotal 
    };
  }, [sessions, now]);


  // --- Logic: CSV Export ---
  const handleExportCSV = () => {
    const headers = ["ID", "Kategori", "Etiket", "Başlangıç", "Bitiş", "Süre (dk)"];
    const rows = sessions.map(s => [
      s.id,
      categoryMap.get(s.categoryId)?.name || s.categoryId,
      s.label,
      new Date(s.start).toLocaleString("tr-TR"),
      new Date(s.end).toLocaleString("tr-TR"),
      ((s.end - s.start) / 60000).toFixed(2)
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zaman_takip_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const handleSignIn = async () => {
      if(!supabase || !authEmail) return;
      setCloudMsg("Link gönderiliyor...");
      const { error } = await supabase.auth.signInWithOtp({
          email: authEmail,
          options: {
  emailRedirectTo: "https://calisalim.vercel.app"
}
      });
      if(error) { alert(error.message); setCloudMsg("Hata"); }
      else { alert("Giriş linki e-postana gönderildi!"); setCloudMsg("E-postanı kontrol et"); }
  };

  const handleSaveConfig = () => {
      setCloudConfig(tempConfig);
      setIsCloudConfigOpen(false);
      alert("Ayarlar kaydedildi, bağlantı deneniyor...");
  };

  // --- UI Parts ---
  if (!catsHydrated || !sessionsHydrated) return <div className="flex h-screen items-center justify-center gap-2"><Loader2 className="animate-spin" /> Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-32 sm:pb-10">
        
        {/* Header Area */}
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
            {/* Cloud Status / Auth Menu */}
            {supabase ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant={user ? "outline" : "default"} className={`gap-2 ${!user && "bg-indigo-600 hover:bg-indigo-700 text-white"}`}>
                            {cloudStatus === "syncing" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                            {user ? "Senkronize" : "Giriş Yap"}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                        <DropdownMenuLabel>Bulut Senkronizasyonu</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {user ? (
                            <>
                                <div className="px-2 py-1.5 text-xs text-muted-foreground break-all">
                                    Giriş yapıldı: <br/> {user.email}
                                </div>
                                <div className="px-2 py-1.5 text-xs font-medium text-emerald-600">
                                    {cloudMsg || "Veriler güvende"}
                                </div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => loadFromCloud(user)}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Şimdi Eşitle
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => { supabase.auth.signOut(); setCloudStatus("signed_out"); }}>
                                    <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <div className="p-2 space-y-2">
                                <p className="text-xs text-muted-foreground">Verilerini kaybetmemek ve cihazlar arası eşitlemek için giriş yap.</p>
                                <Input 
                                    placeholder="ornek@email.com" 
                                    value={authEmail} 
                                    onChange={e => setAuthEmail(e.target.value)}
                                    className="h-8 text-sm"
                                />
                                <Button size="sm" className="w-full h-8" disabled={!supabase} onClick={handleSignIn}>
                                    <Mail className="mr-2 h-3 w-3" /> Link Gönder
                                </Button>
                            </div>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setTempConfig(cloudConfig); setIsCloudConfigOpen(true); }}>
                            <Settings className="mr-2 h-4 w-4" /> API Ayarları
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : (
                <Button variant="outline" size="sm" onClick={() => { setTempConfig(cloudConfig); setIsCloudConfigOpen(true); }}>
                    <Cloud className="mr-2 h-4 w-4 text-muted-foreground" /> Bulut Kurulumu
                </Button>
            )}

            <Button variant="outline" size="icon" onClick={handleExportCSV} title="CSV İndir">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Cloud Config Dialog */}
        <Dialog open={isCloudConfigOpen} onOpenChange={setIsCloudConfigOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Supabase Bağlantısı</DialogTitle>
                    <DialogDescription>
                        Cihazlar arası senkronizasyon için Supabase proje bilgilerini gir.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Project URL</Label>
                        <Input 
                            value={tempConfig.url} 
                            onChange={e => setTempConfig(prev => ({...prev, url: e.target.value}))}
                            placeholder="https://xyz.supabase.co"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Anon Key</Label>
                        <Input 
                            value={tempConfig.key} 
                            onChange={e => setTempConfig(prev => ({...prev, key: e.target.value}))}
                            placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                            type="password"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCloudConfigOpen(false)}>İptal</Button>
                    <Button onClick={handleSaveConfig}>Kaydet ve Bağlan</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

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
                                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                             <Label className="text-xs font-semibold uppercase text-muted-foreground">Etiket</Label>
                             <Input 
                                className="h-12 bg-white dark:bg-slate-950 border-slate-200" 
                                placeholder="Örn: Tez Yazımı" 
                                value={quickLabel}
                                onChange={e => setQuickLabel(e.target.value)}
                             />
                        </div>
                    </div>
                    <Button size="lg" className="h-12 px-8 w-full sm:w-auto rounded-xl shadow-lg shadow-primary/20" onClick={startSession}>
                        <Play className="mr-2 h-5 w-5 fill-current" /> Başlat
                    </Button>
                 </CardContent>
               </Card>
            ) : (
                <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse" />
                    
                    <CardContent className="flex flex-col sm:flex-row items-center justify-between py-8 gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/10 shadow-inner`}>
                                <Timer className="h-8 w-8 animate-pulse text-indigo-300" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-indigo-100 flex items-center gap-2">
                                    {categoryMap.get(running.categoryId)?.name}
                                    {running.label && <Badge variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0">{running.label}</Badge>}
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
                        <span className="text-muted-foreground font-normal">{fmtDuration(todayTotal)} / {dailyTarget}sa</span>
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

        {/* Main Content Tabs */}
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

            <TabsContent value="sessions" className="mt-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Ara..." className="pl-9 rounded-xl bg-white" />
                        </div>
                        <Button variant="outline" size="icon" className="rounded-xl"><Filter className="h-4 w-4" /></Button>
                    </div>

                    {sessions.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 border border-dashed rounded-xl">
                            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Timer className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">Henüz kayıt yok</h3>
                            <p className="text-slate-500 max-w-xs mx-auto mt-2">Yukarıdaki panelden bir kategori seç ve çalışmaya başla.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {sessions.map(session => {
                                const cat = categoryMap.get(session.categoryId);
                                return (
                                    <div key={session.id} className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-900">
                                        <div className="flex items-center gap-4">
                                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${cat?.color} text-white font-bold text-xs shadow-md`}>
                                                {cat?.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900 dark:text-slate-100">
                                                    {cat?.name}
                                                    {session.label && <span className="text-muted-foreground font-normal"> · {session.label}</span>}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex gap-2">
                                                    <span>{new Date(session.start).toLocaleDateString("tr-TR", { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                                    <span>•</span>
                                                    <span>{fmtTime(session.start)} - {fmtTime(session.end)}</span>
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

            <TabsContent value="analytics" className="mt-6 space-y-6">
                 {/* Chart Switcher Tabs */}
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
                            <TabsTrigger value="daily" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Günlük</TabsTrigger>
                            <TabsTrigger value="weekly" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Haftalık</TabsTrigger>
                            <TabsTrigger value="monthly" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Aylık</TabsTrigger>
                         </TabsList>
                    </div>

                    {/* DAILY CHART */}
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
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                <XAxis 
                                                    dataKey="name" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fontSize: 12, fill: '#64748B' }} 
                                                    dy={10}
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fontSize: 12, fill: '#64748B' }} 
                                                />
                                                <Tooltip 
                                                    cursor={{ fill: '#F1F5F9' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                    formatter={(value: any) => [`${value} Saat`, 'Süre']}
                                                />
                                                <Bar 
                                                    dataKey="saat" 
                                                    fill="#6366f1" 
                                                    radius={[6, 6, 0, 0]} 
                                                    barSize={32}
                                                />
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

                    {/* WEEKLY CHART */}
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
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                                <Tooltip 
                                                    cursor={{ fill: '#F1F5F9' }}
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                />
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

                    {/* MONTHLY CHART */}
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
                                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                                                <Tooltip 
                                                     contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                                />
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

            <TabsContent value="settings">
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
                                onChange={e => setDailyTarget(Number(e.target.value))} 
                                className="max-w-[200px]"
                            />
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-medium mb-2">Veri Yönetimi</h4>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => confirm("Tüm veriler silinsin mi?") && setSessions([])}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Tüm Kayıtları Sıfırla
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

      </div>
      
      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-6 right-6 sm:hidden">
          {!running && (
            <Button size="icon" className="h-14 w-14 rounded-full shadow-xl bg-indigo-600 hover:bg-indigo-700" onClick={startSession}>
                <Play className="h-6 w-6 text-white" />
            </Button>
          )}
      </div>

    </div>
  );
}