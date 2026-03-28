import type { OrganizationSection, ProjectSection } from "../view-models";
import {
    LOGIN_PATH,
    MARKETING_PATH,
    ORGANIZATIONS_PATH,
    SIGNUP_PATH,
} from "./constants";

export type AppRoute =
    | { kind: "marketing" }
    | { kind: "signup" }
    | { kind: "organizations" }
    | {
          kind: "organization";
          organizationId: number;
          section: OrganizationSection;
      }
    | { kind: "project"; projectId: number; section: ProjectSection }
    | { kind: "githubCallback" };

export function normalizePath(pathname: string): string {
    if (!pathname || pathname === "/") {
        return "/";
    }

    return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function normalizeBasePath(pathname: string): string {
    const normalizedPath = normalizePath(pathname);
    return normalizedPath === "/" ? "/" : `${normalizedPath}/`;
}

const APP_BASE_URL = normalizeBasePath(import.meta.env.BASE_URL ?? "/");
const APP_BASE_PATH = APP_BASE_URL === "/" ? "" : APP_BASE_URL.slice(0, -1);

export function stripAppBasePath(pathname: string): string {
    const normalizedPath = normalizePath(pathname);
    if (!APP_BASE_PATH) {
        return normalizedPath;
    }

    if (normalizedPath === APP_BASE_PATH) {
        return "/";
    }

    if (normalizedPath.startsWith(`${APP_BASE_PATH}/`)) {
        const strippedPath = normalizedPath.slice(APP_BASE_PATH.length);
        return strippedPath || "/";
    }

    return normalizedPath;
}

export function toBrowserPath(pathname: string): string {
    const normalizedPath = normalizePath(pathname);
    if (!APP_BASE_PATH) {
        return normalizedPath;
    }

    return normalizedPath === "/"
        ? APP_BASE_PATH
        : `${APP_BASE_PATH}${normalizedPath}`;
}

export function parseRoute(pathname: string): AppRoute {
    const normalizedPath = stripAppBasePath(pathname);
    if (normalizedPath === "/oauth/github/callback") {
        return { kind: "githubCallback" };
    }
    if (normalizedPath === MARKETING_PATH || normalizedPath === LOGIN_PATH) {
        return { kind: "marketing" };
    }
    if (normalizedPath === SIGNUP_PATH) {
        return { kind: "signup" };
    }
    if (normalizedPath === ORGANIZATIONS_PATH) {
        return { kind: "organizations" };
    }

    const organizationMatch = normalizedPath.match(
        /^\/organizations\/(\d+)(?:\/(projects|users|settings))?$/,
    );
    if (organizationMatch) {
        return {
            kind: "organization",
            organizationId: Number(organizationMatch[1]),
            section:
                (organizationMatch[2] as OrganizationSection | undefined) ??
                "projects",
        };
    }

    const projectMatch = normalizedPath.match(
        /^\/projects\/(\d+)(?:\/(board|tasks|bugs|history|settings))?$/,
    );
    if (projectMatch) {
        return {
            kind: "project",
            projectId: Number(projectMatch[1]),
            section: (projectMatch[2] as ProjectSection | undefined) ?? "board",
        };
    }

    return { kind: "organizations" };
}

export function getOrganizationPath(
    organizationId: number,
    section: OrganizationSection = "projects",
): string {
    return section === "projects"
        ? `/organizations/${organizationId}`
        : `/organizations/${organizationId}/${section}`;
}

export function getProjectPath(
    projectId: number,
    section: ProjectSection = "board",
): string {
    return section === "board"
        ? `/projects/${projectId}`
        : `/projects/${projectId}/${section}`;
}
