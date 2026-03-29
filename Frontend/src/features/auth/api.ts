import type { AuthResponse, UserResponse, WorkspaceResponse } from "../../types";
import { request } from "../../api/client";

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

export function logout(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>("/api/auth/logout/", {
        method: "POST",
    });
}

export function getCurrentUser(token: string): Promise<UserResponse> {
    return request<UserResponse>("/api/auth/me/", {}, token);
}

export function getWorkspace(token: string): Promise<WorkspaceResponse> {
    return request<WorkspaceResponse>("/api/workspace/", {}, token);
}
