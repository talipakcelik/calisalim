import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MiniDateTimePicker } from "@/components/ui/custom/MiniDateTimePicker";

/** ========= YENİ: Milestone Dialog ========= */
export function MilestoneDialog({
    isOpen,
    onOpenChange,
    onSave,
}: {
    isOpen: boolean;
    onOpenChange: (o: boolean) => void;
    onSave: (title: string, dateMs: number) => void;
}) {
    const [title, setTitle] = useState("");
    const [dateMs, setDateMs] = useState<number>(Date.now() + 86400000 * 7);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Yeni Kilometre Taşı / Deadline</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Başlık</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn: Taslak Teslimi" />
                    </div>
                    <div className="space-y-2">
                        <Label>Tarih</Label>
                        <MiniDateTimePicker valueMs={dateMs} onChange={setDateMs} label="Teslim Tarihi" />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => { if (title) { onSave(title, dateMs); onOpenChange(false); setTitle(""); } }}>Ekle</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
