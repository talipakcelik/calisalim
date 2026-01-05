import React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Category } from "@/types/tracking";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

export function MobileQuickAdd({
    onQuickStart,
    categories,
}: {
    onQuickStart: (categoryId: string) => void;
    categories: Category[];
}) {
    const [open, setOpen] = React.useState(false);

    const handleCategorySelect = (categoryId: string) => {
        onQuickStart(categoryId);
        setOpen(false);
    };

    return (
        <div className="md:hidden fixed bottom-6 right-6 z-50">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        size="lg"
                        className="h-14 w-14 rounded-full shadow-lg"
                        aria-label="Hızlı oturum başlat"
                    >
                        <Plus className="h-6 w-6" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[50vh]">
                    <SheetHeader>
                        <SheetTitle>Hızlı Başlat</SheetTitle>
                        <SheetDescription>
                            Bir kategori seçerek hemen oturum başlatın
                        </SheetDescription>
                    </SheetHeader>
                    <div className="grid grid-cols-2 gap-3 mt-6">
                        {categories.map((cat) => (
                            <Button
                                key={cat.id}
                                variant="outline"
                                className="h-20 flex-col gap-2"
                                style={{ borderColor: cat.color }}
                                onClick={() => handleCategorySelect(cat.id)}
                            >
                                <div
                                    className="h-4 w-4 rounded-full"
                                    style={{ backgroundColor: cat.color }}
                                />
                                <span className="text-sm font-medium">{cat.name}</span>
                            </Button>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
