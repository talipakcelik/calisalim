import React, { useMemo } from "react";
import { Chapter, ChapterStatus } from "@/types/tracking";
import { DndContext, DragOverlay, useDroppable, DragStartEvent, DragEndEvent, DragOverEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Calendar, Book, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Components ---

function KanbanColumn({
    id,
    title,
    chapters,
    onAddClick,
    onEdit,
    onDelete
}: {
    id: ChapterStatus,
    title: string,
    chapters: Chapter[],
    onAddClick: () => void,
    onEdit: (c: Chapter) => void,
    onDelete: (id: string) => void
}) {
    const { setNodeRef } = useDroppable({ id });

    return (
        <div className="flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2 min-h-[200px] max-h-[500px]">
            <div className="flex items-center justify-between p-2 mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">{title}</h3>
                    <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px]">{chapters.length}</Badge>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onAddClick} className="h-6 w-6">
                    <Plus className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div ref={setNodeRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
                <SortableContext items={chapters.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {chapters.map(chapter => (
                        <ChapterCard key={chapter.id} chapter={chapter} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </SortableContext>
                {chapters.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-8">
                        Buraya suruklein veya + ile ekleyin
                    </div>
                )}
            </div>
        </div>
    );
}

function ChapterCard({ chapter, overlay, onEdit, onDelete }: { chapter: Chapter, overlay?: boolean, onEdit?: (c: Chapter) => void, onDelete?: (id: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: chapter.id,
        data: { chapter }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    // Calculate progress
    const progress = Math.min(100, Math.round((chapter.currentWordCount / (chapter.wordCountGoal || 1)) * 100));
    const isCompleted = chapter.status === "completed";

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none group">
            <Card className={`
                shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing relative
                ${overlay ? 'shadow-xl rotate-2 scale-105' : ''}
                ${isCompleted ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' : ''}
            `}>
                <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                        <h4 className="font-medium text-sm leading-tight text-slate-900 dark:text-slate-100 line-clamp-2 flex-1">
                            {chapter.title}
                        </h4>
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => onEdit?.(chapter)}
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={() => onDelete?.(chapter.id)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{chapter.currentWordCount} / {chapter.wordCountGoal} kelime</span>
                            <span className={progress >= 100 ? "text-emerald-600 font-medium" : ""}>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" indicatorClassName={isCompleted ? "bg-emerald-500" : ""} />
                    </div>

                    <div className="flex items-center justify-between">
                        {chapter.deadline ? (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(chapter.deadline).toLocaleDateString("tr-TR", { day: 'numeric', month: 'short' })}</span>
                            </div>
                        ) : <div></div>}

                        {chapter.linkedReadingIds && chapter.linkedReadingIds.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-md">
                                <Book className="h-3 w-3" />
                                <span className="font-medium">{chapter.linkedReadingIds.length}</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


export function ChapterBoard({
    chapters,
    onUpdateChapter,
    onChapterClick,
    onDeleteChapter
}: {
    chapters: Chapter[];
    onUpdateChapter: (chapter: Chapter) => void;
    onChapterClick: (chapter: Chapter) => void;
    onDeleteChapter?: (id: string) => void;
}) {
    const [activeId, setActiveId] = React.useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const columns: Record<ChapterStatus, Chapter[]> = useMemo(() => {
        const cols: Record<ChapterStatus, Chapter[]> = {
            draft: [],
            revision: [],
            completed: []
        };
        chapters.forEach(c => {
            if (cols[c.status]) cols[c.status].push(c);
        });
        return cols;
    }, [chapters]);

    const activeDist = activeId ? chapters.find(c => c.id === activeId) : null;

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        // Optional: Reordering visualization during drag
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const overId = over.id as string;

            if (["draft", "revision", "completed"].includes(overId)) {
                const chapter = chapters.find(c => c.id === active.id);
                if (chapter && chapter.status !== overId) {
                    onUpdateChapter({ ...chapter, status: overId as ChapterStatus });
                }
            }
        }
        setActiveId(null);
    };

    const handleDelete = (id: string) => {
        if (onDeleteChapter) {
            onDeleteChapter(id);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KanbanColumn
                    id="draft"
                    title="Taslak"
                    chapters={columns.draft}
                    onAddClick={() => onChapterClick({ status: 'draft' } as any)}
                    onEdit={onChapterClick}
                    onDelete={handleDelete}
                />
                <KanbanColumn
                    id="revision"
                    title="Revizyon"
                    chapters={columns.revision}
                    onAddClick={() => onChapterClick({ status: 'revision' } as any)}
                    onEdit={onChapterClick}
                    onDelete={handleDelete}
                />
                <KanbanColumn
                    id="completed"
                    title="Tamamlandi"
                    chapters={columns.completed}
                    onAddClick={() => onChapterClick({ status: 'completed' } as any)}
                    onEdit={onChapterClick}
                    onDelete={handleDelete}
                />
            </div>

            <DragOverlay>
                {activeDist ? <ChapterCard chapter={activeDist} overlay /> : null}
            </DragOverlay>
        </DndContext>
    );
}
