import { useEffect, useState } from "react";

export function useOrganizationSelection(
    storageKey: string,
    initialOrganizationId: number | null,
) {
    const [selectedOrganizationId, setSelectedOrganizationId] = useState<
        number | null
    >(initialOrganizationId);

    useEffect(() => {
        if (selectedOrganizationId === null) {
            window.localStorage.removeItem(storageKey);
            return;
        }

        window.localStorage.setItem(storageKey, String(selectedOrganizationId));
    }, [selectedOrganizationId, storageKey]);

    return { selectedOrganizationId, setSelectedOrganizationId };
}
