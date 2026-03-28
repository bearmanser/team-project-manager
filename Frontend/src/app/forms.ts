import type {
    BacklogPlacement,
    BugStatus,
    OrganizationSummary,
    PriorityLevel,
    ProjectDetail,
    TaskStatus,
} from "../types";

export const initialSignupForm = {
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
};

export const initialLoginForm = {
    identifier: "",
    password: "",
};

export const initialOrganizationForm = {
    name: "",
    description: "",
};

export const initialProjectForm = {
    name: "",
    description: "",
    repositoryId: "",
};

export const initialTaskForm = {
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium" as PriorityLevel,
    placement: "product" as BacklogPlacement,
    bugReportId: null as number | null,
    bugReportTitle: "",
    markAsResolution: false,
};

export const initialBugForm = {
    title: "",
    description: "",
    status: "open" as BugStatus,
    priority: "medium" as PriorityLevel,
};

export type OrganizationSettingsForm = {
    name: string;
};

export function getOrganizationSettingsForm(
    organization: OrganizationSummary,
): OrganizationSettingsForm {
    return {
        name: organization.name,
    };
}

export type ProjectSettingsForm = {
    name: string;
    description: string;
    useSprints: boolean;
};

export function getProjectSettingsForm(
    project: ProjectDetail,
): ProjectSettingsForm {
    return {
        name: project.name,
        description: project.description,
        useSprints: project.useSprints,
    };
}
