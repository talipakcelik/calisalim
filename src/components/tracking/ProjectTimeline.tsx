import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Chapter } from '@/types/tracking';
import { Calendar, ChevronRight } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export function ProjectTimeline({ chapters }: { chapters: Chapter[] }) {
    // Sort chapters by deadline or order if no deadline
    const sortedChapters = useMemo(() => {
        return [...chapters].sort((a, b) => {
            if (a.deadline && b.deadline) return a.deadline - b.deadline;
            if (a.deadline) return -1;
            if (b.deadline) return 1;
            return a.order - b.order;
        });
    }, [chapters]);

    // If no chapters have deadline, show a message
    const hasDeadlines = chapters.some(c => c.deadline);

    if (!hasDeadlines && chapters.length === 0) {
        return null;
    }

    const today = new Date();

    return (
        <Card className="mb-6 shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Zaman Çizelgesi
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!hasDeadlines ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                        Henüz hiçbir bölüm için tarih (deadline) belirlemediniz. Bölümleri düzenleyerek tarih ekleyebilirsiniz.
                    </div>
                ) : (
                    <ScrollArea className="w-full whitespace-nowrap pb-2">
                        <div className="flex items-start gap-4 min-w-max p-1">
                            {sortedChapters.map((chapter, index) => {
                                if (!chapter.deadline) return null;

                                const date = new Date(chapter.deadline);
                                const isPast = date < today;
                                const isCompleted = chapter.status === 'completed';

                                return (
                                    <div key={chapter.id} className="relative flex flex-col items-center group">
                                        {/* Line connector */}
                                        {index < sortedChapters.filter(c => c.deadline).length - 1 && (
                                            <div className="absolute top-3 left-[50%] w-full h-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />
                                        )}

                                        <div className={`
                                        w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold z-10 bg-background
                                        ${isCompleted
                                                ? 'border-emerald-500 text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                                : isPast
                                                    ? 'border-rose-400 text-rose-400'
                                                    : 'border-slate-300 text-slate-500'}
                                    `}>
                                            {index + 1}
                                        </div>

                                        <div className="mt-2 text-center w-32">
                                            <div className="text-xs font-medium truncate px-1" title={chapter.title}>
                                                {chapter.title}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {date.toLocaleDateString("tr-TR", { day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
