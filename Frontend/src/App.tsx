import { startTransition, useEffect, useMemo, useState } from "react";

import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";

import {
    ApiError,
    addBugComment,
    addProjectMember,
    addTaskComment,
    toggleBugCommentReaction,
    toggleTaskCommentReaction,
    buildApiUrl,
    completeGitHubOauth,
    createBugReport,
    createOrganization,
    createProject,
    createTask,
    deleteProject,
    endProjectSprint,
    getProject,
    updateProjectSprint,
    getWorkspace,
    login,
    markNotificationRead,
    signup,
    startGitHubOauth,
    updateBugReport,
    updateProjectSettings,
    updateTask,
} from "./api";
import { AppShell } from "./components/AppShell";
import { EndSprintModal } from "./components/EndSprintModal";
import { EndSprintIncompleteTasksModal } from "./components/EndSprintIncompleteTasksModal";
import { SideNav } from "./components/SideNav";
import { SurfaceCard } from "./components/SurfaceCard";
import { WorkItemDetailModal } from "./components/WorkItemDetailModal";
import { TopNav } from "./components/TopNav";
import { LoginPage } from "./pages/LoginPage";
import { OrganizationOverviewPage } from "./pages/OrganizationOverviewPage";
import { OrganizationProjectsPage } from "./pages/OrganizationProjectsPage";
import { OrganizationSettingsPage } from "./pages/OrganizationSettingsPage";
import { OrganizationUsersPage } from "./pages/OrganizationUsersPage";
import { ProjectBoardPage } from "./pages/ProjectBoardPage";
import { ProjectBugsPage } from "./pages/ProjectBugsPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { ProjectSprintHistoryPage } from "./pages/ProjectSprintHistoryPage";
import { ProjectTasksPage } from "./pages/ProjectTasksPage";
import type {
    BacklogPlacement,
    BugReport,
    BugStatus,
    EndSprintUnfinishedAction,
    Notification,
    OrganizationSummary,
    ProjectDetail,
    PriorityLevel,
    ProjectRole,
    Task,
    TaskStatus,
    User,
    WorkspaceResponse,
} from "./types";
import { sidebarSelectStyle } from "./utils";
import type { NavItem, OrganizationSection, OrganizationUser, ProjectSection } from "./view-models";

const TOKEN_STORAGE_KEY = "team-project-manager.jwt";
const SELECTED_ORGANIZATION_STORAGE_KEY = "team-project-manager.selected-organization";
const SELECTED_PROJECT_STORAGE_KEY = "team-project-manager.selected-project";
const THEME_MODE_STORAGE_KEY = "team-project-manager.theme-mode";

const initialSignupForm = {
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
};

const initialLoginForm = {
    identifier: "",
    password: "",
};

const initialOrganizationForm = {
    name: "",
    description: "",
};

const initialProjectForm = {
    name: "",
    description: "",
    repositoryId: "",
};

const initialTaskForm = {
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    priority: "medium" as PriorityLevel,
    placement: "product" as BacklogPlacement,
};

const initialBugForm = {
    title: "",
    description: "",
    status: "open" as BugStatus,
    priority: "medium" as PriorityLevel,
};

function getFriendlyError(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong. Please try again.";
}

function dedupeOrganizationUsers(
    projects: ProjectDetail[],
    fallbackOwner?: User | null,
): OrganizationUser[] {
    const registry = new Map<number, OrganizationUser>();

    projects.forEach((project) => {
        project.members.forEach((member) => {
            const existing = registry.get(member.user.id);
            if (existing) {
                if (!existing.projectNames.includes(project.name)) {
                    existing.projectNames.push(project.name);
                }
                if (!existing.roles.includes(member.role)) {
                    existing.roles.push(member.role);
                }
                return;
            }

            registry.set(member.user.id, {
                id: member.user.id,
                user: member.user,
                projectNames: [project.name],
                roles: [member.role],
            });
        });
    });

    if (fallbackOwner && !registry.has(fallbackOwner.id)) {
        registry.set(fallbackOwner.id, {
            id: fallbackOwner.id,
            user: fallbackOwner,
            projectNames: [],
            roles: ["owner"],
        });
    }

    return [...registry.values()].sort((left, right) =>
        left.user.username.localeCompare(right.user.username),
    );
}

function parseStoredNumber(key: string): number | null {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
        return null;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
}

const ORGANIZATIONS_PATH = "/organizations";
const LOGIN_PATH = "/login";

type AppRoute =
    | { kind: "login" }
    | { kind: "organizations" }
    | { kind: "organization"; organizationId: number; section: OrganizationSection }
    | { kind: "project"; projectId: number; section: ProjectSection }
    | { kind: "githubCallback" };

