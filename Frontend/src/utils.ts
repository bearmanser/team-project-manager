import type { CSSProperties } from "react";

import type { BugReport, BugStatus, PriorityLevel, Task, TaskStatus } from "./types";

type ToneStyle = {
    bg: string;
    borderColor: string;
    color: string;
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
};

export const PRIORITY_OPTIONS: PriorityLevel[] = ["low", "medium", "high", "critical"];

export const PRIORITY_STYLES: Record<PriorityLevel, ToneStyle> = {
    low: {
        bg: "#12261f",
        borderColor: "#2f6c58",
        color: "#8de0bb",
    },
    medium: {
        bg: "#2c2411",
        borderColor: "#8f6b25",
        color: "#ffd689",
    },
    high: {
        bg: "#332012",
        borderColor: "#b76a27",
        color: "#ffb775",
    },
    critical: {
        bg: "#34161b",
        borderColor: "#a9465b",
        color: "#ff9db0",
    },
};

export const TASK_STATUS_STYLES: Record<TaskStatus, ToneStyle> = {
    todo: {
        bg: "#182235",
        borderColor: "#4d73b8",
        color: "#c2d7ff",
    },
    in_progress: {
        bg: "#183125",
        borderColor: "#4a9a67",
        color: "#b4f0c9",
    },
    in_review: {
        bg: "#322713",
        borderColor: "#bb8128",
        color: "#ffd794",
    },
    done: {
        bg: "#1a2a22",
        borderColor: "#4f8c73",
        color: "#b8ead1",
    },
};

export const BUG_STATUS_STYLES: Record<BugStatus, ToneStyle> = {
    open: {
        bg: "#34161b",
        borderColor: "#a9465b",
        color: "#ffb1bf",
    },
    investigating: {
        bg: "#332012",
        borderColor: "#b76a27",
        color: "#ffcb93",
    },
    monitoring: {
        bg: "#182235",
        borderColor: "#4d73b8",
        color: "#c2d7ff",
    },
    closed: {
        bg: "#183125",
        borderColor: "#4a9a67",
        color: "#b4f0c9",
    },
};

const PRIORITY_RANK: Record<PriorityLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
};

const SELECT_ARROW =
    'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27 fill=%27none%27%3E%3Cpath d=%27M2.25 4.5L6 8.25L9.75 4.5%27 stroke=%27%2390a0b7%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E")';

function buildSelectStyle(tone?: ToneStyle): CSSProperties {
    return {
        width: "100%",
        border: `1px solid ${tone?.borderColor ?? "var(--color-border-strong)"}`,
        background: tone?.bg ?? "var(--color-bg-muted)",
        color: tone?.color ?? "var(--color-text-primary)",
        padding: "10px 36px 10px 12px",
        borderRadius: "10px",
        outline: "none",
        appearance: "none",
        backgroundImage: SELECT_ARROW,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        fontWeight: 600,
    };
}

export const nativeSelectStyle: CSSProperties = buildSelectStyle();

export const sidebarSelectStyle: CSSProperties = {
    width: "100%",
    border: "0",
    borderBottom: "1px solid var(--color-border-soft)",
    background: "transparent",
    color: "var(--color-text-primary)",
    padding: "0 28px 10px 0",
    borderRadius: "0",
    outline: "none",
    boxShadow: "none",
    appearance: "none",
    backgroundImage: SELECT_ARROW,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right center",
};

export function getPriorityLabel(priority: PriorityLevel): string {
    return PRIORITY_LABELS[priority];
}

export function getPrioritySelectStyle(priority: PriorityLevel): CSSProperties {
    return buildSelectStyle(PRIORITY_STYLES[priority]);
}

export function getTaskStatusSelectStyle(status: TaskStatus): CSSProperties {
    return buildSelectStyle(TASK_STATUS_STYLES[status]);
}

export function getBugStatusSelectStyle(status: BugStatus): CSSProperties {
    return buildSelectStyle(BUG_STATUS_STYLES[status]);
}

export function sortTasksByPriority(tasks: Task[]): Task[] {
    return [...tasks].sort((left, right) => {
        const priorityDelta = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        return right.id - left.id;
    });
}

export function sortBugsByPriority(bugs: BugReport[]): BugReport[] {
    return [...bugs].sort((left, right) => {
        const priorityDelta = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        return right.id - left.id;
    });
}

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
