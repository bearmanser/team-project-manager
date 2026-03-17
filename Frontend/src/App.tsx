import { startTransition, useEffect, useMemo, useState } from "react";

import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";

import {
    ApiError,
    buildApiUrl,
    completeGitHubOauth,
    createBugReport,
    createOrganization,
    createProject,
    createTask,
    deleteProject,
    getProject,
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
import { SideNav } from "./components/SideNav";
import { SurfaceCard } from "./components/SurfaceCard";
import { TopNav } from "./components/TopNav";
import { LoginPage } from "./pages/LoginPage";
import { OrganizationOverviewPage } from "./pages/OrganizationOverviewPage";
import { OrganizationProjectsPage } from "./pages/OrganizationProjectsPage";
import { OrganizationSettingsPage } from "./pages/OrganizationSettingsPage";
import { OrganizationUsersPage } from "./pages/OrganizationUsersPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ProjectBoardPage } from "./pages/ProjectBoardPage";
import { ProjectBugsPage } from "./pages/ProjectBugsPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { ProjectTasksPage } from "./pages/ProjectTasksPage";
import type {
    BugStatus,
    Notification,
    OrganizationSummary,
    ProjectDetail,
    TaskStatus,
    User,
    WorkspaceResponse,
} from "./types";
import type {
    NavItem,
    OrganizationSection,
    OrganizationUser,
    ProjectSection,
    TopView,
} from "./view-models";

const TOKEN_STORAGE_KEY = "team-project-manager.jwt";
const SELECTED_ORGANIZATION_STORAGE_KEY = "team-project-manager.selected-organization";
const SELECTED_PROJECT_STORAGE_KEY = "team-project-manager.selected-project";

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
};

