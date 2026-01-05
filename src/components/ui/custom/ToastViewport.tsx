import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";
export type ToastItem = { id: string; type: ToastType; title?: string; message: string; actionLabel?: string; actionId?: string };

export function ToastViewport({
    toasts,
    remove,
    onAction,
}: {
    toasts: ToastItem[];
    remove: (id: string) => void;
    onAction: (actionId: string) => void;
}) {
    return (
        <div className="fixed top-4 right-4 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] space-y-2">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className="rounded-2xl border bg-white dark:bg-slate-950 shadow-lg p-3 flex gap-3 items-start"
                    role="status"
                    aria-live="polite"
                >
                    <div className="mt-0.5">
                        {t.type === "success" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : t.type === "error" ? (
                            <AlertTriangle className="h-5 w-5 text-rose-600" />
                        ) : (
                            <Info className="h-5 w-5 text-slate-600" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        {t.title ? <div className="font-semibold text-sm">{t.title}</div> : null}
                        <div className="text-sm text-slate-600 dark:text-slate-300">{t.message}</div>

                        {t.actionLabel && t.actionId ? (
                            <div className="mt-2">
                                <button
                                    className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline"
                                    onClick={() => onAction(t.actionId!)}
                                    type="button"
                                >
                                    {t.actionLabel}
                                </button>
                            </div>
                        ) : null}
                    </div>

                    <button
                        onClick={() => remove(t.id)}
                        className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500"
                        aria-label="Kapat"
                        type="button"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
