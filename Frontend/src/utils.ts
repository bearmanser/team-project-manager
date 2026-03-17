import type { CSSProperties } from "react";

export const nativeSelectStyle: CSSProperties = {
    width: "100%",
    border: "1px solid #2b3544",
    background: "#0f141b",
    color: "#f5f7fb",
    padding: "10px 12px",
    outline: "none",
    appearance: "none",
};

export function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return "Just now";
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export function formatShortDate(value: string | null | undefined): string {
    if (!value) {
        return "Now";
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
    }).format(new Date(value));
}

export function getInitials(name: string): string {
    return name
        .split(/\s+/)
        .map((part) => part[0] ?? "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
