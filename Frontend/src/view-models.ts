import type { OrganizationSummary, ProjectRole, User } from "./types";

export type TopView = "organizations" | "profile";
export type OrganizationSection = "projects" | "users" | "settings";
export type ProjectSection = "board" | "bugs" | "tasks" | "settings";

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
