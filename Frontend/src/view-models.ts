import type { OrganizationSummary } from "./types";

export type OrganizationSection = "projects" | "users" | "settings";
export type ProjectSection = "board" | "tasks" | "bugs" | "history" | "settings";

export type NavItem<T extends string> = {
    id: T;
    label: string;
    description: string;
};

export type { OrganizationSummary };
