"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { value?: number | null; indicatorClassName?: string }
>(({ className, value, indicatorClassName, ...props }, ref) => {
    const percent = Math.min(100, Math.max(0, value || 0));

    return (
        <div
            ref={ref}
            className={cn(
                "relative h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
                className
            )}
            {...props}
        >
            <div
                className={cn("h-full w-full flex-1 bg-slate-900 transition-all dark:bg-slate-50", indicatorClassName)}
                style={{ transform: `translateX(-${100 - percent}%)` }}
            />
        </div>
    )
})
Progress.displayName = "Progress"

export { Progress }
