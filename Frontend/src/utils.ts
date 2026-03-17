import type { CSSProperties } from "react";

export const nativeSelectStyle: CSSProperties = {
    width: "100%",
    border: "1px solid #2b3544",
    background: "#0f141b",
    color: "#f5f7fb",
    padding: "10px 12px",
    borderRadius: "10px",
    outline: "none",
    appearance: "none",
};

export const sidebarSelectStyle: CSSProperties = {
    width: "100%",
    border: "0",
    borderBottom: "1px solid #344053",
    background: "transparent",
    color: "#f5f7fb",
    padding: "0 28px 10px 0",
    borderRadius: "0",
    outline: "none",
    appearance: "none",
    backgroundImage:
        'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27 fill=%27none%27%3E%3Cpath d=%27M2.25 4.5L6 8.25L9.75 4.5%27 stroke=%27%2390a0b7%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E")',
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right center",
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
