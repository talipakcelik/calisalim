import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Target, Trash2 } from "lucide-react";
import { Milestone } from "@/types/tracking";

/** ========= YENİ: Milestones Widget ========= */
export function MilestonesWidget({
    milestones,
    onDelete,
    onToggle
}: {
    milestones: Milestone[];
    onDelete: (id: string) => void;
    onToggle: (id: string) => void;
}) {
    const sorted = [...milestones].sort((a, b) => {
        if (a.done === b.done) return a.date - b.date;
        return a.done ? 1 : -1;
    });

    const getDaysLeft = (target: number) => Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));

    return (
        <Card className="shadow-sm h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-amber-600" /> Kilometre Taşları
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[180px] pr-1 space-y-2">
                {sorted.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">Hedef eklenmedi.</div>
                ) : (
                    sorted.map(m => {
                        const days = getDaysLeft(m.date);
                        const isUrgent = !m.done && days <= 3 && days >= 0;
                        return (
                            <div key={m.id} className={`flex items-center justify-between text-sm p-2 rounded-lg border ${m.done ? "bg-slate-50 opacity-60" : "bg-white dark:bg-slate-900"} ${isUrgent ? "border-red-200 bg-red-50 dark:bg-red-900/10" : ""}`}>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => onToggle(m.id)} className={`h-4 w-4 rounded border flex items-center justify-center ${m.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-400"}`}>
                                        {m.done && <CheckCircle2 className="h-3 w-3" />}
                                    </button>
                                    <div>
                                        <div className={`font-medium ${m.done ? "line-through" : ""}`}>{m.title}</div>
                                        <div className={`text-[10px] ${isUrgent ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                                            {new Date(m.date).toLocaleDateString("tr-TR")} • {m.done ? "Bitti" : days < 0 ? `${Math.abs(days)} gün geçti` : `${days} gün kaldı`}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => onDelete(m.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
