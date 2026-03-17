import type { ProjectRole, User } from "./types";

export type TopView = "organizations" | "settings" | "profile";
export type OrganizationSection = "projects" | "users" | "settings";
export type ProjectSection = "board" | "bugs" | "tasks" | "settings";

export type OrganizationSummary = {
    id: string;
    name: string;
    description: string;
    projectCount: number;
    repoCount: number;
    openBugCount: number;
    memberCount: number;
};

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