const initialBugForm = {
    title: "",
    description: "",
    status: "open" as BugStatus,
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

function App() {
    const [authMode, setAuthMode] = useState<"signup" | "login">("login");
    const [signupForm, setSignupForm] = useState(initialSignupForm);
    const [loginForm, setLoginForm] = useState(initialLoginForm);
    const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_STORAGE_KEY));
    const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
    const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(() =>
        parseStoredNumber(SELECTED_ORGANIZATION_STORAGE_KEY),
    );
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() =>
        parseStoredNumber(SELECTED_PROJECT_STORAGE_KEY),
    );
    const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
    const [topView, setTopView] = useState<TopView>("organizations");
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
    const [createOrganizationForm, setCreateOrganizationForm] = useState(initialOrganizationForm);
    const [createProjectForm, setCreateProjectForm] = useState(initialProjectForm);
    const [createTaskForm, setCreateTaskForm] = useState(initialTaskForm);
    const [createBugForm, setCreateBugForm] = useState(initialBugForm);
    const [projectSettingsForm, setProjectSettingsForm] = useState({
        name: "",
        description: "",
    });

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
    const profileOrganization = currentOrganization ?? workspace?.organizations[0] ?? null;

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

    const projectNavItems: NavItem<ProjectSection>[] = useMemo(
        () => [
            {
                id: "board",
                label: "Board",
                description: "Drag tasks between delivery stages.",
            },
            {
                id: "bugs",
                label: "Bugs",
                description: "Triaged issues with inline status updates.",
            },
            {
                id: "tasks",
                label: "Tasks",
                description: "Compact task list with inline status changes.",
            },
            {
                id: "settings",
                label: "Settings",
                description: "Project details, repo reference, and deletion.",
            },
        ],
        [],
    );

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

    function clearSession(): void {
        storeToken(null);
        rememberOrganizationSelection(null);
        rememberProjectSelection(null);
        setWorkspace(null);
        setSelectedProject(null);
        setTopView("organizations");
        setNotice(null);
        setError(null);
        setNotificationOpen(false);
    }

    async function loadProjectDetail(sessionToken: string, projectId: number): Promise<ProjectDetail> {
        const response = await getProject(sessionToken, projectId);
        startTransition(() => {
            setSelectedProject(response.project);
            setProjectSettingsForm({
                name: response.project.name,
                description: response.project.description,
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
    ): Promise<void> {
        if (!options.quiet) {
            setBusyLabel("Loading workspace");
        }

        const workspaceData = await getWorkspace(sessionToken);
        startTransition(() => {
            setWorkspace(workspaceData);
        });

        const requestedProjectId = options.preferredProjectId ?? selectedProjectId;
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
                    });
                });
            } else {
                await loadProjectDetail(sessionToken, resolvedProjectId);
            }

            if (!options.quiet) {
                setBusyLabel(null);
            }
            return;
        }

        rememberProjectSelection(null);
        startTransition(() => {
            setSelectedProject(null);
        });

        const requestedOrganizationId = options.preferredOrganizationId ?? selectedOrganizationId;
        const resolvedOrganizationId = workspaceData.organizations.some(
            (organization) => organization.id === requestedOrganizationId,
        )
            ? requestedOrganizationId
            : null;

        rememberOrganizationSelection(resolvedOrganizationId);

        if (!options.quiet) {
            setBusyLabel(null);
        }
    }

    async function runProjectMutation(
        label: string,
        action: () => Promise<{ project: ProjectDetail }>,
        successNotice: string,
    ): Promise<void> {
        if (!token) {
            return;
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
        } catch (reason) {
            setError(getFriendlyError(reason));
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
        const isGitHubCallback = window.location.pathname === "/oauth/github/callback";
        const params = new URLSearchParams(window.location.search);

        if (isGitHubCallback) {
            const providerError = params.get("error_description") ?? params.get("error");
            if (providerError) {
                setError(providerError);
                window.history.replaceState({}, document.title, "/");
                setIsBooting(false);
                return;
            }

            const code = params.get("code");
            const state = params.get("state");

            if (!sessionToken || !code || !state) {
                clearSession();
                setError("Finish signing in before connecting GitHub.");
                window.history.replaceState({}, document.title, "/");
                setIsBooting(false);
                return;
            }

            setBusyLabel("Connecting GitHub");
            try {
                await completeGitHubOauth(sessionToken, { code, state });
                await hydrateWorkspace(sessionToken, { quiet: true });
                setNotice("GitHub connected. Open an organization and add a project from the + button.");
            } catch (reason) {
                clearSession();
                setError(getFriendlyError(reason));
            } finally {
                window.history.replaceState({}, document.title, "/");
                setBusyLabel(null);
                setIsBooting(false);
            }
            return;
        }

        if (!sessionToken) {
            setIsBooting(false);
            return;
        }

        try {
            await hydrateWorkspace(sessionToken, { quiet: true });
        } catch (reason) {
            clearSession();
            setError(getFriendlyError(reason));
        } finally {
            setIsBooting(false);
        }
    }

    useEffect(() => {
        void bootstrapWorkspace();
    }, []);

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
            void hydrateWorkspace(token, {
                preferredOrganizationId: selectedOrganizationId,
                quiet: true,
            });
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
            setTopView("organizations");

            if (connectGitHub) {
                await beginGitHubConnection(response.accessToken);
                return;
            }

            await hydrateWorkspace(response.accessToken, { quiet: true });
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
            setTopView("organizations");
            await hydrateWorkspace(response.accessToken, { quiet: true });
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
            await hydrateWorkspace(token, {
                preferredOrganizationId: response.organization.id,
                quiet: true,
            });
            setNotice("Organization added.");
        } catch (reason) {
            setError(getFriendlyError(reason));
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
            setProjectSection("board");
            await hydrateWorkspace(token, {
                preferredOrganizationId: currentOrganization.id,
                preferredProjectId: response.project.id,
                projectOverride: response.project,
                quiet: true,
            });
            setNotice("Project added.");
        } catch (reason) {
            setError(getFriendlyError(reason));
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

    async function handleOpenProject(projectId: number): Promise<void> {
        if (!token) {
            return;
        }

        setBusyLabel("Opening project");
        setError(null);
        setNotice(null);

        try {
            await loadProjectDetail(token, projectId);
            setTopView("organizations");
            setProjectSection("board");
            setNotificationOpen(false);
        } catch (reason) {
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    function openOrganization(organizationId: number, section: OrganizationSection = "projects"): void {
        setTopView("organizations");
        setOrganizationSection(section);
        setSelectedProject(null);
        rememberProjectSelection(null);
        rememberOrganizationSelection(organizationId);
        setNotificationOpen(false);
    }

    function openOrganizationOverview(): void {
        setTopView("organizations");
        setSelectedProject(null);
        rememberProjectSelection(null);
        rememberOrganizationSelection(null);
        setNotificationOpen(false);
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

        await runProjectMutation(
            "Updating task",
            () => updateTask(token, taskId, { status }),
            "Task updated.",
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
                }),
            "Project settings saved.",
        );
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
            rememberProjectSelection(null);
            setSelectedProject(null);
            setProjectSection("board");
            await hydrateWorkspace(token, {
                preferredOrganizationId: currentOrganizationId,
                quiet: true,
            });
            setNotice("Project deleted.");
        } catch (reason) {
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    function handleOpenProfile(): void {
        setTopView("profile");
        setNotificationOpen(false);
    }

    function handleOpenSettings(): void {
        setNotificationOpen(false);

        if (selectedProject) {
            setTopView("organizations");
            setProjectSection("settings");
            return;
        }

        const targetOrganizationId = currentOrganization?.id ?? workspace?.organizations[0]?.id ?? null;
        if (targetOrganizationId !== null) {
            openOrganization(targetOrganizationId, "settings");
        }
    }

    const activeHeaderAction: "profile" | "settings" | null =
        topView === "profile"
            ? "profile"
            : selectedProject
              ? projectSection === "settings"
                    ? "settings"
                    : null
              : currentOrganization && organizationSection === "settings"
                ? "settings"
                : null;

    const topNav = (
        <TopNav
            activeAction={activeHeaderAction}
            busyLabel={busyLabel}
            notifications={workspace?.notifications ?? []}
            notificationOpen={notificationOpen}
            unreadCount={unreadNotifications.length}
            user={user}
            onCloseNotifications={() => setNotificationOpen(false)}
            onOpenProfile={handleOpenProfile}
            onOpenSettings={handleOpenSettings}
            onReadNotification={(notification) => void handleReadNotification(notification)}
            onToggleNotifications={() => setNotificationOpen((current) => !current)}
        />
    );

    const banner =
        error || notice ? (
            <SurfaceCard p="4" bg={error ? "#2a1317" : "#0f211d"} borderColor={error ? "#8c3a46" : "#2f6c58"}>
                <Flex justify="space-between" align="center" gap="4">
                    <Text color={error ? "#ffc6ce" : "#b7f5de"}>{error ?? notice}</Text>
                    <Button
                        variant="ghost"
                        color={error ? "#ffc6ce" : "#b7f5de"}
                        minW="8"
                        h="8"
                        px="0"
                        onClick={() => {
                            setError(null);
                            setNotice(null);
                        }}
                    >
                        x
                    </Button>
                </Flex>
            </SurfaceCard>
        ) : null;

    if (isBooting) {
        return (
            <Box minH="100vh" bg="#090d12" display="grid" placeItems="center" px="4">
                <SurfaceCard p={{ base: "6", lg: "10" }} w="full" maxW="640px">
                    <Stack gap="3">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" color="#90a0b7">
                            Team Project Manager
                        </Text>
                        <Heading size="2xl" color="#f5f7fb">
                            Preparing your workspace
                        </Heading>
                        <Text color="#b0bccf">{busyLabel ?? "Loading authentication state..."}</Text>
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

    if (topView === "profile") {
        return (
            <AppShell topNav={topNav} banner={banner}>
                <ProfilePage
                    organization={profileOrganization}
                    user={user}
                    onConnectGitHub={() => void handleConnectGitHub()}
                    onLogout={clearSession}
                />
            </AppShell>
        );
    }

    if (!currentOrganization) {
        return (
            <AppShell topNav={topNav} banner={banner}>
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
                onSelect={setProjectSection}
                topSlot={
                    <Stack gap="3">
                        <select
                            value={String(selectedProject.id)}
                            style={{
                                width: "100%",
                                border: "1px solid #2b3544",
                                background: "#0f141b",
                                color: "#f5f7fb",
                                padding: "10px 12px",
                            }}
                            onChange={(event) => void handleOpenProject(Number(event.target.value))}
                        >
                            {currentOrganizationProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                        <Text color="#728198" fontSize="sm">
                            {currentOrganization.name}
                        </Text>
                    </Stack>
                }
                footerSlot={
                    <Button
                        w="full"
                        borderRadius="full"
                        variant="outline"
                        borderColor="#2b3544"
                        color="#eef3fb"
                        onClick={() => openOrganization(currentOrganization.id, "projects")}
                    >
                        Back to organization
                    </Button>
                }
            />
        );

        let projectContent = (
            <ProjectBoardPage
                project={selectedProject}
                onUpdateTaskStatus={(taskId, status) => void handleUpdateTaskStatus(taskId, status)}
            />
        );

        if (projectSection === "tasks") {
            projectContent = (
                <ProjectTasksPage
                    createTaskForm={createTaskForm}
                    isCreateOpen={showCreateTaskForm}
                    project={selectedProject}
                    onCreateTask={() => void handleCreateTask()}
                    onCreateTaskFormChange={(field, value) =>
                        setCreateTaskForm((current) => ({
                            ...current,
                            [field]: value,
                        }))
                    }
                    onToggleCreateForm={() => setShowCreateTaskForm((current) => !current)}
                    onUpdateTaskStatus={(taskId, status) => void handleUpdateTaskStatus(taskId, status)}
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
                    onUpdateBugStatus={(bugId, status) => void handleUpdateBugStatus(bugId, status)}
                />
            );
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
            <AppShell topNav={topNav} banner={banner} sidebar={projectSidebar}>
                {projectContent}
            </AppShell>
        );
    }

    const organizationSidebar = (
        <SideNav
            items={organizationNavItems}
            activeItem={organizationSection}
            onSelect={setOrganizationSection}
            footerSlot={
                <Button
                    w="full"
                    borderRadius="full"
                    variant="outline"
                    borderColor="#2b3544"
                    color="#eef3fb"
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
            onOpenProject={(projectId) => void handleOpenProject(projectId)}
            onToggleCreateForm={() => setShowCreateProjectForm((current) => !current)}
        />
    );

    if (organizationSection === "users") {
        organizationContent = (
            <OrganizationUsersPage isLoading={organizationUsersLoading} users={organizationUsers} />
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
        <AppShell topNav={topNav} banner={banner} sidebar={organizationSidebar}>
            {organizationContent}
        </AppShell>
    );
}

export default App;
