import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus, Folder, FileText } from "lucide-react";
import { Category, ReadingItem, Session, Topic, Project, Chapter } from "@/types/tracking";
import { MiniDateTimePicker } from "@/components/ui/custom/MiniDateTimePicker";
import { getCategoryPlaceholder, getUniqueLabelsForCategory } from "@/lib/helpers";
import { ToastType } from "@/components/ui/custom/ToastViewport";

export function SessionDialog({
    isOpen,
    onOpenChange,
    initialData,
    categories,
    topics,
    reading,
    sessions,
    projects = [],
    chapters = [],
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
    projects?: Project[];
    chapters?: Chapter[];
    onSave: (s: Partial<Session>) => void;
    onQuickAddSource: () => void;
    toast: (type: ToastType, message: string, title?: string) => void;
}) {
    const [formData, setFormData] = useState({
        categoryId: "",
        topicId: "",
        sourceId: "",
        projectId: "",
        chapterId: "",
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
                projectId: initialData.projectId ?? "none",
                chapterId: initialData.chapterId ?? "none",
                label: initialData.label,
                startMs: initialData.start,
                endMs: initialData.end,
            });
        } else {
            const now = new Date();
            now.setSeconds(0, 0);
            const nowMs = now.getTime();

            setFormData({
                categoryId: categories[0]?.id || "",
                topicId: "none",
                sourceId: "none",
                projectId: projects[0]?.id || "none",
                chapterId: "none",
                label: "",
                startMs: nowMs - 3600000,
                endMs: nowMs,
            });
        }
    }, [isOpen, initialData, categories, projects]);

    const suggestedLabels = useMemo(() => {
        if (!formData.categoryId) return [];
        return getUniqueLabelsForCategory(sessions, formData.categoryId);
    }, [sessions, formData.categoryId]);

    const selectedCategory = categories.find((c) => c.id === formData.categoryId);
    const placeholder = getCategoryPlaceholder(formData.categoryId, selectedCategory?.name);

    // Filter chapters by selected project
    const filteredChapters = useMemo(() => {
        if (!formData.projectId || formData.projectId === "none") return chapters;
        return chapters.filter(ch => ch.projectId === formData.projectId);
    }, [chapters, formData.projectId]);

    const shiftTime = (amountMinutes: number) => {
        setFormData(prev => {
            const s = new Date(prev.startMs);
            s.setMinutes(s.getMinutes() + amountMinutes);
            s.setSeconds(0, 0);
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
            toast("error", "Lutfen gecerli bir tarih secin.", "Hatali tarih");
            return;
        }
        if (end <= start) {
            toast("error", "Bitis zamani baslangictan sonra olmalidir.", "Hatali zaman araligi");
            return;
        }

        onSave({
            id: initialData?.id,
            categoryId: formData.categoryId,
            topicId: formData.topicId && formData.topicId !== "none" ? formData.topicId : undefined,
            sourceId: formData.sourceId && formData.sourceId !== "none" ? formData.sourceId : undefined,
            projectId: formData.projectId && formData.projectId !== "none" ? formData.projectId : undefined,
            chapterId: formData.chapterId && formData.chapterId !== "none" ? formData.chapterId : undefined,
            label: formData.label,
            start,
            end,
        });

        toast("success", initialData ? "Kayit guncellendi." : "Kayit eklendi.");
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Kaydi Duzenle" : "Manuel Kayit Ekle"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Mevcut calisma kaydini guncelle." : "Gecmise donuk bir calisma kaydi olustur."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Proje ve Bolum */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="flex items-center gap-1.5">
                                <Folder className="h-3.5 w-3.5 text-indigo-500" />
                                Proje
                            </Label>
                            <Select value={formData.projectId} onValueChange={(v) => setFormData((p) => ({ ...p, projectId: v, chapterId: "none" }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Proje sec" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">(Secme)</SelectItem>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-emerald-500" />
                                Bolum
                            </Label>
                            <Select value={formData.chapterId} onValueChange={(v) => setFormData((p) => ({ ...p, chapterId: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Bolum sec" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">(Secme)</SelectItem>
                                    {filteredChapters.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id}>{ch.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator />

                    {/* Kategori */}
                    <div className="space-y-1.5">
                        <Label>Kategori</Label>
                        <Select value={formData.categoryId} onValueChange={(v) => setFormData((p) => ({ ...p, categoryId: v }))}>
                            <SelectTrigger>
                                <SelectValue placeholder="Kategori sec" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Konu */}
                    <div className="space-y-1.5">
                        <Label>Konu (opsiyonel)</Label>
                        <Select value={formData.topicId} onValueChange={(v) => setFormData((p) => ({ ...p, topicId: v }))}>
                            <SelectTrigger>
                                <SelectValue placeholder="(opsiyonel)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">(Secme)</SelectItem>
                                {topics.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Kaynak */}
                    <div className="space-y-1.5">
                        <Label>Kaynak (opsiyonel)</Label>
                        <div className="flex gap-2">
                            <Select value={formData.sourceId} onValueChange={(v) => setFormData((p) => ({ ...p, sourceId: v }))}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Okunan kaynak" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">(Secme)</SelectItem>
                                    {reading.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((r) => (
                                        <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button type="button" variant="outline" className="px-3" onClick={onQuickAddSource} title="Yeni kaynak ekle">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Etiket */}
                    <div className="space-y-1.5">
                        <Label>Etiket</Label>
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

                    <Separator />

                    {/* Tarihler */}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Baslangic</Label>
                            <MiniDateTimePicker
                                valueMs={formData.startMs}
                                onChange={(ms) => setFormData((p) => ({ ...p, startMs: ms }))}
                                label="Baslangic Tarihi ve Saati"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Bitis</Label>
                            <MiniDateTimePicker
                                valueMs={formData.endMs}
                                onChange={(ms) => setFormData((p) => ({ ...p, endMs: ms }))}
                                label="Bitis Tarihi ve Saati"
                            />
                        </div>
                    </div>

                    {/* Hizli Ayarlar */}
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => shiftTime(-15)}>
                            Baslangic -15dk
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => shiftTime(15)}>
                            Baslangic +15dk
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="text-xs" onClick={setEndToNow}>
                            Bitis: Simdi
                        </Button>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
                        Iptal
                    </Button>
                    <Button onClick={handleSave} type="button">
                        Kaydet
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
