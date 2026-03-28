import { useEffect, useState } from "react";

export function useProjectSelection(
    storageKey: string,
    initialProjectId: number | null,
) {
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
        initialProjectId,
    );

    useEffect(() => {
        if (selectedProjectId === null) {
            window.localStorage.removeItem(storageKey);
            return;
        }

        window.localStorage.setItem(storageKey, String(selectedProjectId));
    }, [selectedProjectId, storageKey]);

    return { selectedProjectId, setSelectedProjectId };
}
