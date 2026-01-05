import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Loader2, Plus, BookOpen, Trash2, Link } from "lucide-react";
import { ReadingItem, ReadingStatus, ReadingType, ReadingNote, Chapter } from "@/types/tracking";
import { parseTags, uid } from "@/lib/helpers";
import { ToastType } from "@/components/ui/custom/ToastViewport";
import { Badge } from "@/components/ui/badge";

function normalizeDoi(input: string) {
    const raw = input.trim();
    if (!raw) return "";
    return raw
        .replace(/^doi:\s*/i, "")
        .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
        .trim();
}

function extractBibtexField(text: string, key: string) {
    const re = new RegExp(`${key}\\s*=\\s*(\\{([^}]*)\\}|"([^"]*)")`, "i");
    const m = text.match(re);
    if (!m) return "";
    return (m[2] ?? m[3] ?? "").trim();
}

function mapBibtexTypeToReadingType(entryType: string): ReadingType {
    const t = (entryType || "").toLowerCase();
    if (t === "book") return "book";
    if (t === "incollection" || t === "inbook" || t === "bookchapter" || t === "chapter") return "chapter";
    if (t === "phdthesis" || t === "mastersthesis" || t === "thesis") return "thesis";
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
    const dateStr =
        message?.created?.["date-time"] ||
        message?.published?.["date-time"] ||
        message?.issued?.["date-time"] ||
        message?.["published-online"]?.["date-time"] ||
        "";
    const m = String(dateStr).match(/(\d{4})/);
    return m ? m[1] : "";
}

