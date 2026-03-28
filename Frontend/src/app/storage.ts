export function parseStoredNumber(key: string): number | null {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
        return null;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
}
