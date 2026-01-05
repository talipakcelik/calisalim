import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Timer, BookOpen, Pause, Play, Square, Folder } from "lucide-react";
import { Category, ReadingItem, Running, Topic, Project } from "@/types/tracking";
import { fmtCompact, fmtTime } from "@/lib/formatters";

export const ActiveTimer = React.memo(
    ({
        running,
        onStop,
        onPause,
        onResume,
        categoryMap,
        topicMap,
        readingMap,
        projectMap,
        themeColor,
    }: {
        running: Running;
        onStop: () => void;
        onPause: () => void;
        onResume: () => void;
        categoryMap: Map<string, Category>;
        topicMap: Map<string, Topic>;
        readingMap: Map<string, ReadingItem>;
        projectMap?: Map<string, Project>;
        themeColor: string;
    }) => {
        const [now, setNow] = useState(Date.now());

        useEffect(() => {
            const t = setInterval(() => setNow(Date.now()), 1000);
            return () => clearInterval(t);
        }, []);

        const liveActiveMs = useMemo(() => {
            if (running.isPaused) return running.elapsedActiveMs;
            return running.elapsedActiveMs + (now - running.lastStart);
        }, [running, now]);

        const catName = categoryMap.get(running.categoryId)?.name ?? running.categoryId;
        const topicName = running.topicId ? topicMap.get(running.topicId)?.name ?? running.topicId : null;
        const srcTitle = running.sourceId ? readingMap.get(running.sourceId)?.title ?? `Silinmis: ${running.sourceId}` : null;
        const projectTitle = running.projectId && projectMap ? projectMap.get(running.projectId)?.title : null;

        return (
            <Card className="text-white border-none shadow-xl relative overflow-hidden">
                <div
                    className="absolute inset-0"
                    style={{
                        background: `linear-gradient(135deg, ${themeColor} 0%, rgba(15, 23, 42, 1) 70%)`,
                    }}
                />
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                <CardContent className="flex flex-col gap-6 py-8 relative z-10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/10 shadow-inner">
                                <Timer className="h-8 w-8" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-medium text-white/80 flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-white">{catName}</span>

                                    {projectTitle && (
                                        <Badge variant="secondary" className="bg-indigo-500/20 hover:bg-indigo-500/30 text-white border-0">
                                            <Folder className="mr-1 h-3.5 w-3.5" />
                                            {projectTitle}
                                        </Badge>
                                    )}

                                    {topicName && (
                                        <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white border-0">
                                            {topicName}
                                        </Badge>
                                    )}

                                    {srcTitle && (
                                        <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white border-0">
                                            <BookOpen className="mr-1 h-3.5 w-3.5" />
                                            <span className="truncate max-w-[280px]">{srcTitle}</span>
                                        </Badge>
                                    )}

                                    <Badge variant="secondary" className="bg-white/10 hover:bg-white/15 text-white border-0">
                                        {running.label ? running.label : "(etiketsiz)"}
                                    </Badge>

                                    <span className="text-xs text-white/60">• Baslangic: {fmtTime(running.wallStart)}</span>
                                </h3>

                                <div className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight mt-1 font-mono">
                                    {fmtCompact(liveActiveMs)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            {!running.isPaused ? (
                                <Button
                                    size="lg"
                                    variant="secondary"
                                    className="flex-1 sm:flex-none h-14 px-8 text-lg gap-2 shadow-lg hover:scale-105 transition-transform"
                                    onClick={onPause}
                                >
                                    <Pause className="h-6 w-6 fill-current" /> Duraklat
                                </Button>
                            ) : (
                                <Button
                                    size="lg"
                                    className="flex-1 sm:flex-none h-14 px-8 text-lg gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:scale-105 transition-transform border-0"
                                    onClick={onResume}
                                >
                                    <Play className="h-6 w-6 fill-current" /> Devam Et
                                </Button>
                            )}

                            <Button
                                size="lg"
                                variant="destructive"
                                className="flex-1 sm:flex-none h-14 px-8 text-lg gap-2 shadow-lg hover:scale-105 transition-transform"
                                onClick={onStop}
                            >
                                <Square className="h-6 w-6 fill-current" /> Bitir
                            </Button>
                        </div>
                    </div>
                </CardContent>

                {/* Canli animasyon cizgisi */}
                {!running.isPaused && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div className="h-full bg-white/50 animate-[shimmer_2s_infinite]" style={{ width: "30%" }} />
                    </div>
                )}
            </Card>
        );
    }
);

ActiveTimer.displayName = "ActiveTimer";
