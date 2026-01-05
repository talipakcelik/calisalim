import { useEffect, useState } from "react";
import { Chapter, ChapterStatus, ReadingItem } from "@/types/tracking";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uid } from "@/lib/helpers";
import { Check, Search, Book } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function ChapterDialog({
    isOpen,
    onOpenChange,
    initialData,
    readingItems = [],
    onSave
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: Chapter | null;
    readingItems?: ReadingItem[];
    onSave: (chapter: Chapter) => void;
}) {
    const [title, setTitle] = useState("");
    const [goal, setGoal] = useState("5000");
    const [current, setCurrent] = useState("0");
    const [status, setStatus] = useState<ChapterStatus>("draft");
    const [notes, setNotes] = useState("");
    const [deadline, setDeadline] = useState("");
    const [linkedReadingIds, setLinkedReadingIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.title);
            setGoal(initialData.wordCountGoal.toString());
            setCurrent(initialData.currentWordCount.toString());
            setStatus(initialData.status);
            setNotes(initialData.notes || "");
            setLinkedReadingIds(initialData.linkedReadingIds || []);
            if (initialData.deadline) {
                // Convert timestamp to YYYY-MM-DD
                const d = new Date(initialData.deadline);
                const iso = d.toISOString().split("T")[0];
                setDeadline(iso);
            } else {
                setDeadline("");
            }
        } else if (isOpen) {
            // Reset for new
            setTitle("");
            setGoal("5000");
            setCurrent("0");
            setStatus("draft");
            setNotes("");
            setLinkedReadingIds([]);
            setDeadline("");
            setSearchQuery("");
        }
    }, [isOpen, initialData]);

    const handleSave = () => {
        if (!title.trim()) return;

        let deadlineTs = undefined;
        if (deadline) {
            deadlineTs = new Date(deadline).getTime();
        }

        const newChapter: Chapter = {
            id: initialData?.id || uid(),
            projectId: initialData?.projectId || "", // Will be overwritten/set by parent
            title: title.trim(),
            wordCountGoal: parseInt(goal) || 0,
            currentWordCount: parseInt(current) || 0,
            status,
            order: initialData?.order || Date.now(), // Simplified ordering for now
            notes: notes.trim() || undefined,
            deadline: deadlineTs,
            linkedReadingIds
        };

        onSave(newChapter);
        onOpenChange(false);
    };

    const toggleReading = (id: string) => {
        setLinkedReadingIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const filteredReadings = readingItems.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.authors || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Bölümü Düzenle" : "Yeni Bölüm Ekle"}</DialogTitle>
                    <DialogDescription>
                        Tez bölümlerini planla, kaynak ilişkilendir ve hedeflerini belirle.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Üst Kısım: Temel Bilgiler */}
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Bölüm Başlığı</Label>
                            <Input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Örn: Giriş, Literatür Taraması..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Hedef Kelime</Label>
                                <Input
                                    type="number"
                                    value={goal}
                                    onChange={e => setGoal(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Mevcut Kelime</Label>
                                <Input
                                    type="number"
                                    value={current}
                                    onChange={e => setCurrent(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Durum</Label>
                                <Select value={status} onValueChange={(v: ChapterStatus) => setStatus(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="draft">Taslak</SelectItem>
                                        <SelectItem value="revision">Revizyon</SelectItem>
                                        <SelectItem value="completed">Tamamlandı</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Deadline (İsteğe Bağlı)</Label>
                                <Input
                                    type="date"
                                    value={deadline}
                                    onChange={e => setDeadline(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Orta Kısım: Kaynak İlişkilendirme (Sentez) */}
                    <div className="space-y-3 border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-2">
                                <Book className="h-4 w-4 text-indigo-500" />
                                İlişkili Kaynaklar (Sentez)
                                <Badge variant="secondary" className="ml-2">
                                    {linkedReadingIds.length} seçili
                                </Badge>
                            </Label>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Kaynak ara..."
                                className="pl-9 bg-white dark:bg-slate-950"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <ScrollArea className="h-[200px] rounded-md border bg-white dark:bg-slate-950 p-2">
                            {filteredReadings.length === 0 ? (
                                <div className="text-sm text-muted-foreground text-center py-4">
                                    {searchQuery ? "Sonuç bulunamadı." : "Henüz kaynak eklenmemiş."}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredReadings.map(item => {
                                        const isSelected = linkedReadingIds.includes(item.id);
                                        return (
                                            <div
                                                key={item.id}
                                                className={`
                                                    flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors text-sm
                                                    ${isSelected ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800" : "hover:bg-slate-100 dark:hover:bg-slate-800"}
                                                `}
                                                onClick={() => toggleReading(item.id)}
                                            >
                                                <div className={`
                                                    w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0
                                                    ${isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 dark:border-slate-600"}
                                                `}>
                                                    {isSelected && <Check className="h-3 w-3" />}
                                                </div>
                                                <div className="flex-1">
                                                    <div className={`font-medium ${isSelected ? "text-indigo-700 dark:text-indigo-300" : ""}`}>
                                                        {item.title}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground line-clamp-1">
                                                        {item.authors} {item.year && `• ${item.year}`}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    <div className="grid gap-2">
                        <Label>Notlar</Label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Kısa notlar..."
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-h-[100px]"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
                    <Button onClick={handleSave}>Kaydet</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
