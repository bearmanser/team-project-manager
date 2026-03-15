import type {
    AuthResponse,
    GitHubConnectResponse,
    GitHubOAuthStartResponse,
    RepoResponse,
    UserResponse,
} from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

function buildUrl(path: string): string {
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

    const response = await fetch(buildUrl(path), {
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

export function getRepos(token: string): Promise<RepoResponse> {
    return request<RepoResponse>("/api/github/repos/", {}, token);
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
