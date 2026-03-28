import { useEffect, useState } from "react";

export function useThemeMode(storageKey: string) {
    const [themeMode, setThemeMode] = useState<"light" | "dark">(() =>
        window.localStorage.getItem(storageKey) === "light" ? "light" : "dark",
    );

    useEffect(() => {
        window.localStorage.setItem(storageKey, themeMode);
    }, [storageKey, themeMode]);

    return { themeMode, setThemeMode };
}
