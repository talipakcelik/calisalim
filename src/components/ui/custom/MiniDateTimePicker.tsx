import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { pad2 } from "@/lib/formatters";

export function MiniDateTimePicker({
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
                                        className={`h-8 rounded-lg text-sm transition-colors ${isSelected
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
