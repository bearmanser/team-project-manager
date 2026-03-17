import type { OrganizationSummary, ProjectRole, User } from "./types";

export type OrganizationSection = "projects" | "users" | "settings";
export type ProjectSection = "board" | "tasks" | "bugs" | "settings";

export type OrganizationUser = {
    id: number;
    user: User;
    projectNames: string[];
    roles: ProjectRole[];
};

export type NavItem<T extends string> = {
    id: T;
    label: string;
    description: string;
};

export type { OrganizationSummary };
