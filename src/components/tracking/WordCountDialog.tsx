import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** ========= YENİ: Word Count Dialog ========= */
export function WordCountDialog({
    isOpen,
    onOpenChange,
    initialCount,
    dateStr,
    onSave,
}: {
    isOpen: boolean;
    onOpenChange: (o: boolean) => void;
    initialCount: number;
    dateStr: string;
    onSave: (count: number, note: string) => void;
}) {
    const [count, setCount] = useState(initialCount);
    const [note, setNote] = useState("");

    useEffect(() => {
        if (isOpen) {
            setCount(initialCount);
            setNote("");
        }
    }, [isOpen, initialCount]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Günlük Kelime Girişi</DialogTitle>
                    <DialogDescription>{dateStr}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Kelime Sayısı</Label>
                        <Input
                            type="number"
                            value={count}
                            onChange={(e) => setCount(Number(e.target.value))}
                            className="text-2xl font-bold h-12"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Not (Opsiyonel)</Label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Örn: Giriş bölümü revize edildi"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => { onSave(count, note); onOpenChange(false); }}>Kaydet</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
