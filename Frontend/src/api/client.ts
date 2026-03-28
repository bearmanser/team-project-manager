export const AUTH_TOKEN_INVALID_EVENT = "team-project-manager:auth-token-invalid";

type AuthTokenInvalidEventDetail = {
    message: string;
};

function resolveApiBaseUrl(): string {
    const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "")
        .trim()
        .replace(/\/$/, "");
    if (configuredBaseUrl) {
        return configuredBaseUrl;
    }

    if (typeof window === "undefined") {
        return "";
    }

    const hostname = window.location.hostname.toLowerCase();
    if (
        hostname === "grinderstudio.no" ||
        hostname === "www.grinderstudio.no"
    ) {
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

function isAuthTokenInvalidError(
    status: number,
    payload: unknown,
): payload is { error: string } {
    if (status !== 401 || typeof payload !== "object" || payload === null) {
        return false;
    }

    return (payload as { error?: unknown }).error === "Invalid or expired token.";
}

function notifyAuthTokenInvalid(detail: AuthTokenInvalidEventDetail): void {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(
        new CustomEvent<AuthTokenInvalidEventDetail>(AUTH_TOKEN_INVALID_EVENT, {
            detail,
        }),
    );
}

function getApiErrorMessage(payload: unknown): string | null {
    if (typeof payload !== "object" || payload === null) {
        return null;
    }

    return typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : null;
}

export async function request<T>(
    path: string,
    options: RequestInit = {},
    token?: string,
): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    if (
        options.body &&
        !headers.has("Content-Type") &&
        !(options.body instanceof FormData)
    ) {
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
    let payload: unknown = {};

    if (rawBody) {
        try {
            payload = JSON.parse(rawBody);
        } catch {
            const contentType =
                response.headers.get("content-type")?.toLowerCase() ?? "";
            const looksLikeHtml =
                contentType.includes("text/html") || /^\s*</.test(rawBody);
            const message = looksLikeHtml
                ? "The server returned HTML instead of JSON. Check the API base URL and deployment rewrites."
                : "The server returned an invalid JSON response.";
            throw new ApiError(message, response.status);
        }
    }

    if (!response.ok) {
        if (isAuthTokenInvalidError(response.status, payload)) {
            notifyAuthTokenInvalid({ message: payload.error });
        }

        throw new ApiError(
            getApiErrorMessage(payload) ?? "Request failed.",
            response.status,
        );
    }

    return payload as T;
}
