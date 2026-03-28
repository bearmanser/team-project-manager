import type {
    GitHubConnectResponse,
    GitHubOAuthStartResponse,
    ProjectGitHubIssuesResponse,
    ProjectResponse,
    UserResponse,
} from "../../types";
import { request } from "../../api/client";

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

export function getProjectGitHubIssues(
    token: string,
    projectId: number,
): Promise<ProjectGitHubIssuesResponse> {
    return request<ProjectGitHubIssuesResponse>(
        `/api/projects/${projectId}/github-issues/`,
        {},
        token,
    );
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

export function startGitHubOauth(
    token: string,
): Promise<GitHubOAuthStartResponse> {
    return request<GitHubOAuthStartResponse>("/api/github/oauth/start/", {}, token);
}

export function disconnectGitHub(token: string): Promise<UserResponse> {
    return request<UserResponse>(
        "/api/github/disconnect/",
        {
            method: "POST",
        },
        token,
    );
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
