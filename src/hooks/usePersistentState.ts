import { useEffect, useState } from "react";

export function usePersistentState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
    const [state, setState] = useState<T>(initialValue);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const stored = window.localStorage.getItem(key);
            if (stored) setState(JSON.parse(stored));
        } catch {
            // ignore
        } finally {
            setHydrated(true);
        }
    }, [key]);

    useEffect(() => {
        if (!hydrated || typeof window === "undefined") return;
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch {
            // ignore
        }
    }, [key, state, hydrated]);

    return [state, setState, hydrated];
}
