import type { DeleteProjectResponse, ProjectResponse } from "../../types";
import { request } from "../../api/client";

export function getProject(
    token: string,
    projectId: number,
): Promise<ProjectResponse> {
    return request<ProjectResponse>(`/api/projects/${projectId}/`, {}, token);
}

export function createProject(
    token: string,
    payload: {
        organizationId: number;
        name: string;
        description: string;
        repositoryId?: string;
    },
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
    payload: {
        reviewText: string;
        unfinishedAction?: "done" | "carryover" | "product";
    },
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

export function deleteProject(
    token: string,
    projectId: number,
): Promise<DeleteProjectResponse> {
    return request<DeleteProjectResponse>(
        `/api/projects/${projectId}/delete/`,
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
    payload: {
        title: string;
        description: string;
        status: string;
        priority: string;
    },
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
    payload: {
        body: string;
        anchorType?: string;
        anchorId?: string;
        anchorLabel?: string;
    },
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
    payload: {
        body: string;
        anchorType?: string;
        anchorId?: string;
        anchorLabel?: string;
    },
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