export function ReadingDialog({
    isOpen,
    onOpenChange,
    initialData,
    chapters = [],
    onSave,
    toast,
}: {
    isOpen: boolean;
    onOpenChange: (o: boolean) => void;
    initialData?: ReadingItem | null;
    chapters?: Chapter[];
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
    const [structuredNotes, setStructuredNotes] = useState<ReadingNote[]>([]);
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
            setStructuredNotes(initialData.structuredNotes || []);
        } else {
            setForm({ title: "", authors: "", year: "", type: "book", status: "to_read", tags: "", url: "", doi: "", notes: "" });
            setStructuredNotes([]);
            setShowBibtexInput(false);
            setBibtexInput("");
        }
    }, [isOpen, initialData]);

    const handleFetchDoi = async () => {
        const doiNorm = normalizeDoi(form.doi);
        if (!doiNorm) {
            toast("error", "Lutfen bir DOI girin.", "DOI Hatasi");
            return;
        }
        setIsFetchingDoi(true);
        try {
            const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doiNorm)}`);
            if (!response.ok) throw new Error("Kaynak bulunamadi");
            const data = await response.json();
            const item = data.message;
            const title = Array.isArray(item.title) ? item.title[0] : item.title || "";
            const authors = item.author ? item.author.map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).filter(Boolean).join(", ") : "";
            const year = pickYearFromCrossref(item);
            if (!title) throw new Error("Baslik bulunamadi");
            const crossrefUrl = item.URL || (doiNorm ? `https://doi.org/${doiNorm}` : "");
            setForm((prev) => ({
                ...prev,
                title,
                authors: authors || prev.authors,
                year: year || prev.year,
                doi: doiNorm,
                url: prev.url || crossrefUrl,
            }));
            toast("success", "Bilgiler cekildi.");
        } catch (err: any) {
            toast("error", err.message || "DOI cekilemedi.", "Hata");
        } finally {
            setIsFetchingDoi(false);
        }
    };

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
            toast("success", "BibTeX ice aktarildi.");
            setShowBibtexInput(false);
            setBibtexInput("");
        } else {
            toast("error", "Gecerli bir BibTeX formati bulunamadi.", "Hata");
        }
    };

    const save = () => {
        if (!form.title.trim()) {
            toast("error", "Baslik bos olamaz.", "Hata");
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
            structuredNotes: structuredNotes.length > 0 ? structuredNotes : undefined,
        };
        onSave(item);
        toast("success", initialData ? "Kaynak guncellendi." : "Kaynak eklendi.");
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Kaynagi Duzenle" : "Yeni Kaynak Ekle"}</DialogTitle>
                    <DialogDescription>Okudugun kitap/makaleyi kutuphanene ekle.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowBibtexInput(!showBibtexInput)}>
                            <Database className="mr-2 h-4 w-4" /> {showBibtexInput ? "BibTeX Gizle" : "BibTeX Yapistir"}
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
                                    Iptal
                                </Button>
                                <Button type="button" onClick={handleImportBibtex}>
                                    Ice Aktar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Baslik */}
                            <div className="space-y-1.5">
                                <Label>Baslik *</Label>
                                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Orn: Debt (Graeber)" />
                            </div>

                            {/* DOI */}
                            <div className="space-y-1.5">
                                <Label>DOI</Label>
                                <div className="flex gap-2">
                                    <Input className="flex-1" value={form.doi} onChange={(e) => setForm((p) => ({ ...p, doi: e.target.value }))} placeholder="10.1080/..." />
                                    <Button type="button" variant="secondary" onClick={handleFetchDoi} disabled={isFetchingDoi}>
                                        {isFetchingDoi ? <Loader2 className="h-4 w-4 animate-spin" /> : "Getir"}
                                    </Button>
                                </div>
                            </div>

                            {/* Yazar ve Yil */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Yazar(lar)</Label>
                                    <Input value={form.authors} onChange={(e) => setForm((p) => ({ ...p, authors: e.target.value }))} placeholder="David Graeber" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Yil</Label>
                                    <Input value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} placeholder="2011" />
                                </div>
                            </div>

                            {/* Tur ve Durum */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Tur</Label>
                                    <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as ReadingType }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="book">Kitap</SelectItem>
                                            <SelectItem value="article">Makale</SelectItem>
                                            <SelectItem value="chapter">Kitap Bolumu</SelectItem>
                                            <SelectItem value="thesis">Tez</SelectItem>
                                            <SelectItem value="other">Diger</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Durum</Label>
                                    <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ReadingStatus }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="to_read">Okunacak</SelectItem>
                                            <SelectItem value="reading">Okunuyor</SelectItem>
                                            <SelectItem value="done">Bitti</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Etiketler */}
                            <div className="space-y-1.5">
                                <Label>Etiketler</Label>
                                <Input value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} placeholder="virgulle ayir: antropoloji, emek" />
                            </div>

                            {/* Link */}
                            <div className="space-y-1.5">
                                <Label>Link</Label>
                                <Input value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} placeholder="https://..." />
                            </div>

                            {/* Notlar */}
                            <div className="space-y-1.5">
                                <Label>Notlar</Label>
                                <textarea
                                    className="w-full min-h-[60px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-sm"
                                    value={form.notes}
                                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                                    placeholder="Genel ozet..."
                                />
                            </div>

                            {/* Bolum Baglantili Notlar */}
                            <div className="space-y-3 border rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50">
                                <div className="flex items-center justify-between">
                                    <Label className="flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-indigo-500" />
                                        Bolum Notlari
                                        <Badge variant="secondary" className="ml-1">{structuredNotes.length}</Badge>
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setStructuredNotes(prev => [
                                                ...prev,
                                                { id: uid(), content: "", createdAt: Date.now() }
                                            ]);
                                        }}
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Ekle
                                    </Button>
                                </div>

                                {structuredNotes.length === 0 ? (
                                    <div className="text-xs text-muted-foreground text-center py-2">
                                        Bolum baglantili not yok.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {structuredNotes.map((note) => (
                                            <div key={note.id} className="space-y-1.5 p-2 bg-white dark:bg-slate-950 rounded-lg border">
                                                <div className="flex items-center gap-2">
                                                    <Select
                                                        value={note.linkedChapterId || "none"}
                                                        onValueChange={(v) => {
                                                            setStructuredNotes(prev => prev.map(n =>
                                                                n.id === note.id ? { ...n, linkedChapterId: v === "none" ? undefined : v } : n
                                                            ));
                                                        }}
                                                    >
                                                        <SelectTrigger className="flex-1 h-8 text-xs">
                                                            <Link className="h-3 w-3 mr-1 text-indigo-500" />
                                                            <SelectValue placeholder="Bolum sec..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Bolum yok</SelectItem>
                                                            {chapters.map(ch => (
                                                                <SelectItem key={ch.id} value={ch.id}>{ch.title}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                                        onClick={() => {
                                                            setStructuredNotes(prev => prev.filter(n => n.id !== note.id));
                                                        }}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <textarea
                                                    className="w-full min-h-[40px] rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2 text-xs"
                                                    value={note.content}
                                                    onChange={(e) => {
                                                        setStructuredNotes(prev => prev.map(n =>
                                                            n.id === note.id ? { ...n, content: e.target.value } : n
                                                        ));
                                                    }}
                                                    placeholder="Alinti, sayfa no..."
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
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