function normalizePath(pathname: string): string {
    if (!pathname || pathname === "/") {
        return "/";
    }

    return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function parseRoute(pathname: string): AppRoute {
    const normalizedPath = normalizePath(pathname);
    if (normalizedPath === "/oauth/github/callback") {
        return { kind: "githubCallback" };
    }
    if (normalizedPath === LOGIN_PATH) {
        return { kind: "login" };
    }
    if (normalizedPath === "/" || normalizedPath === ORGANIZATIONS_PATH) {
        return { kind: "organizations" };
    }

    const organizationMatch = normalizedPath.match(/^\/organizations\/(\d+)(?:\/(projects|users|settings))?$/);
    if (organizationMatch) {
        return {
            kind: "organization",
            organizationId: Number(organizationMatch[1]),
            section: (organizationMatch[2] as OrganizationSection | undefined) ?? "projects",
        };
    }

    const projectMatch = normalizedPath.match(/^\/projects\/(\d+)(?:\/(board|tasks|bugs|history|settings))?$/);
    if (projectMatch) {
        return {
            kind: "project",
            projectId: Number(projectMatch[1]),
            section: (projectMatch[2] as ProjectSection | undefined) ?? "board",
        };
    }

    return { kind: "organizations" };
}

function getOrganizationPath(organizationId: number, section: OrganizationSection = "projects"): string {
    return section === "projects"
        ? `/organizations/${organizationId}`
        : `/organizations/${organizationId}/${section}`;
}

function getProjectPath(projectId: number, section: ProjectSection = "board"): string {
    return section === "board" ? `/projects/${projectId}` : `/projects/${projectId}/${section}`;
}

function getStoredThemeMode(): "light" | "dark" {
    return window.localStorage.getItem(THEME_MODE_STORAGE_KEY) === "light" ? "light" : "dark";
}

function App() {
    const [authMode, setAuthMode] = useState<"signup" | "login">("login");
    const [signupForm, setSignupForm] = useState(initialSignupForm);
    const [loginForm, setLoginForm] = useState(initialLoginForm);
    const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_STORAGE_KEY));
    const [themeMode, setThemeMode] = useState<"light" | "dark">(() => getStoredThemeMode());
    const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(() =>
        parseStoredNumber(SELECTED_ORGANIZATION_STORAGE_KEY),
    );
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() =>
        parseStoredNumber(SELECTED_PROJECT_STORAGE_KEY),
    );
    const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
    const [organizationSection, setOrganizationSection] = useState<OrganizationSection>("projects");
    const [projectSection, setProjectSection] = useState<ProjectSection>("board");
    const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([]);
    const [organizationUsersLoading, setOrganizationUsersLoading] = useState(false);
    const [busyLabel, setBusyLabel] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isBooting, setIsBooting] = useState(true);
    const [notificationOpen, setNotificationOpen] = useState(false);
    const [showCreateOrganizationForm, setShowCreateOrganizationForm] = useState(false);
    const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
    const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
    const [showCreateBugForm, setShowCreateBugForm] = useState(false);
    const [showEndSprintModal, setShowEndSprintModal] = useState(false);
    const [showEndSprintActionModal, setShowEndSprintActionModal] = useState(false);
    const [endSprintReview, setEndSprintReview] = useState("");
    const [endSprintUnfinishedAction, setEndSprintUnfinishedAction] = useState<EndSprintUnfinishedAction>("carryover");
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
    const [createOrganizationForm, setCreateOrganizationForm] = useState(initialOrganizationForm);
    const [createProjectForm, setCreateProjectForm] = useState(initialProjectForm);
    const [createTaskForm, setCreateTaskForm] = useState(initialTaskForm);
    const [createBugForm, setCreateBugForm] = useState(initialBugForm);
    const [projectSettingsForm, setProjectSettingsForm] = useState({
        name: "",
        description: "",
        useSprints: false,
    });
    const [hiddenCompletedProductBacklogTaskIds, setHiddenCompletedProductBacklogTaskIds] = useState<Record<number, number[]>>({});

    const user = workspace?.user ?? null;
    const unreadNotifications = (workspace?.notifications ?? []).filter((item) => !item.isRead);
    const currentOrganization = useMemo<OrganizationSummary | null>(() => {
        if (!workspace || selectedOrganizationId === null) {
            return null;
        }

        return (
            workspace.organizations.find((organization) => organization.id === selectedOrganizationId) ?? null
        );
    }, [selectedOrganizationId, workspace]);
    const currentOrganizationProjects = useMemo(
        () =>
            workspace?.projects.filter((project) => project.organizationId === currentOrganization?.id) ?? [],
        [currentOrganization?.id, workspace],
    );
    const endSprintUnfinishedTasks = useMemo(() => {
        if (!selectedProject?.activeSprint) {
            return [];
        }

        return selectedProject.tasks.filter(
            (task) => task.sprintId === selectedProject.activeSprint?.id && task.status !== "done",
        );
    }, [selectedProject]);
    const selectedTask = useMemo<Task | null>(() => {
        if (!selectedProject || selectedTaskId === null) {
            return null;
        }

        return selectedProject.tasks.find((task) => task.id === selectedTaskId) ?? null;
    }, [selectedProject, selectedTaskId]);
    const selectedBug = useMemo<BugReport | null>(() => {
        if (!selectedProject || selectedBugId === null) {
            return null;
        }

        return selectedProject.bugReports.find((bug) => bug.id === selectedBugId) ?? null;
    }, [selectedBugId, selectedProject]);

    const organizationNavItems: NavItem<OrganizationSection>[] = useMemo(
        () => [
            {
                id: "projects",
                label: "Projects",
                description: "Open and add workspaces under this organization.",
            },
            {
                id: "users",
                label: "Users",
                description: "See the shared people attached to projects here.",
            },
            {
                id: "settings",
                label: "Settings",
                description: "GitHub connectivity and organization rules.",
            },
        ],
        [],
    );

    const projectNavItems: NavItem<ProjectSection>[] = useMemo(() => {
        const items: NavItem<ProjectSection>[] = [
            {
                id: "board",
                label: "Board",
                description: selectedProject?.useSprints
                    ? "Flow the active sprint across the board."
                    : "Drag tasks between delivery stages.",
            },
            {
                id: "tasks",
                label: "Tasks",
                description: selectedProject?.useSprints
                    ? "Split sprint backlog from product backlog."
                    : "Compact task list with inline status and priority changes.",
            },
            {
                id: "bugs",
                label: "Bugs",
                description: "Triaged issues with inline status and priority updates.",
            },
        ];

        if (selectedProject?.useSprints) {
            items.push({
                id: "history",
                label: "Sprint History",
                description: "Past sprints, review notes, and carryover.",
            });
        }

        items.push({
            id: "settings",
            label: "Settings",
            description: "Project details, workflow mode, repo reference, and deletion.",
        });

        return items;
    }, [selectedProject?.useSprints]);

    function storeToken(nextToken: string | null): void {
        if (nextToken) {
            window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
        } else {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        setToken(nextToken);
    }

    function rememberOrganizationSelection(organizationId: number | null): void {
        if (organizationId === null) {
            window.localStorage.removeItem(SELECTED_ORGANIZATION_STORAGE_KEY);
        } else {
            window.localStorage.setItem(SELECTED_ORGANIZATION_STORAGE_KEY, String(organizationId));
        }
        setSelectedOrganizationId(organizationId);
    }

    function rememberProjectSelection(projectId: number | null): void {
        if (projectId === null) {
            window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
        } else {
            window.localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, String(projectId));
        }
        setSelectedProjectId(projectId);
    }

    function navigateToPath(path: string, replace = false): void {
        const normalizedPath = normalizePath(path);
        const currentPath = normalizePath(window.location.pathname);
        if (normalizedPath === currentPath && !replace) {
            return;
        }

        if (replace) {
            window.history.replaceState({}, document.title, normalizedPath);
        } else {
            window.history.pushState({}, document.title, normalizedPath);
        }
    }

    function clearProjectSelection(): void {
        rememberProjectSelection(null);
        setSelectedProject(null);
        setProjectSection("board");
        setSelectedTaskId(null);
        setSelectedBugId(null);
        setShowEndSprintModal(false);
        setShowEndSprintActionModal(false);
        setEndSprintReview("");
        setEndSprintUnfinishedAction("carryover");
    }

    function clearSession(): void {
        storeToken(null);
        rememberOrganizationSelection(null);
        rememberProjectSelection(null);
        setWorkspace(null);
        setSelectedProject(null);
        setOrganizationSection("projects");
        setProjectSection("board");
        setNotice(null);
        setError(null);
        setNotificationOpen(false);
        navigateToPath(LOGIN_PATH, true);
    }

    async function loadProjectDetail(sessionToken: string, projectId: number): Promise<ProjectDetail> {
        const response = await getProject(sessionToken, projectId);
        startTransition(() => {
            setSelectedProject(response.project);
            setProjectSettingsForm({
                name: response.project.name,
                description: response.project.description,
                useSprints: response.project.useSprints,
            });
        });
        rememberProjectSelection(projectId);
        rememberOrganizationSelection(response.project.organizationId);
        return response.project;
    }

    async function hydrateWorkspace(
        sessionToken: string,
        options: {
            preferredOrganizationId?: number | null;
            preferredProjectId?: number | null;
            projectOverride?: ProjectDetail | null;
            quiet?: boolean;
        } = {},
    ): Promise<{ resolvedOrganizationId: number | null; resolvedProjectId: number | null }> {
        if (!options.quiet) {
            setBusyLabel("Loading workspace");
        }

        const workspaceData = await getWorkspace(sessionToken);
        startTransition(() => {
            setWorkspace(workspaceData);
        });

        const requestedProjectId = Object.prototype.hasOwnProperty.call(options, "preferredProjectId")
            ? options.preferredProjectId ?? null
            : selectedProjectId;
        const resolvedProjectId = workspaceData.projects.some((project) => project.id === requestedProjectId)
            ? requestedProjectId
            : null;

        if (resolvedProjectId !== null) {
            const projectOverride = options.projectOverride;
            if (projectOverride && projectOverride.id === resolvedProjectId) {
                rememberProjectSelection(resolvedProjectId);
                rememberOrganizationSelection(projectOverride.organizationId);
                startTransition(() => {
                    setSelectedProject(projectOverride);
                    setProjectSettingsForm({
                        name: projectOverride.name,
                        description: projectOverride.description,
                        useSprints: projectOverride.useSprints,
                    });
                });
            } else {
                await loadProjectDetail(sessionToken, resolvedProjectId);
            }

            if (!options.quiet) {
                setBusyLabel(null);
            }

            return {
                resolvedOrganizationId:
                    options.projectOverride?.id === resolvedProjectId
                        ? options.projectOverride.organizationId
                        : workspaceData.projects.find((project) => project.id === resolvedProjectId)?.organizationId ?? null,
                resolvedProjectId,
            };
        }

        rememberProjectSelection(null);
        startTransition(() => {
            setSelectedProject(null);
        });

        const requestedOrganizationId = Object.prototype.hasOwnProperty.call(options, "preferredOrganizationId")
            ? options.preferredOrganizationId ?? null
            : selectedOrganizationId;
        const resolvedOrganizationId = workspaceData.organizations.some(
            (organization) => organization.id === requestedOrganizationId,
        )
            ? requestedOrganizationId
            : null;

        rememberOrganizationSelection(resolvedOrganizationId);

        if (!options.quiet) {
            setBusyLabel(null);
        }

        return {
            resolvedOrganizationId,
            resolvedProjectId: null,
        };
    }

    async function syncFromPath(sessionToken: string, options: { quiet?: boolean } = {}): Promise<void> {
        const route = parseRoute(window.location.pathname);
        setNotificationOpen(false);

        if (route.kind === "login") {
            navigateToPath(ORGANIZATIONS_PATH, true);
            await syncFromPath(sessionToken, options);
            return;
        }

        if (route.kind === "organizations") {
            setOrganizationSection("projects");
            clearProjectSelection();
            rememberOrganizationSelection(null);
            await hydrateWorkspace(sessionToken, {
                preferredOrganizationId: null,
                preferredProjectId: null,
                quiet: options.quiet,
            });
            return;
        }

        if (route.kind === "organization") {
            setOrganizationSection(route.section);
            clearProjectSelection();
            const result = await hydrateWorkspace(sessionToken, {
                preferredOrganizationId: route.organizationId,
                preferredProjectId: null,
                quiet: options.quiet,
            });
            if (result.resolvedOrganizationId !== route.organizationId) {
                navigateToPath(ORGANIZATIONS_PATH, true);
            }
            return;
        }

        if (route.kind === "project") {
            setProjectSection(route.section);
            const result = await hydrateWorkspace(sessionToken, {
                preferredOrganizationId: null,
                preferredProjectId: route.projectId,
                quiet: options.quiet,
            });
            if (result.resolvedProjectId !== route.projectId) {
                navigateToPath(
                    result.resolvedOrganizationId ? getOrganizationPath(result.resolvedOrganizationId) : ORGANIZATIONS_PATH,
                    true,
                );
            }
        }
    }

    async function runProjectMutation(
        label: string,
        action: () => Promise<{ project: ProjectDetail }>,
        successNotice: string,
    ): Promise<boolean> {
        if (!token) {
            return false;
        }

        setBusyLabel(label);
        setError(null);
        setNotice(null);

        try {
            const response = await action();
            startTransition(() => {
                setSelectedProject(response.project);
                setProjectSettingsForm({
                    name: response.project.name,
                    description: response.project.description,
                    useSprints: response.project.useSprints,
                });
            });
            rememberProjectSelection(response.project.id);
            rememberOrganizationSelection(response.project.organizationId);
            await hydrateWorkspace(token, {
                preferredOrganizationId: response.project.organizationId,
                preferredProjectId: response.project.id,
                projectOverride: response.project,
                quiet: true,
            });
            setNotice(successNotice);
            return true;
        } catch (reason) {
            setError(getFriendlyError(reason));
            return false;
        } finally {
            setBusyLabel(null);
        }
    }

    async function beginGitHubConnection(sessionToken: string): Promise<void> {
        const response = await startGitHubOauth(sessionToken);
        window.location.assign(response.authorizationUrl);
    }

    async function bootstrapWorkspace(): Promise<void> {
        const sessionToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
        const route = parseRoute(window.location.pathname);
        const params = new URLSearchParams(window.location.search);

        if (route.kind === "githubCallback") {
            const providerError = params.get("error_description") ?? params.get("error");
            if (providerError) {
                setError(providerError);
                navigateToPath(ORGANIZATIONS_PATH, true);
                setIsBooting(false);
                return;
            }

            const code = params.get("code");
            const state = params.get("state");

            if (!sessionToken || !code || !state) {
                clearSession();
                setError("Finish signing in before connecting GitHub.");
                navigateToPath(LOGIN_PATH, true);
                setIsBooting(false);
                return;
            }

            setBusyLabel("Connecting GitHub");
            try {
                await completeGitHubOauth(sessionToken, { code, state });
                navigateToPath(ORGANIZATIONS_PATH, true);
                await syncFromPath(sessionToken, { quiet: true });
                setNotice("GitHub connected. Open an organization and add a project from the + button.");
            } catch (reason) {
                clearSession();
                setError(getFriendlyError(reason));
            } finally {
                setBusyLabel(null);
                setIsBooting(false);
            }
            return;
        }

        if (!sessionToken) {
            if (route.kind !== "login") {
                navigateToPath(LOGIN_PATH, true);
            }
            setIsBooting(false);
            return;
        }

        try {
            if (route.kind === "login") {
                navigateToPath(ORGANIZATIONS_PATH, true);
            }
            await syncFromPath(sessionToken, { quiet: true });
        } catch (reason) {
            clearSession();
            setError(getFriendlyError(reason));
        } finally {
            setIsBooting(false);
        }
    }

    useEffect(() => {
        document.documentElement.dataset.theme = themeMode;
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
    }, [themeMode]);

    useEffect(() => {
        void bootstrapWorkspace();
    }, []);

    useEffect(() => {
        if (!token) {
            return;
        }

        const sessionToken = token;

        function handlePopState(): void {
            void syncFromPath(sessionToken, { quiet: true });
        }

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [token]);

    useEffect(() => {
        if (!selectedProject || selectedProject.useSprints || projectSection !== "history") {
            return;
        }

        setProjectSection("board");
        navigateToPath(getProjectPath(selectedProject.id, "board"), true);
    }, [projectSection, selectedProject]);

    useEffect(() => {
        if (!error && !notice) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setError(null);
            setNotice(null);
        }, 5000);

        return () => window.clearTimeout(timeoutId);
    }, [error, notice]);

    useEffect(() => {
        if (!token || !selectedProjectId) {
            return;
        }

        const stream = new EventSource(
            buildApiUrl(`/api/projects/${selectedProjectId}/events/?token=${encodeURIComponent(token)}`),
        );

        const handleUpdated = () => {
            void (async () => {
                try {
                    const [projectResponse, workspaceResponse] = await Promise.all([
                        getProject(token, selectedProjectId),
                        getWorkspace(token),
                    ]);
                    startTransition(() => {
                        setSelectedProject(projectResponse.project);
                        setWorkspace(workspaceResponse);
                    });
                } catch {
                    // Manual refresh paths will recover the UI.
                }
            })();
        };

        const handleDeleted = () => {
            navigateToPath(
                selectedOrganizationId ? getOrganizationPath(selectedOrganizationId) : ORGANIZATIONS_PATH,
                true,
            );
            void syncFromPath(token, { quiet: true });
        };

        stream.addEventListener("project.updated", handleUpdated);
        stream.addEventListener("project.deleted", handleDeleted);
        stream.onerror = () => stream.close();

        return () => {
            stream.removeEventListener("project.updated", handleUpdated);
            stream.removeEventListener("project.deleted", handleDeleted);
            stream.close();
        };
    }, [selectedOrganizationId, selectedProjectId, token]);

    useEffect(() => {
        if (!token || !currentOrganization || selectedProject || organizationSection !== "users") {
            return;
        }

        let cancelled = false;
        const fallbackOwner = currentOrganization.role === "owner" ? user : null;

        if (currentOrganizationProjects.length === 0) {
            setOrganizationUsers(dedupeOrganizationUsers([], fallbackOwner));
            return;
        }

        void (async () => {
            try {
                setOrganizationUsersLoading(true);
                const responses = await Promise.all(
                    currentOrganizationProjects.map((project) => getProject(token, project.id)),
                );
                if (cancelled) {
                    return;
                }
                setOrganizationUsers(
                    dedupeOrganizationUsers(
                        responses.map((response) => response.project),
                        fallbackOwner,
                    ),
                );
            } catch (reason) {
                if (!cancelled) {
                    setError(getFriendlyError(reason));
                }
            } finally {
                if (!cancelled) {
                    setOrganizationUsersLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [currentOrganization, currentOrganizationProjects, organizationSection, selectedProject, token, user]);

    async function handleSubmitSignup(connectGitHub: boolean): Promise<void> {
        if (signupForm.password !== signupForm.confirmPassword) {
            setError("Passwords must match before creating the account.");
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel(connectGitHub ? "Creating account and preparing GitHub" : "Creating account");

        try {
            const response = await signup({
                username: signupForm.username.trim(),
                email: signupForm.email.trim(),
                password: signupForm.password,
            });
            storeToken(response.accessToken);
            setSignupForm(initialSignupForm);
            setLoginForm({ identifier: response.user.email, password: "" });
            navigateToPath(ORGANIZATIONS_PATH, true);

            if (connectGitHub) {
                await beginGitHubConnection(response.accessToken);
                return;
            }

            await syncFromPath(response.accessToken, { quiet: true });
            setNotice("Account created. Add an organization when you are ready.");
        } catch (reason) {
            clearSession();
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    async function handleSubmitLogin(): Promise<void> {
        setError(null);
        setNotice(null);
        setBusyLabel("Signing in");

        try {
            const response = await login({
                identifier: loginForm.identifier.trim(),
                password: loginForm.password,
            });
            storeToken(response.accessToken);
            setLoginForm(initialLoginForm);
            navigateToPath(ORGANIZATIONS_PATH, true);
            await syncFromPath(response.accessToken, { quiet: true });
            setNotice("Welcome back.");
        } catch (reason) {
            clearSession();
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    async function handleConnectGitHub(): Promise<void> {
        if (!token) {
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel(user?.githubConnected ? "Refreshing GitHub repositories" : "Opening GitHub");

        try {
            await beginGitHubConnection(token);
        } catch (reason) {
            setError(getFriendlyError(reason));
            setBusyLabel(null);
        }
    }

    async function handleCreateOrganization(): Promise<void> {
        if (!token) {
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel("Adding organization");

        try {
            const response = await createOrganization(token, {
                name: createOrganizationForm.name.trim(),
                description: createOrganizationForm.description.trim(),
            });
            setCreateOrganizationForm(initialOrganizationForm);
            setShowCreateOrganizationForm(false);
            navigateToPath(getOrganizationPath(response.organization.id), true);
            await syncFromPath(token, { quiet: true });
            setNotice("Organization added.");
        } catch (reason) {
            setError(getFriendlyError(reason));
            return;
        } finally {
            setBusyLabel(null);
        }
    }

    async function handleCreateProject(): Promise<void> {
        if (!token || !currentOrganization) {
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel("Adding project");

        try {
            const response = await createProject(token, {
                organizationId: currentOrganization.id,
                name: createProjectForm.name.trim(),
                description: createProjectForm.description.trim(),
                repositoryIds: [createProjectForm.repositoryId],
            });
            setCreateProjectForm(initialProjectForm);
            setShowCreateProjectForm(false);
            navigateToPath(getProjectPath(response.project.id), true);
            await syncFromPath(token, { quiet: true });
            setNotice("Project added.");
        } catch (reason) {
            setError(getFriendlyError(reason));
            return;
        } finally {
            setBusyLabel(null);
        }
    }

    async function handleReadNotification(notification: Notification): Promise<void> {
        if (!token || notification.isRead) {
            return;
        }

        try {
            const response = await markNotificationRead(token, notification.id);
            startTransition(() => {
                setWorkspace((current) =>
                    current
                        ? {
                              ...current,
                              notifications: current.notifications.map((item) =>
                                  item.id === notification.id ? response.notification : item,
                              ),
                          }
                        : current,
                );
            });
        } catch (reason) {
            setError(getFriendlyError(reason));
        }
    }

    function openProject(projectId: number, section: ProjectSection = "board"): void {
        if (!token) {
            return;
        }

        setBusyLabel("Opening project");
        setError(null);
        setNotice(null);
        setNotificationOpen(false);
        navigateToPath(getProjectPath(projectId, section));
        void syncFromPath(token, { quiet: true }).finally(() => setBusyLabel(null));
    }

    function openOrganization(organizationId: number, section: OrganizationSection = "projects"): void {
        if (!token) {
            return;
        }

        setNotificationOpen(false);
        navigateToPath(getOrganizationPath(organizationId, section));
        void syncFromPath(token, { quiet: true });
    }

    function openOrganizationOverview(): void {
        if (!token) {
            return;
        }

        setNotificationOpen(false);
        navigateToPath(ORGANIZATIONS_PATH);
        void syncFromPath(token, { quiet: true });
    }

    function openCreateTaskForm(status: TaskStatus, placement: BacklogPlacement = "product"): void {
        setCreateTaskForm({
            ...initialTaskForm,
            status,
            placement,
        });
        setShowCreateTaskForm(true);
    }

    function openTaskDetail(taskId: number): void {
        setSelectedBugId(null);
        setSelectedTaskId(taskId);
    }

    function openBugDetail(bugId: number): void {
        setSelectedTaskId(null);
        setSelectedBugId(bugId);
    }

    async function handleCreateTask(): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }

        await runProjectMutation(
            "Adding task",
            () =>
                createTask(token, selectedProject.id, {
                    title: createTaskForm.title.trim(),
                    description: createTaskForm.description.trim(),
                    status: createTaskForm.status,
                    priority: createTaskForm.priority,
                    placement: createTaskForm.placement,
                    assigneeIds: [],
                }),
            "Task added.",
        );
        setCreateTaskForm(initialTaskForm);
        setShowCreateTaskForm(false);
    }

    async function handleUpdateTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation("Updating task", () => updateTask(token, taskId, { status }), "Task updated.");
    }

    async function handleUpdateTaskPriority(taskId: number, priority: PriorityLevel): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation(
            "Updating task priority",
            () => updateTask(token, taskId, { priority }),
            "Task updated.",
        );
    }

    async function handleMoveTaskPlacement(taskId: number, placement: BacklogPlacement): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation(
            "Updating backlog placement",
            () => updateTask(token, taskId, { placement }),
            "Task updated.",
        );
    }

    async function handleSaveTaskDetails(
        taskId: number,
        payload: Partial<{ title: string; description: string; status: string; priority: string }>,
    ): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation("Saving task", () => updateTask(token, taskId, payload), "Task saved.");
    }

    async function handleAddTaskDetailComment(
        taskId: number,
        payload: { body: string; anchorType?: string; anchorId?: string; anchorLabel?: string },
    ): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation(
            "Adding task comment",
            () => addTaskComment(token, taskId, payload),
            "Comment added.",
        );
    }

    async function handleToggleTaskCommentReaction(commentId: number, emoji: string): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation(
            "Updating task reaction",
            () => toggleTaskCommentReaction(token, commentId, { emoji }),
            "Reaction updated.",
        );
    }
    async function handleCreateBug(): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }

        await runProjectMutation(
            "Adding bug report",
            () =>
                createBugReport(token, selectedProject.id, {
                    title: createBugForm.title.trim(),
                    description: createBugForm.description.trim(),
                    status: createBugForm.status,
                    priority: createBugForm.priority,
                }),
            "Bug report added.",
        );
        setCreateBugForm(initialBugForm);
        setShowCreateBugForm(false);
    }

    async function handleUpdateBugStatus(bugId: number, status: BugStatus): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation(
            "Updating bug report",
            () => updateBugReport(token, bugId, { status }),
            "Bug report updated.",
        );
    }

    async function handleUpdateBugPriority(bugId: number, priority: PriorityLevel): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation(
            "Updating bug priority",
            () => updateBugReport(token, bugId, { priority }),
            "Bug report updated.",
        );
    }

    async function handleSaveBugDetails(
        bugId: number,
        payload: Partial<{ title: string; description: string; status: string; priority: string }>,
    ): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation("Saving bug report", () => updateBugReport(token, bugId, payload), "Bug saved.");
    }

    async function handleAddBugDetailComment(
        bugId: number,
        payload: { body: string; anchorType?: string; anchorId?: string; anchorLabel?: string },
    ): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation(
            "Adding bug comment",
            () => addBugComment(token, bugId, payload),
            "Comment added.",
        );
    }

    async function handleToggleBugCommentReaction(commentId: number, emoji: string): Promise<void> {
        if (!token) {
            return;
        }

        await runProjectMutation(
            "Updating bug reaction",
            () => toggleBugCommentReaction(token, commentId, { emoji }),
            "Reaction updated.",
        );
    }
    async function handleSaveProjectSettings(): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }

        await runProjectMutation(
            "Saving project settings",
            () =>
                updateProjectSettings(token, selectedProject.id, {
                    name: projectSettingsForm.name.trim(),
                    description: projectSettingsForm.description.trim(),
                    useSprints: projectSettingsForm.useSprints,
                }),
            "Project settings saved.",
        );
    }

    function closeEndSprintFlow(): void {
        setShowEndSprintModal(false);
        setShowEndSprintActionModal(false);
        setEndSprintReview("");
        setEndSprintUnfinishedAction("carryover");
    }

    function handleEndSprintRequest(): void {
        if (endSprintUnfinishedTasks.length > 0) {
            setShowEndSprintModal(false);
            setShowEndSprintActionModal(true);
            return;
        }

        void handleEndSprint();
    }

    async function handleEndSprint(unfinishedAction: EndSprintUnfinishedAction = "carryover"): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }

        const didEndSprint = await runProjectMutation(
            "Ending sprint",
            () =>
                endProjectSprint(token, selectedProject.id, {
                    reviewText: endSprintReview.trim(),
                    unfinishedAction,
                }),
            "Sprint ended.",
        );
        if (didEndSprint) {
            closeEndSprintFlow();
        }
    }

    async function handleRenameSprint(name: string): Promise<void> {
        if (!token || !selectedProject?.activeSprint) {
            return;
        }

        const activeSprintId = selectedProject.activeSprint.id;

        await runProjectMutation(
            "Renaming sprint",
            () =>
                updateProjectSprint(token, selectedProject.id, activeSprintId, {
                    name,
                }),
            "Sprint renamed.",
        );
    }

    function handleCleanupProductBacklogDoneTasks(projectId: number, taskIds: number[]): void {
        setHiddenCompletedProductBacklogTaskIds((current) => ({
            ...current,
            [projectId]: taskIds,
        }));
    }

    async function handleDeleteSelectedProject(): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }

        setBusyLabel("Deleting project");
        setError(null);
        setNotice(null);

        try {
            const currentOrganizationId = selectedProject.organizationId;
            await deleteProject(token, selectedProject.id);
            clearProjectSelection();
            navigateToPath(currentOrganizationId ? getOrganizationPath(currentOrganizationId) : ORGANIZATIONS_PATH, true);
            await syncFromPath(token, { quiet: true });
            setNotice("Project deleted.");
        } catch (reason) {
            setError(getFriendlyError(reason));
            return;
        } finally {
            setBusyLabel(null);
        }
    }

    async function handleInviteProjectUser(projectId: number, identifier: string, role: ProjectRole): Promise<void> {
        if (!token || !currentOrganization) {
            return;
        }

        setBusyLabel("Inviting user");
        setError(null);
        setNotice(null);

        try {
            await addProjectMember(token, projectId, {
                identifier,
                role,
            });
            await syncFromPath(token, { quiet: true });
            setNotice("User invited.");
        } catch (reason) {
            setError(getFriendlyError(reason));
            return;
        } finally {
            setBusyLabel(null);
        }
    }

    const topNav = (
        <TopNav
            busyLabel={busyLabel}
            error={error}
            notice={notice}
            notifications={workspace?.notifications ?? []}
            notificationOpen={notificationOpen}
            unreadCount={unreadNotifications.length}
            themeMode={themeMode}
            user={user}
            onCloseNotifications={() => setNotificationOpen(false)}
            onLogout={clearSession}
            onReadNotification={(notification) => void handleReadNotification(notification)}
            onToggleNotifications={() => setNotificationOpen((current) => !current)}
            onToggleThemeMode={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
        />
    );

    if (isBooting) {
        return (
            <Box minH="100vh" bg="var(--color-bg-app)" display="grid" placeItems="center" px="4">
                <SurfaceCard p={{ base: "6", lg: "10" }} w="full" maxW="640px">
                    <Stack gap="3">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" color="var(--color-text-muted)">
                            Team Project Manager
                        </Text>
                        <Heading size="2xl" color="var(--color-text-primary)">
                            Preparing your workspace
                        </Heading>
                        <Text color="var(--color-text-secondary)">{busyLabel ?? "Loading authentication state..."}</Text>
                    </Stack>
                </SurfaceCard>
            </Box>
        );
    }

    if (!workspace || !user) {
        return (
            <LoginPage
                authMode={authMode}
                busyLabel={busyLabel}
                error={error}
                notice={notice}
                loginForm={loginForm}
                signupForm={signupForm}
                onAuthModeChange={setAuthMode}
                onLoginFormChange={(field, value) =>
                    setLoginForm((current) => ({ ...current, [field]: value }))
                }
                onSignupFormChange={(field, value) =>
                    setSignupForm((current) => ({ ...current, [field]: value }))
                }
                onSubmitLogin={() => void handleSubmitLogin()}
                onSubmitSignup={(connectGitHub) => void handleSubmitSignup(connectGitHub)}
            />
        );
    }


    if (!currentOrganization) {
        return (
            <AppShell topNav={topNav}>
                <OrganizationOverviewPage
                    createOrganizationForm={createOrganizationForm}
                    isCreatingOrganization={busyLabel === "Adding organization"}
                    organizations={workspace.organizations}
                    showCreateForm={showCreateOrganizationForm}
                    onCreateOrganization={() => void handleCreateOrganization()}
                    onCreateOrganizationFormChange={(field, value) =>
                        setCreateOrganizationForm((current) => ({
                            ...current,
                            [field]: value,
                        }))
                    }
                    onOpenOrganization={(organizationId) => openOrganization(organizationId)}
                    onToggleCreateForm={() => setShowCreateOrganizationForm((current) => !current)}
                />
            </AppShell>
        );
    }
    if (selectedProject) {
        const projectSidebar = (
            <SideNav
                items={projectNavItems}
                activeItem={projectSection}
                onSelect={(section) => openProject(selectedProject.id, section)}
                topSlot={
                    <Stack gap="3">
                        <Text color="var(--color-text-subtle)" fontSize="sm">
                            {currentOrganization.name}
                        </Text>
                        <select
                            value={String(selectedProject.id)}
                            style={sidebarSelectStyle}
                            onChange={(event) => {
                                const nextProjectId = Number(event.target.value);
                                event.target.blur();
                                openProject(nextProjectId, projectSection);
                            }}
                        >
                            {currentOrganizationProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    </Stack>
                }
                footerSlot={
                    <Button
                        w="full"
                        borderRadius="lg"
                        variant="outline"
                        borderColor="var(--color-border-strong)"
                        color="var(--color-text-primary)"
                        _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                        onClick={() => openOrganization(currentOrganization.id, "projects")}
                    >
                        Back to organization
                    </Button>
                }
            />
        );

        let projectContent = (
            <ProjectBoardPage
                createTaskForm={createTaskForm}
                isCreateTaskOpen={showCreateTaskForm}
                project={selectedProject}
                onCreateTask={() => void handleCreateTask()}
                onCreateTaskFormChange={(field, value) =>
                    setCreateTaskForm((current) => ({
                        ...current,
                        [field]: value,
                    }))
                }
                onOpenCreateTask={openCreateTaskForm}
                onOpenTask={openTaskDetail}
                onToggleCreateTaskForm={() => setShowCreateTaskForm((current) => !current)}
                onUpdateTaskPriority={(taskId, priority) => void handleUpdateTaskPriority(taskId, priority)}
                onUpdateTaskStatus={(taskId, status) => void handleUpdateTaskStatus(taskId, status)}
                onMoveTaskPlacement={(taskId, placement) => void handleMoveTaskPlacement(taskId, placement)}
                onRenameSprint={(name) => void handleRenameSprint(name)}
                onOpenEndSprint={() => {
                    setEndSprintUnfinishedAction("carryover");
                    setShowEndSprintActionModal(false);
                    setShowEndSprintModal(true);
                }}
            />
        );

        if (projectSection === "tasks") {
            projectContent = (
                <ProjectTasksPage
                    createTaskForm={createTaskForm}
                    hiddenProductBacklogTaskIds={hiddenCompletedProductBacklogTaskIds[selectedProject.id] ?? []}
                    isCreateOpen={showCreateTaskForm}
                    project={selectedProject}
                    onCleanupProductBacklogDoneTasks={handleCleanupProductBacklogDoneTasks}
                    onCreateTask={() => void handleCreateTask()}
                    onCreateTaskFormChange={(field, value) =>
                        setCreateTaskForm((current) => ({
                            ...current,
                            [field]: value,
                        }))
                    }
                    onToggleCreateForm={() => setShowCreateTaskForm((current) => !current)}
                    onOpenCreateTask={openCreateTaskForm}
                    onOpenTask={openTaskDetail}
                    onUpdateTaskPriority={(taskId, priority) => void handleUpdateTaskPriority(taskId, priority)}
                    onUpdateTaskStatus={(taskId, status) => void handleUpdateTaskStatus(taskId, status)}
                    onMoveTaskPlacement={(taskId, placement) => void handleMoveTaskPlacement(taskId, placement)}
                    onRenameSprint={(name) => void handleRenameSprint(name)}
                />
            );
        }

        if (projectSection === "bugs") {
            projectContent = (
                <ProjectBugsPage
                    createBugForm={createBugForm}
                    isCreateOpen={showCreateBugForm}
                    project={selectedProject}
                    onCreateBug={() => void handleCreateBug()}
                    onCreateBugFormChange={(field, value) =>
                        setCreateBugForm((current) => ({
                            ...current,
                            [field]: value,
                        }))
                    }
                    onToggleCreateForm={() => setShowCreateBugForm((current) => !current)}
                    onOpenBug={openBugDetail}
                    onUpdateBugPriority={(bugId, priority) => void handleUpdateBugPriority(bugId, priority)}
                    onUpdateBugStatus={(bugId, status) => void handleUpdateBugStatus(bugId, status)}
                />
            );
        }

        if (projectSection === "history" && selectedProject.useSprints) {
            projectContent = <ProjectSprintHistoryPage project={selectedProject} />;
        }

        if (projectSection === "settings") {
            projectContent = (
                <ProjectSettingsPage
                    busyLabel={busyLabel}
                    project={selectedProject}
                    projectSettingsForm={projectSettingsForm}
                    onDeleteProject={() => void handleDeleteSelectedProject()}
                    onProjectSettingsChange={(field, value) =>
                        setProjectSettingsForm((current) => ({
                            ...current,
                            [field]: value,
                        }))
                    }
                    onSaveProjectSettings={() => void handleSaveProjectSettings()}
                />
            );
        }

        return (
            <AppShell topNav={topNav} sidebar={projectSidebar}>
                {projectContent}
                <WorkItemDetailModal
                    isOpen={Boolean(selectedTask)}
                    project={selectedProject}
                    task={selectedTask}
                    onClose={() => setSelectedTaskId(null)}
                    onSaveTask={(taskId, payload) => void handleSaveTaskDetails(taskId, payload)}
                    onSaveBug={(bugId, payload) => void handleSaveBugDetails(bugId, payload)}
                    onAddTaskComment={(taskId, payload) => void handleAddTaskDetailComment(taskId, payload)}
                    onToggleTaskCommentReaction={(commentId, emoji) => void handleToggleTaskCommentReaction(commentId, emoji)}
                    onAddBugComment={(bugId, payload) => void handleAddBugDetailComment(bugId, payload)}
                    onToggleBugCommentReaction={(commentId, emoji) => void handleToggleBugCommentReaction(commentId, emoji)}
                />
                <WorkItemDetailModal
                    isOpen={Boolean(selectedBug)}
                    project={selectedProject}
                    bug={selectedBug}
                    onClose={() => setSelectedBugId(null)}
                    onSaveTask={(taskId, payload) => void handleSaveTaskDetails(taskId, payload)}
                    onSaveBug={(bugId, payload) => void handleSaveBugDetails(bugId, payload)}
                    onAddTaskComment={(taskId, payload) => void handleAddTaskDetailComment(taskId, payload)}
                    onToggleTaskCommentReaction={(commentId, emoji) => void handleToggleTaskCommentReaction(commentId, emoji)}
                    onAddBugComment={(bugId, payload) => void handleAddBugDetailComment(bugId, payload)}
                    onToggleBugCommentReaction={(commentId, emoji) => void handleToggleBugCommentReaction(commentId, emoji)}
                />
                <EndSprintModal
                    isOpen={showEndSprintModal}
                    project={selectedProject}
                    reviewText={endSprintReview}
                    onChange={setEndSprintReview}
                    onClose={closeEndSprintFlow}
                    onSubmit={handleEndSprintRequest}
                />
                <EndSprintIncompleteTasksModal
                    action={endSprintUnfinishedAction}
                    isOpen={showEndSprintActionModal}
                    sprintName={selectedProject.activeSprint?.name ?? ""}
                    tasks={endSprintUnfinishedTasks}
                    onActionChange={setEndSprintUnfinishedAction}
                    onClose={closeEndSprintFlow}
                    onSubmit={() => void handleEndSprint(endSprintUnfinishedAction)}
                />
            </AppShell>
        );
    }

    const organizationSidebar = (
        <SideNav
            items={organizationNavItems}
            activeItem={organizationSection}
            onSelect={(section) => openOrganization(currentOrganization.id, section)}
            footerSlot={
                <Button
                    w="full"
                    borderRadius="lg"
                    variant="outline"
                    borderColor="var(--color-border-strong)"
                    color="var(--color-text-primary)"
                    _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                    onClick={openOrganizationOverview}
                >
                    All organizations
                </Button>
            }
        />
    );

    let organizationContent = (
        <OrganizationProjectsPage
            organization={currentOrganization}
            projects={currentOrganizationProjects}
            availableRepos={workspace.availableRepos}
            createProjectForm={createProjectForm}
            githubRepoError={workspace.githubRepoError}
            isGitHubConnected={user.githubConnected}
            isCreatingProject={busyLabel === "Adding project"}
            showCreateForm={showCreateProjectForm}
            onConnectGitHub={() => void handleConnectGitHub()}
            onCreateProject={() => void handleCreateProject()}
            onCreateProjectFormChange={(field, value) =>
                setCreateProjectForm((current) => ({
                    ...current,
                    [field]: value,
                }))
            }
            onOpenProject={(projectId) => openProject(projectId)}
            onToggleCreateForm={() => setShowCreateProjectForm((current) => !current)}
        />
    );

    if (organizationSection === "users") {
        organizationContent = (
            <OrganizationUsersPage
                isInviting={busyLabel === "Inviting user"}
                isLoading={organizationUsersLoading}
                manageableProjects={currentOrganizationProjects.filter((project) => project.role === "owner" || project.role === "admin")}
                users={organizationUsers}
                onInviteUser={(projectId, identifier, role) =>
                    void handleInviteProjectUser(projectId, identifier, role)
                }
            />
        );
    }

    if (organizationSection === "settings") {
        organizationContent = (
            <OrganizationSettingsPage
                githubRepoError={workspace.githubRepoError}
                isGitHubConnected={user.githubConnected}
                organization={currentOrganization}
                onConnectGitHub={() => void handleConnectGitHub()}
            />
        );
    }

    return (
        <AppShell topNav={topNav} sidebar={organizationSidebar}>
            {organizationContent}
        </AppShell>
    );
}

export default App;
