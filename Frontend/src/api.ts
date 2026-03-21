import type {
    AuthResponse,
    DeleteProjectResponse,
    GitHubConnectResponse,
    GitHubOAuthStartResponse,
    NotificationResponse,
    OrganizationResponse,
    ProjectGitHubIssuesResponse,
    ProjectResponse,
    UserResponse,
    WorkspaceResponse,
} from "./types";

function resolveApiBaseUrl(): string {
    const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");
    if (configuredBaseUrl) {
        return configuredBaseUrl;
    }

    if (typeof window === "undefined") {
        return "";
    }

    const hostname = window.location.hostname.toLowerCase();
    if (hostname === "grinderstudio.no" || hostname === "www.grinderstudio.no") {
        return "https://team-project-manager-api.grinderstudio.no";
    }

    return "";
}

const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export function buildApiUrl(path: string): string {
    return `${API_BASE_URL}${path}`;
}

async function request<T>(
    path: string,
    options: RequestInit = {},
    token?: string,
): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(buildApiUrl(path), {
        ...options,
        headers,
    });

    const rawBody = await response.text();
    const payload = rawBody ? JSON.parse(rawBody) : {};

    if (!response.ok) {
        throw new ApiError(payload.error ?? "Request failed.", response.status);
    }

    return payload as T;
}

export function signup(payload: {
    username: string;
    email: string;
    password: string;
}): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/signup/", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export function login(payload: {
    identifier: string;
    password: string;
}): Promise<AuthResponse> {
    return request<AuthResponse>("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export function getCurrentUser(token: string): Promise<UserResponse> {
    return request<UserResponse>("/api/auth/me/", {}, token);
}

export function getWorkspace(token: string): Promise<WorkspaceResponse> {
    return request<WorkspaceResponse>("/api/workspace/", {}, token);
}

export function createOrganization(
    token: string,
    payload: { name: string; description: string },
): Promise<OrganizationResponse> {
    return request<OrganizationResponse>(
        "/api/organizations/",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function getProject(token: string, projectId: number): Promise<ProjectResponse> {
    return request<ProjectResponse>(`/api/projects/${projectId}/`, {}, token);
}

export function createProject(
    token: string,
    payload: { organizationId: number; name: string; description: string; repositoryId?: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        "/api/projects/",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function updateProjectSettings(
    token: string,
    projectId: number,
    payload: { name: string; description: string; useSprints: boolean },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/settings/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function endProjectSprint(
    token: string,
    projectId: number,
    payload: { reviewText: string; unfinishedAction?: "done" | "carryover" | "product" },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/sprints/end/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function updateProjectSprint(
    token: string,
    projectId: number,
    sprintId: number,
    payload: { name: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/sprints/${sprintId}/update/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function deleteProject(token: string, projectId: number): Promise<DeleteProjectResponse> {
    return request<DeleteProjectResponse>(
        `/api/projects/${projectId}/delete/`,
        {
            method: "POST",
        },
        token,
    );
}

export function addProjectRepos(
    token: string,
    projectId: number,
    payload: { repositoryId: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/repos/add/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function removeProjectRepo(
    token: string,
    projectId: number,
    repositoryId: number,
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/repos/${repositoryId}/remove/`,
        {
            method: "POST",
        },
        token,
    );
}

export function addProjectMember(
    token: string,
    projectId: number,
    payload: { identifier: string; role: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/members/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function updateProjectMemberRole(
    token: string,
    projectId: number,
    membershipId: number,
    payload: { role: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/members/${membershipId}/role/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function removeProjectMember(
    token: string,
    projectId: number,
    membershipId: number,
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/members/${membershipId}/remove/`,
        {
            method: "POST",
        },
        token,
    );
}

export function createTask(
    token: string,
    projectId: number,
    payload: {
        title: string;
        description: string;
        status: string;
        priority: string;
        placement?: "sprint" | "product";
        assigneeIds: number[];
        bugReportId?: number;
        markAsResolution?: boolean;
    },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/tasks/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function createBugReport(
    token: string,
    projectId: number,
    payload: { title: string; description: string; status: string; priority: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/bugs/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function getProjectGitHubIssues(
    token: string,
    projectId: number,
): Promise<ProjectGitHubIssuesResponse> {
    return request<ProjectGitHubIssuesResponse>(`/api/projects/${projectId}/github-issues/`, {}, token);
}

export function importBugFromGitHubIssue(
    token: string,
    projectId: number,
    payload: {
        repositoryFullName: string;
        issueNumber: number;
    },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/projects/${projectId}/bugs/import/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function updateTask(
    token: string,
    taskId: number,
    payload: Partial<{
        title: string;
        description: string;
        status: string;
        priority: string;
        placement: "sprint" | "product";
        assigneeIds: number[];
        resolvedBugIds: number[];
    }>,
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/tasks/${taskId}/update/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function addTaskComment(
    token: string,
    taskId: number,
    payload: { body: string; anchorType?: string; anchorId?: string; anchorLabel?: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/tasks/${taskId}/comments/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function toggleTaskCommentReaction(
    token: string,
    commentId: number,
    payload: { emoji: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/task-comments/${commentId}/reactions/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function addTaskIssueLink(
    token: string,
    taskId: number,
    payload: {
        repositoryFullName?: string;
        issueNumber?: number;
        issueUrl?: string;
    },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/tasks/${taskId}/issues/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function createTaskBranch(
    token: string,
    taskId: number,
    payload: {
        repositoryId?: number;
        branchName?: string;
        baseBranch?: string;
    },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/tasks/${taskId}/branch/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function updateBugReport(
    token: string,
    bugId: number,
    payload: Partial<{
        title: string;
        description: string;
        status: string;
        priority: string;
    }>,
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/bugs/${bugId}/update/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function addBugComment(
    token: string,
    bugId: number,
    payload: { body: string; anchorType?: string; anchorId?: string; anchorLabel?: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/bugs/${bugId}/comments/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function toggleBugCommentReaction(
    token: string,
    commentId: number,
    payload: { emoji: string },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/bug-comments/${commentId}/reactions/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function addBugIssueLink(
    token: string,
    bugId: number,
    payload: {
        repositoryFullName?: string;
        issueNumber?: number;
        issueUrl?: string;
    },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/bugs/${bugId}/issues/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function setBugResolutionTask(
    token: string,
    bugId: number,
    payload: { taskId?: number | null },
): Promise<ProjectResponse> {
    return request<ProjectResponse>(
        `/api/bugs/${bugId}/resolution/`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

export function markNotificationRead(
    token: string,
    notificationId: number,
): Promise<NotificationResponse> {
    return request<NotificationResponse>(
        `/api/notifications/${notificationId}/read/`,
        {
            method: "POST",
        },
        token,
    );
}

export function startGitHubOauth(token: string): Promise<GitHubOAuthStartResponse> {
    return request<GitHubOAuthStartResponse>("/api/github/oauth/start/", {}, token);
}

export function completeGitHubOauth(
    token: string,
    payload: { code: string; state: string },
): Promise<GitHubConnectResponse> {
    return request<GitHubConnectResponse>(
        "/api/github/oauth/complete/",
        {
            method: "POST",
            body: JSON.stringify(payload),
        },
        token,
    );
}

