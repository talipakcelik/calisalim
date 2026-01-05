import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, Maximize2, Minimize2, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea'; // Assuming we have this or use native

export function Scratchpad() {
    const [isOpen, setIsOpen] = useState(false);
    const [content, setContent] = useState("");
    const [minimized, setMinimized] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('scratchpad-content');
        if (saved) setContent(saved);
        const savedState = localStorage.getItem('scratchpad-open');
        if (savedState === 'true') setIsOpen(true);
    }, []);

    // Save to local storage on change
    useEffect(() => {
        localStorage.setItem('scratchpad-content', content);
    }, [content]);

    useEffect(() => {
        localStorage.setItem('scratchpad-open', isOpen.toString());
    }, [isOpen]);

    if (!isOpen) {
        return (
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    size="lg"
                    className="h-14 w-14 rounded-full shadow-xl bg-amber-400 hover:bg-amber-500 text-amber-950 border-4 border-white dark:border-slate-900"
                    onClick={() => setIsOpen(true)}
                    title="Hızlı Notlar (Scratchpad)"
                >
                    <Lightbulb className="h-6 w-6" />
                </Button>
            </div>
        );
    }

    if (minimized) {
        return (
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    variant="outline"
                    className="h-12 shadow-lg bg-background border-amber-400 border-2"
                    onClick={() => setMinimized(false)}
                >
                    <Lightbulb className="h-4 w-4 mr-2 text-amber-500" />
                    <span className="max-w-[100px] truncate text-xs">{content || "Not defteri..."}</span>
                </Button>
            </div>
        );
    }

    return (
        <Card className="fixed bottom-6 right-6 z-50 w-80 shadow-2xl border-amber-200 dark:border-amber-900/50 bg-amber-50/95 dark:bg-slate-900/95 backdrop-blur-sm animate-in slide-in-from-bottom-10 fade-in">
            <CardHeader className="p-3 pb-0 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-900 dark:text-amber-100">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Hızlı Fikirler
                </CardTitle>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={() => setMinimized(true)}>
                        <Minimize2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={() => setIsOpen(false)}>
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-3">
                <textarea
                    className="w-full min-h-[200px] resize-none bg-transparent border-none focus:ring-0 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                    placeholder="Aklına gelen fikri buraya yaz..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    autoFocus
                />
                <div className="text-[10px] text-muted-foreground text-right mt-1">
                    Otomatik kaydediliyor
                </div>
            </CardContent>
        </Card>
    );
}
