import React from "react";
import { Reminder } from "@/types/tracking";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { X, Flame, Clock, Moon, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReminderPanel({
    reminders,
    onDismiss
}: {
    reminders: Reminder[];
    onDismiss: (id: string) => void;
}) {
    if (!reminders.length) return null;

    const getIcon = (type: Reminder["type"]) => {
        switch (type) {
            case "streak": return <Flame className="h-4 w-4 text-orange-500" />;
            case "deadline": return <Clock className="h-4 w-4 text-red-500" />;
            case "inactive": return <Moon className="h-4 w-4 text-indigo-500" />;
            case "milestone": return <Flag className="h-4 w-4 text-emerald-500" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-2 mb-6">
            {reminders.map(rem => (
                <Alert key={rem.id} className="relative bg-white dark:bg-slate-900 border-l-4 border-l-primary shadow-sm">
                    {getIcon(rem.type)}
                    <AlertTitle className="ml-2 font-semibold">Hatırlatıcı</AlertTitle>
                    <AlertDescription className="ml-2 pr-8">
                        {rem.message}
                    </AlertDescription>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => onDismiss(rem.id)}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </Alert>
            ))}
        </div>
    );
}
