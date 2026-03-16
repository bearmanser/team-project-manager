import { startTransition, useEffect, useEffectEvent, useState } from "react";
import type { FormEvent } from "react";

import {
    ApiError,
    addBugComment,
    addBugIssueLink,
    addProjectMember,
    addProjectRepos,
    addTaskComment,
    addTaskIssueLink,
    buildApiUrl,
    completeGitHubOauth,
    createBugReport,
    createProject,
    createTask,
    createTaskBranch,
    deleteProject,
    getProject,
    getWorkspace,
    login,
    markNotificationRead,
    removeProjectMember,
    removeProjectRepo,
    setBugResolutionTask,
    signup,
    startGitHubOauth,
    updateBugReport,
    updateProjectMemberRole,
    updateProjectSettings,
    updateTask,
} from "./api";
import type {
    BugReport,
    BugStatus,
    Notification,
    ProjectDetail,
    ProjectRole,
    Repo,
    TaskStatus,
    WorkspaceResponse,
} from "./types";

const TOKEN_STORAGE_KEY = "team-project-manager.jwt";
const SELECTED_PROJECT_STORAGE_KEY = "team-project-manager.selected-project";

type AppTab = "overview" | "board" | "bugs" | "users";

type TaskEditorState = {
    title: string;
    description: string;
    status: TaskStatus;
    assigneeIds: number[];
};

type BugEditorState = {
    title: string;
    description: string;
    status: BugStatus;
};

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

const initialProjectForm = {
    name: "",
    description: "",
    repositoryIds: [] as string[],
};

const initialTaskForm = {
    title: "",
    description: "",
    status: "todo" as TaskStatus,
    assigneeIds: [] as number[],
    bugReportId: "",
    markAsResolution: false,
};

const initialBugForm = {
    title: "",
    description: "",
    status: "open" as BugStatus,
};

const initialInviteForm = {
    identifier: "",
    role: "member" as ProjectRole,
};

const initialIssueForm = {
    repositoryFullName: "",
    issueNumber: "",
    issueUrl: "",
};

function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return "Just now";
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatShortDate(value: string | null | undefined): string {
    if (!value) {
        return "Now";
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
    }).format(new Date(value));
}

function getFriendlyError(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong. Please try again.";
}

function classNames(...values: Array<string | false | null | undefined>): string {
    return values.filter(Boolean).join(" ");
}

function getInitials(name: string): string {
    return name.slice(0, 2).toUpperCase();
}

function App() {
    const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
    const [signupForm, setSignupForm] = useState(initialSignupForm);
    const [loginForm, setLoginForm] = useState(initialLoginForm);
    const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_STORAGE_KEY));
    const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
        const rawValue = window.localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
        if (!rawValue) {
            return null;
        }

        const parsedValue = Number(rawValue);
        return Number.isFinite(parsedValue) ? parsedValue : null;
    });
    const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
    const [activeTab, setActiveTab] = useState<AppTab>("overview");
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
    const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
    const [busyLabel, setBusyLabel] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isBooting, setIsBooting] = useState(true);
    const [createProjectForm, setCreateProjectForm] = useState(initialProjectForm);
    const [createTaskForm, setCreateTaskForm] = useState(initialTaskForm);
    const [createBugForm, setCreateBugForm] = useState(initialBugForm);
    const [inviteForm, setInviteForm] = useState(initialInviteForm);
    const [projectSettingsForm, setProjectSettingsForm] = useState({ name: "", description: "" });
    const [taskEditor, setTaskEditor] = useState<TaskEditorState>({
        title: "",
        description: "",
        status: "todo",
        assigneeIds: [],
    });
    const [taskCommentDraft, setTaskCommentDraft] = useState("");
    const [taskIssueForm, setTaskIssueForm] = useState(initialIssueForm);
    const [taskBranchForm, setTaskBranchForm] = useState({ repositoryId: "", branchName: "" });
    const [bugEditor, setBugEditor] = useState<BugEditorState>({
        title: "",
        description: "",
        status: "open",
    });
    const [bugCommentDraft, setBugCommentDraft] = useState("");
    const [bugIssueForm, setBugIssueForm] = useState(initialIssueForm);
    const [bugResolutionTaskId, setBugResolutionTaskId] = useState("");

    const isWorking = busyLabel !== null;
    const user = workspace?.user ?? null;
    const availableRepos = workspace?.availableRepos ?? [];
    const selectedTask = selectedProject?.tasks.find((task) => task.id === selectedTaskId) ?? null;
    const selectedBug = selectedProject?.bugReports.find((bug) => bug.id === selectedBugId) ?? null;
    const assignableMembers = (selectedProject?.members ?? []).filter((member) => member.role !== "viewer");
    const unreadNotifications = (workspace?.notifications ?? []).filter((item) => !item.isRead);
    const canEditSelectedBug = Boolean(
        user &&
            selectedProject &&
            selectedBug &&
            (selectedProject.permissions.canEditBugs || selectedBug.reporter.id === user.id),
    );

    function storeToken(nextToken: string | null): void {
        if (nextToken) {
            window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
        } else {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        setToken(nextToken);
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
        rememberProjectSelection(null);
        setWorkspace(null);
        setSelectedProject(null);
        setSelectedTaskId(null);
        setSelectedBugId(null);
    }

    async function loadProjectDetail(sessionToken: string, projectId: number): Promise<ProjectDetail> {
        const response = await getProject(sessionToken, projectId);
        startTransition(() => {
            setSelectedProject(response.project);
        });
        rememberProjectSelection(projectId);
        return response.project;
    }

    async function hydrateWorkspace(
        sessionToken: string,
        options: {
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
            : workspaceData.projects[0]?.id ?? null;

        if (resolvedProjectId === null) {
            rememberProjectSelection(null);
            startTransition(() => {
                setSelectedProject(null);
            });
            if (!options.quiet) {
                setBusyLabel(null);
            }
            return;
        }

        if (options.projectOverride && options.projectOverride.id === resolvedProjectId) {
            rememberProjectSelection(resolvedProjectId);
            startTransition(() => {
                setSelectedProject(options.projectOverride ?? null);
            });
        } else {
            await loadProjectDetail(sessionToken, resolvedProjectId);
        }

        if (!options.quiet) {
            setBusyLabel(null);
        }
    }

    async function beginGitHubConnection(sessionToken: string): Promise<void> {
        const response = await startGitHubOauth(sessionToken);
        window.location.assign(response.authorizationUrl);
    }

    async function runProjectMutation(
        label: string,
        action: () => Promise<{ project: ProjectDetail }>,
        successNotice?: string,
    ): Promise<void> {
        if (!token) {
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel(label);

        try {
            const response = await action();
            startTransition(() => {
                setSelectedProject(response.project);
            });
            rememberProjectSelection(response.project.id);
            await hydrateWorkspace(token, {
                preferredProjectId: response.project.id,
                projectOverride: response.project,
                quiet: true,
            });
            if (successNotice) {
                setNotice(successNotice);
            }
        } catch (reason) {
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    const handleLiveProjectUpdate = useEffectEvent((projectId: number) => {
        if (!token) {
            return;
        }

        void (async () => {
            try {
                const [projectResponse, workspaceResponse] = await Promise.all([
                    getProject(token, projectId),
                    getWorkspace(token),
                ]);
                startTransition(() => {
                    setSelectedProject(projectResponse.project);
                    setWorkspace(workspaceResponse);
                });
            } catch {
                // The next manual interaction or reconnect will recover the view.
            }
        })();
    });

    const handleLiveProjectDeleted = useEffectEvent((sessionToken: string) => {
        void hydrateWorkspace(sessionToken, { quiet: true });
    });

    const bootstrapWorkspace = useEffectEvent(async () => {
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
                setNotice("GitHub connected. You can now create repository-backed projects.");
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
    });

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
        const handleUpdated = () => handleLiveProjectUpdate(selectedProjectId);
        const handleDeleted = () => {
            handleLiveProjectDeleted(token);
        };

        stream.addEventListener("project.updated", handleUpdated);
        stream.addEventListener("project.deleted", handleDeleted);
        stream.onerror = () => {
            stream.close();
        };

        return () => {
            stream.removeEventListener("project.updated", handleUpdated);
            stream.removeEventListener("project.deleted", handleDeleted);
            stream.close();
        };
    }, [token, selectedProjectId]);

    useEffect(() => {
        if (!selectedProject) {
            setSelectedTaskId(null);
            setSelectedBugId(null);
            return;
        }

        setProjectSettingsForm({
            name: selectedProject.name,
            description: selectedProject.description,
        });

        if (!selectedProject.tasks.some((task) => task.id === selectedTaskId)) {
            setSelectedTaskId(selectedProject.tasks[0]?.id ?? null);
        }
        if (!selectedProject.bugReports.some((bug) => bug.id === selectedBugId)) {
            setSelectedBugId(selectedProject.bugReports[0]?.id ?? null);
        }
    }, [selectedProject, selectedTaskId, selectedBugId]);

    useEffect(() => {
        if (!selectedTask) {
            setTaskEditor({ title: "", description: "", status: "todo", assigneeIds: [] });
            setTaskCommentDraft("");
            setTaskIssueForm(initialIssueForm);
            setTaskBranchForm({ repositoryId: "", branchName: "" });
            return;
        }

        setTaskEditor({
            title: selectedTask.title,
            description: selectedTask.description,
            status: selectedTask.status,
            assigneeIds: selectedTask.assignees.map((item) => item.id),
        });
        setTaskCommentDraft("");
        setTaskIssueForm({
            repositoryFullName: selectedProject?.repositories[0]?.fullName ?? "",
            issueNumber: "",
            issueUrl: "",
        });
        setTaskBranchForm({
            repositoryId: String(selectedTask.branchRepositoryId ?? selectedProject?.repositories[0]?.id ?? ""),
            branchName: selectedTask.branchName,
        });
    }, [selectedTask, selectedProject]);

    useEffect(() => {
        if (!selectedBug) {
            setBugEditor({ title: "", description: "", status: "open" });
            setBugCommentDraft("");
            setBugIssueForm(initialIssueForm);
            setBugResolutionTaskId("");
            return;
        }

        setBugEditor({
            title: selectedBug.title,
            description: selectedBug.description,
            status: selectedBug.status,
        });
        setBugCommentDraft("");
        setBugIssueForm({
            repositoryFullName: selectedProject?.repositories[0]?.fullName ?? "",
            issueNumber: "",
            issueUrl: "",
        });
        setBugResolutionTaskId(selectedBug.resolutionTaskId ? String(selectedBug.resolutionTaskId) : "");
    }, [selectedBug, selectedProject]);

    async function submitSignup(connectGitHub: boolean): Promise<void> {
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

            if (connectGitHub) {
                await beginGitHubConnection(response.accessToken);
                return;
            }

            await hydrateWorkspace(response.accessToken, { quiet: true });
            setNotice("Account created. Connect GitHub when you are ready to create your first project.");
        } catch (reason) {
            clearSession();
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    async function submitLogin(): Promise<void> {
        setError(null);
        setNotice(null);
        setBusyLabel("Signing in");

        try {
            const response = await login({
                identifier: loginForm.identifier.trim(),
                password: loginForm.password,
            });
            storeToken(response.accessToken);
            await hydrateWorkspace(response.accessToken, { quiet: true });
            setLoginForm(initialLoginForm);
            setNotice("Welcome back.");
        } catch (reason) {
            clearSession();
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    async function selectProject(projectId: number): Promise<void> {
        if (!token) {
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel("Opening project");
        try {
            await loadProjectDetail(token, projectId);
        } catch (reason) {
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

    async function handleReadNotification(notification: Notification): Promise<void> {
        if (!token || notification.isRead) {
            return;
        }

        try {
            const response = await markNotificationRead(token, notification.id);
            setWorkspace((current) => {
                if (!current) {
                    return current;
                }
                return {
                    ...current,
                    notifications: current.notifications.map((item) =>
                        item.id === response.notification.id ? response.notification : item,
                    ),
                };
            });
        } catch (reason) {
            setError(getFriendlyError(reason));
        }
    }

    function handleLogout(): void {
        clearSession();
        setAuthMode("login");
        setError(null);
        setNotice("You have been signed out.");
    }

    function handleSignupSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        void submitSignup(false);
    }

    function handleLoginSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        void submitLogin();
    }

    function handleCreateProjectSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (!token) {
            return;
        }

        if (!user?.githubConnected) {
            setError("Connect GitHub before creating a project.");
            return;
        }

        void runProjectMutation(
            "Creating project",
            () =>
                createProject(token, {
                    name: createProjectForm.name.trim(),
                    description: createProjectForm.description.trim(),
                    repositoryIds: createProjectForm.repositoryIds,
                }),
            "Project created.",
        );
        setCreateProjectForm(initialProjectForm);
        setActiveTab("overview");
    }

    function handleCreateTaskSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (!token || !selectedProject) {
            return;
        }

        void runProjectMutation(
            "Creating task",
            () =>
                createTask(token, selectedProject.id, {
                    title: createTaskForm.title.trim(),
                    description: createTaskForm.description.trim(),
                    status: createTaskForm.status,
                    assigneeIds: createTaskForm.assigneeIds,
                    bugReportId: createTaskForm.bugReportId ? Number(createTaskForm.bugReportId) : undefined,
                    markAsResolution: createTaskForm.markAsResolution,
                }),
            "Task created.",
        );
        setCreateTaskForm(initialTaskForm);
    }

    function handleCreateBugSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        if (!token || !selectedProject) {
            return;
        }

        void runProjectMutation(
            "Creating bug report",
            () =>
                createBugReport(token, selectedProject.id, {
                    title: createBugForm.title.trim(),
                    description: createBugForm.description.trim(),
                    status: createBugForm.status,
                }),
            "Bug report created.",
        );
        setCreateBugForm(initialBugForm);
    }

    function prefillTaskFromBug(bug: BugReport): void {
        setActiveTab("board");
        setSelectedBugId(bug.id);
        setCreateTaskForm({
            title: `Resolve: ${bug.title}`,
            description: bug.description,
            status: "todo",
            assigneeIds: [],
            bugReportId: String(bug.id),
            markAsResolution: true,
        });
    }

    async function handleTaskStatusDrop(status: TaskStatus): Promise<void> {
        if (!token || !selectedProject || draggedTaskId === null) {
            return;
        }

        const draggedTask = selectedProject.tasks.find((task) => task.id === draggedTaskId);
        if (!draggedTask || draggedTask.status === status) {
            setDraggedTaskId(null);
            return;
        }

        await runProjectMutation(
            "Moving task",
            () => updateTask(token, draggedTaskId, { status }),
            `Moved task to ${selectedProject.taskStatusLabels[status]}.`,
        );
        setDraggedTaskId(null);
    }

    async function handleSaveTask(): Promise<void> {
        if (!token || !selectedTask) {
            return;
        }

        await runProjectMutation(
            "Saving task",
            () =>
                updateTask(token, selectedTask.id, {
                    title: taskEditor.title.trim(),
                    description: taskEditor.description.trim(),
                    status: taskEditor.status,
                    assigneeIds: taskEditor.assigneeIds,
                }),
            "Task updated.",
        );
    }

    async function handleAddTaskComment(): Promise<void> {
        if (!token || !selectedTask || !taskCommentDraft.trim()) {
            return;
        }

        await runProjectMutation(
            "Posting task comment",
            () => addTaskComment(token, selectedTask.id, { body: taskCommentDraft.trim() }),
            "Comment added.",
        );
        setTaskCommentDraft("");
    }

    async function handleAddTaskIssue(): Promise<void> {
        if (!token || !selectedTask) {
            return;
        }

        await runProjectMutation(
            "Linking task issue",
            () =>
                addTaskIssueLink(token, selectedTask.id, {
                    repositoryFullName: taskIssueForm.repositoryFullName || undefined,
                    issueNumber: taskIssueForm.issueNumber ? Number(taskIssueForm.issueNumber) : undefined,
                    issueUrl: taskIssueForm.issueUrl.trim() || undefined,
                }),
            "GitHub issue linked to task.",
        );
        setTaskIssueForm({
            repositoryFullName: selectedProject?.repositories[0]?.fullName ?? "",
            issueNumber: "",
            issueUrl: "",
        });
    }

    async function handleCreateBranch(): Promise<void> {
        if (!token || !selectedTask) {
            return;
        }

        await runProjectMutation(
            "Creating branch",
            () =>
                createTaskBranch(token, selectedTask.id, {
                    repositoryId: taskBranchForm.repositoryId ? Number(taskBranchForm.repositoryId) : undefined,
                    branchName: taskBranchForm.branchName.trim() || undefined,
                }),
            "Branch created on GitHub.",
        );
    }

    async function handleSaveBug(): Promise<void> {
        if (!token || !selectedBug) {
            return;
        }

        await runProjectMutation(
            "Saving bug report",
            () =>
                updateBugReport(token, selectedBug.id, {
                    title: bugEditor.title.trim(),
                    description: bugEditor.description.trim(),
                    status: bugEditor.status,
                }),
            "Bug report updated.",
        );
    }

    async function handleAddBugComment(): Promise<void> {
        if (!token || !selectedBug || !bugCommentDraft.trim()) {
            return;
        }

        await runProjectMutation(
            "Posting bug comment",
            () => addBugComment(token, selectedBug.id, { body: bugCommentDraft.trim() }),
            "Comment added.",
        );
        setBugCommentDraft("");
    }

    async function handleAddBugIssue(): Promise<void> {
        if (!token || !selectedBug) {
            return;
        }

        await runProjectMutation(
            "Linking bug issue",
            () =>
                addBugIssueLink(token, selectedBug.id, {
                    repositoryFullName: bugIssueForm.repositoryFullName || undefined,
                    issueNumber: bugIssueForm.issueNumber ? Number(bugIssueForm.issueNumber) : undefined,
                    issueUrl: bugIssueForm.issueUrl.trim() || undefined,
                }),
            "GitHub issue linked to bug report.",
        );
        setBugIssueForm({
            repositoryFullName: selectedProject?.repositories[0]?.fullName ?? "",
            issueNumber: "",
            issueUrl: "",
        });
    }

    async function handleSaveBugResolutionTask(): Promise<void> {
        if (!token || !selectedBug) {
            return;
        }

        await runProjectMutation(
            "Updating resolution task",
            () =>
                setBugResolutionTask(token, selectedBug.id, {
                    taskId: bugResolutionTaskId ? Number(bugResolutionTaskId) : null,
                }),
            "Resolution task updated.",
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
            "Project settings updated.",
        );
    }

    async function handleDeleteCurrentProject(): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }
        if (!window.confirm(`Delete project "${selectedProject.name}"?`)) {
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel("Deleting project");
        try {
            await deleteProject(token, selectedProject.id);
            await hydrateWorkspace(token, { preferredProjectId: null, quiet: true });
            setNotice("Project deleted.");
        } catch (reason) {
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    async function handleAddRepositories(repositoryIds: string[]): Promise<void> {
        if (!token || !selectedProject || repositoryIds.length === 0) {
            return;
        }

        await runProjectMutation(
            "Connecting repositories",
            () => addProjectRepos(token, selectedProject.id, { repositoryIds }),
            "Repositories connected.",
        );
    }

    async function handleRemoveRepository(repositoryId: number): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }
        if (!window.confirm("Disconnect this repository from the project?")) {
            return;
        }

        await runProjectMutation(
            "Disconnecting repository",
            () => removeProjectRepo(token, selectedProject.id, repositoryId),
            "Repository disconnected.",
        );
    }

    async function handleInviteMember(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!token || !selectedProject) {
            return;
        }

        await runProjectMutation(
            "Adding project member",
            () =>
                addProjectMember(token, selectedProject.id, {
                    identifier: inviteForm.identifier.trim(),
                    role: inviteForm.role,
                }),
            "Project member added.",
        );
        setInviteForm(initialInviteForm);
    }

    async function handleChangeMemberRole(memberId: number, role: ProjectRole): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }

        await runProjectMutation(
            "Changing role",
            () => updateProjectMemberRole(token, selectedProject.id, memberId, { role }),
            "Member role updated.",
        );
    }

    async function handleRemoveMember(memberId: number): Promise<void> {
        if (!token || !selectedProject) {
            return;
        }
        if (!window.confirm("Remove this user from the project?")) {
            return;
        }

        await runProjectMutation(
            "Removing project member",
            () => removeProjectMember(token, selectedProject.id, memberId),
            "Project member removed.",
        );
    }

    function renderAuthScreen() {
        return (
            <main className="auth-shell">
                <section className="hero-panel">
                    <div className="hero-copy">
                        <span className="eyebrow">Developer-focused project manager</span>
                        <h1>Plan work, track bugs, and keep every project anchored to real repositories.</h1>
                        <p>
                            This workspace is built for small software teams that want sensible defaults,
                            fast collaboration, GitHub-linked projects, and live task updates without a
                            heavyweight process layer.
                        </p>
                    </div>
                    <div className="feature-list">
                        <article>
                            <strong>Repository-backed projects</strong>
                            <span>Every project starts with one or more connected GitHub repositories.</span>
                        </article>
                        <article>
                            <strong>Kanban plus bugs</strong>
                            <span>Keep tasks on the board and bugs in a separate workflow until they become work.</span>
                        </article>
                        <article>
                            <strong>Realtime collaboration</strong>
                            <span>Comments, assignments, mentions, and board moves show up live for the team.</span>
                        </article>
                    </div>
                </section>

                <section className="auth-card">
                    <div className="auth-card-header">
                        <span className="eyebrow">Access</span>
                        <h2>{authMode === "signup" ? "Create your team account" : "Welcome back"}</h2>
                        <p>
                            {authMode === "signup"
                                ? "Sign up with email and password. GitHub can be connected during signup or later before project creation."
                                : "Log in to continue into your developer workspace."}
                        </p>
                    </div>

                    <div className="mode-toggle" role="tablist" aria-label="Authentication mode">
                        <button
                            type="button"
                            className={classNames("mode-toggle-button", authMode === "signup" && "active")}
                            onClick={() => setAuthMode("signup")}
                        >
                            Sign up
                        </button>
                        <button
                            type="button"
                            className={classNames("mode-toggle-button", authMode === "login" && "active")}
                            onClick={() => setAuthMode("login")}
                        >
                            Log in
                        </button>
                    </div>

                    {error ? <div className="message error">{error}</div> : null}
                    {notice ? <div className="message success">{notice}</div> : null}

                    {authMode === "signup" ? (
                        <form className="auth-form" onSubmit={handleSignupSubmit}>
                            <label>
                                <span>Username</span>
                                <input
                                    value={signupForm.username}
                                    onChange={(event) =>
                                        setSignupForm((current) => ({ ...current, username: event.target.value }))
                                    }
                                    autoComplete="username"
                                    placeholder="magnus"
                                    required
                                />
                            </label>
                            <label>
                                <span>Email</span>
                                <input
                                    type="email"
                                    value={signupForm.email}
                                    onChange={(event) =>
                                        setSignupForm((current) => ({ ...current, email: event.target.value }))
                                    }
                                    autoComplete="email"
                                    placeholder="magnus@example.com"
                                    required
                                />
                            </label>
                            <label>
                                <span>Password</span>
                                <input
                                    type="password"
                                    value={signupForm.password}
                                    onChange={(event) =>
                                        setSignupForm((current) => ({ ...current, password: event.target.value }))
                                    }
                                    autoComplete="new-password"
                                    placeholder="Choose a strong password"
                                    required
                                />
                            </label>
                            <label>
                                <span>Confirm password</span>
                                <input
                                    type="password"
                                    value={signupForm.confirmPassword}
                                    onChange={(event) =>
                                        setSignupForm((current) => ({
                                            ...current,
                                            confirmPassword: event.target.value,
                                        }))
                                    }
                                    autoComplete="new-password"
                                    placeholder="Repeat your password"
                                    required
                                />
                            </label>
                            <div className="button-row">
                                <button type="submit" className="button-primary" disabled={isWorking}>
                                    {isWorking ? busyLabel : "Create account"}
                                </button>
                                <button
                                    type="button"
                                    className="button-secondary"
                                    disabled={isWorking}
                                    onClick={() => void submitSignup(true)}
                                >
                                    Create and connect GitHub
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form className="auth-form" onSubmit={handleLoginSubmit}>
                            <label>
                                <span>Username or email</span>
                                <input
                                    value={loginForm.identifier}
                                    onChange={(event) =>
                                        setLoginForm((current) => ({ ...current, identifier: event.target.value }))
                                    }
                                    autoComplete="username"
                                    placeholder="magnus or magnus@example.com"
                                    required
                                />
                            </label>
                            <label>
                                <span>Password</span>
                                <input
                                    type="password"
                                    value={loginForm.password}
                                    onChange={(event) =>
                                        setLoginForm((current) => ({ ...current, password: event.target.value }))
                                    }
                                    autoComplete="current-password"
                                    placeholder="Your password"
                                    required
                                />
                            </label>
                            <button type="submit" className="button-primary" disabled={isWorking}>
                                {isWorking ? busyLabel : "Log in"}
                            </button>
                        </form>
                    )}
                </section>
            </main>
        );
    }

    function renderOverviewTab() {
        if (!selectedProject) {
            return null;
        }

        const availableToConnect = availableRepos.filter(
            (repo) => !selectedProject.repositories.some((connected) => connected.fullName === repo.fullName),
        );
        const taskCounts = selectedProject.boardColumns.map((column) => ({
            label: column.label,
            count: selectedProject.tasks.filter((task) => task.status === column.id).length,
        }));

        return (
            <section className="project-panel-stack">
                <div className="summary-grid overview-grid">
                    {taskCounts.map((item) => (
                        <article key={item.label} className="summary-card compact-card">
                            <span className="eyebrow">Board</span>
                            <h3>{item.count}</h3>
                            <p>{item.label}</p>
                        </article>
                    ))}
                    <article className="summary-card compact-card">
                        <span className="eyebrow">Bugs</span>
                        <h3>{selectedProject.bugReports.filter((bug) => bug.status !== "closed").length}</h3>
                        <p>Open or active bug reports</p>
                    </article>
                </div>

                <div className="project-grid two-column">
                    <section className="panel-card">
                        <div className="section-heading">
                            <div>
                                <span className="eyebrow">Project Settings</span>
                                <h2>{selectedProject.permissions.canManageProject ? "Owner controls" : "Project details"}</h2>
                            </div>
                        </div>
                        <div className="form-grid">
                            <label>
                                <span>Name</span>
                                <input
                                    value={projectSettingsForm.name}
                                    onChange={(event) =>
                                        setProjectSettingsForm((current) => ({ ...current, name: event.target.value }))
                                    }
                                    disabled={!selectedProject.permissions.canManageProject}
                                />
                            </label>
                            <label>
                                <span>Description</span>
                                <textarea
                                    value={projectSettingsForm.description}
                                    onChange={(event) =>
                                        setProjectSettingsForm((current) => ({
                                            ...current,
                                            description: event.target.value,
                                        }))
                                    }
                                    disabled={!selectedProject.permissions.canManageProject}
                                    rows={4}
                                />
                            </label>
                            {selectedProject.permissions.canManageProject ? (
                                <div className="button-row">
                                    <button
                                        type="button"
                                        className="button-primary"
                                        disabled={isWorking}
                                        onClick={() => void handleSaveProjectSettings()}
                                    >
                                        Save settings
                                    </button>
                                    <button
                                        type="button"
                                        className="button-danger"
                                        disabled={isWorking}
                                        onClick={() => void handleDeleteCurrentProject()}
                                    >
                                        Delete project
                                    </button>
                                </div>
                            ) : (
                                <p className="supporting-copy">
                                    Only the project owner can edit the project name, description, and repository connections.
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="panel-card">
                        <div className="section-heading">
                            <div>
                                <span className="eyebrow">Repositories</span>
                                <h2>Connected GitHub repos</h2>
                            </div>
                        </div>
                        <div className="repo-stack">
                            {selectedProject.repositories.map((repository) => (
                                <article key={repository.id} className="repo-chip-card">
                                    <div>
                                        <strong>{repository.fullName}</strong>
                                        <p>
                                            {repository.visibility} repo · default branch {repository.defaultBranch}
                                        </p>
                                    </div>
                                    <div className="button-row compact">
                                        <a href={repository.htmlUrl} target="_blank" rel="noreferrer">
                                            Open on GitHub
                                        </a>
                                        {selectedProject.permissions.canManageRepos ? (
                                            <button
                                                type="button"
                                                className="button-ghost small"
                                                onClick={() => void handleRemoveRepository(repository.id)}
                                            >
                                                Disconnect
                                            </button>
                                        ) : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                        {selectedProject.permissions.canManageRepos ? (
                            availableToConnect.length > 0 ? (
                                <div className="repo-connect-grid">
                                    <span className="eyebrow">Add more</span>
                                    <div className="checkbox-grid dense">
                                        {availableToConnect.slice(0, 8).map((repo) => (
                                            <label key={repo.id} className="check-tile">
                                                <input
                                                    type="checkbox"
                                                    checked={createProjectForm.repositoryIds.includes(String(repo.id))}
                                                    onChange={(event) => {
                                                        setCreateProjectForm((current) => ({
                                                            ...current,
                                                            repositoryIds: event.target.checked
                                                                ? [...current.repositoryIds, String(repo.id)]
                                                                : current.repositoryIds.filter(
                                                                      (value) => value !== String(repo.id),
                                                                  ),
                                                        }));
                                                    }}
                                                />
                                                <span>{repo.fullName}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="button-secondary"
                                        disabled={isWorking || createProjectForm.repositoryIds.length === 0}
                                        onClick={() => void handleAddRepositories(createProjectForm.repositoryIds)}
                                    >
                                        Connect selected repos
                                    </button>
                                </div>
                            ) : (
                                <p className="supporting-copy">
                                    All visible GitHub repositories for this account are already connected.
                                </p>
                            )
                        ) : null}
                    </section>
                </div>

                <section className="panel-card">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">Activity</span>
                            <h2>Recent project history</h2>
                        </div>
                    </div>
                    <div className="activity-list">
                        {selectedProject.recentActivity.length === 0 ? (
                            <div className="empty-state compact-empty">
                                <h3>No activity yet</h3>
                                <p>Project updates, board moves, comments, and automation logs will appear here.</p>
                            </div>
                        ) : (
                            selectedProject.recentActivity.map((activity) => (
                                <article key={activity.id} className="activity-row">
                                    <div className="avatar mini">
                                        {activity.actor?.githubAvatarUrl ? (
                                            <img src={activity.actor.githubAvatarUrl} alt="" />
                                        ) : (
                                            <span>{getInitials(activity.actor?.username ?? "TM")}</span>
                                        )}
                                    </div>
                                    <div>
                                        <strong>{activity.description}</strong>
                                        <p>{formatDateTime(activity.createdAt)}</p>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </section>
            </section>
        );
    }

    function renderBoardTab() {
        if (!selectedProject) {
            return null;
        }

        return (
            <section className="project-panel-stack">
                {selectedProject.permissions.canCreateTasks ? (
                    <section className="panel-card">
                        <div className="section-heading">
                            <div>
                                <span className="eyebrow">Create Task</span>
                                <h2>Push work onto the board</h2>
                            </div>
                        </div>
                        <form className="form-grid" onSubmit={handleCreateTaskSubmit}>
                            <label>
                                <span>Title</span>
                                <input
                                    value={createTaskForm.title}
                                    onChange={(event) =>
                                        setCreateTaskForm((current) => ({ ...current, title: event.target.value }))
                                    }
                                    placeholder="Ship OAuth reconnect flow"
                                    required
                                />
                            </label>
                            <label>
                                <span>Description</span>
                                <textarea
                                    rows={3}
                                    value={createTaskForm.description}
                                    onChange={(event) =>
                                        setCreateTaskForm((current) => ({ ...current, description: event.target.value }))
                                    }
                                    placeholder="Include any implementation notes, reviewers, or @mentions."
                                />
                            </label>
                            <div className="form-row split">
                                <label>
                                    <span>Status</span>
                                    <select
                                        value={createTaskForm.status}
                                        onChange={(event) =>
                                            setCreateTaskForm((current) => ({
                                                ...current,
                                                status: event.target.value as TaskStatus,
                                            }))
                                        }
                                    >
                                        {selectedProject.boardColumns.map((column) => (
                                            <option key={column.id} value={column.id}>
                                                {column.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    <span>From bug report</span>
                                    <select
                                        value={createTaskForm.bugReportId}
                                        onChange={(event) =>
                                            setCreateTaskForm((current) => ({
                                                ...current,
                                                bugReportId: event.target.value,
                                            }))
                                        }
                                    >
                                        <option value="">Direct task</option>
                                        {selectedProject.bugReports.map((bug) => (
                                            <option key={bug.id} value={bug.id}>
                                                {bug.title}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className="checkbox-grid dense">
                                {assignableMembers.map((member) => (
                                    <label key={member.id} className="check-tile">
                                        <input
                                            type="checkbox"
                                            checked={createTaskForm.assigneeIds.includes(member.user.id)}
                                            onChange={(event) =>
                                                setCreateTaskForm((current) => ({
                                                    ...current,
                                                    assigneeIds: event.target.checked
                                                        ? [...current.assigneeIds, member.user.id]
                                                        : current.assigneeIds.filter((id) => id !== member.user.id),
                                                }))
                                            }
                                        />
                                        <span>{member.user.username}</span>
                                    </label>
                                ))}
                            </div>
                            <label className="inline-check">
                                <input
                                    type="checkbox"
                                    checked={createTaskForm.markAsResolution}
                                    onChange={(event) =>
                                        setCreateTaskForm((current) => ({
                                            ...current,
                                            markAsResolution: event.target.checked,
                                        }))
                                    }
                                />
                                <span>Mark as resolution task when created</span>
                            </label>
                            <button type="submit" className="button-primary" disabled={isWorking}>
                                Create task
                            </button>
                        </form>
                    </section>
                ) : null}

                <div className="project-grid board-layout">
                    <section className="kanban-shell">
                        <div className="kanban-grid">
                            {selectedProject.boardColumns.map((column) => {
                                const tasks = selectedProject.tasks.filter((task) => task.status === column.id);
                                return (
                                    <div
                                        key={column.id}
                                        className="kanban-column"
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => void handleTaskStatusDrop(column.id)}
                                    >
                                        <div className="kanban-column-header">
                                            <div>
                                                <span className="eyebrow">{column.label}</span>
                                                <h3>{tasks.length}</h3>
                                            </div>
                                        </div>
                                        <div className="kanban-cards">
                                            {tasks.map((task) => (
                                                <article
                                                    key={task.id}
                                                    className={classNames("task-card", selectedTaskId === task.id && "selected")}
                                                    draggable={selectedProject.permissions.canMoveTasks}
                                                    onDragStart={() => setDraggedTaskId(task.id)}
                                                    onClick={() => setSelectedTaskId(task.id)}
                                                >
                                                    <div className="task-card-top">
                                                        <strong>{task.title}</strong>
                                                        {task.isResolutionTask ? <span className="tag">Resolution</span> : null}
                                                    </div>
                                                    <p>{task.description || "No description yet."}</p>
                                                    <div className="task-card-meta">
                                                        <span>
                                                            {task.assignees.length > 0
                                                                ? task.assignees.map((assignee) => assignee.username).join(", ")
                                                                : "Unassigned"}
                                                        </span>
                                                        {task.bugReportTitle ? <span>Bug: {task.bugReportTitle}</span> : null}
                                                    </div>
                                                </article>
                                            ))}
                                            {tasks.length === 0 ? (
                                                <div className="empty-state compact-empty">
                                                    <p>Drop a task here.</p>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <aside className="detail-panel">
                        {selectedTask ? (
                            <>
                                <div className="detail-panel-header">
                                    <div>
                                        <span className="eyebrow">Task Detail</span>
                                        <h2>{selectedTask.title}</h2>
                                    </div>
                                    {selectedTask.bugReportTitle ? <span className="tag">From {selectedTask.bugReportTitle}</span> : null}
                                </div>
                                <div className="form-grid">
                                    <label>
                                        <span>Title</span>
                                        <input
                                            value={taskEditor.title}
                                            onChange={(event) =>
                                                setTaskEditor((current) => ({ ...current, title: event.target.value }))
                                            }
                                            disabled={!selectedProject.permissions.canEditTasks}
                                        />
                                    </label>
                                    <label>
                                        <span>Description</span>
                                        <textarea
                                            rows={4}
                                            value={taskEditor.description}
                                            onChange={(event) =>
                                                setTaskEditor((current) => ({
                                                    ...current,
                                                    description: event.target.value,
                                                }))
                                            }
                                            disabled={!selectedProject.permissions.canEditTasks}
                                        />
                                    </label>
                                    <div className="form-row split">
                                        <label>
                                            <span>Status</span>
                                            <select
                                                value={taskEditor.status}
                                                onChange={(event) =>
                                                    setTaskEditor((current) => ({
                                                        ...current,
                                                        status: event.target.value as TaskStatus,
                                                    }))
                                                }
                                                disabled={!selectedProject.permissions.canEditTasks}
                                            >
                                                {selectedProject.boardColumns.map((column) => (
                                                    <option key={column.id} value={column.id}>
                                                        {column.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <div>
                                            <span className="field-label">Assignees</span>
                                            <div className="checkbox-grid dense">
                                                {assignableMembers.map((member) => (
                                                    <label key={member.id} className="check-tile">
                                                        <input
                                                            type="checkbox"
                                                            checked={taskEditor.assigneeIds.includes(member.user.id)}
                                                            onChange={(event) =>
                                                                setTaskEditor((current) => ({
                                                                    ...current,
                                                                    assigneeIds: event.target.checked
                                                                        ? [...current.assigneeIds, member.user.id]
                                                                        : current.assigneeIds.filter((id) => id !== member.user.id),
                                                                }))
                                                            }
                                                            disabled={!selectedProject.permissions.canEditTasks}
                                                        />
                                                        <span>{member.user.username}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {selectedProject.permissions.canEditTasks ? (
                                        <button type="button" className="button-primary" disabled={isWorking} onClick={() => void handleSaveTask()}>
                                            Save task changes
                                        </button>
                                    ) : null}
                                </div>

                                <div className="linked-section-grid">
                                    <section className="nested-card">
                                        <h3>Direct GitHub issues</h3>
                                        <div className="link-list">
                                            {selectedTask.directGitHubIssues.length === 0 ? (
                                                <p className="supporting-copy">No task-specific GitHub issues linked yet.</p>
                                            ) : (
                                                selectedTask.directGitHubIssues.map((issue) => (
                                                    <a key={issue.id} href={issue.htmlUrl} target="_blank" rel="noreferrer">
                                                        {issue.repositoryFullName}#{issue.issueNumber} · {issue.title}
                                                    </a>
                                                ))
                                            )}
                                        </div>
                                    </section>
                                    <section className="nested-card">
                                        <h3>Inherited bug issues</h3>
                                        <div className="link-list">
                                            {selectedTask.inheritedGitHubIssues.length === 0 ? (
                                                <p className="supporting-copy">This task is not inheriting GitHub issue links.</p>
                                            ) : (
                                                selectedTask.inheritedGitHubIssues.map((issue) => (
                                                    <a key={issue.id} href={issue.htmlUrl} target="_blank" rel="noreferrer">
                                                        {issue.repositoryFullName}#{issue.issueNumber} · {issue.title}
                                                    </a>
                                                ))
                                            )}
                                        </div>
                                    </section>
                                </div>

                                {selectedProject.permissions.canEditTasks ? (
                                    <div className="linked-section-grid">
                                        <section className="nested-card">
                                            <h3>Link a GitHub issue</h3>
                                            <div className="form-grid compact-form">
                                                <label>
                                                    <span>Repository</span>
                                                    <select
                                                        value={taskIssueForm.repositoryFullName}
                                                        onChange={(event) =>
                                                            setTaskIssueForm((current) => ({
                                                                ...current,
                                                                repositoryFullName: event.target.value,
                                                            }))
                                                        }
                                                    >
                                                        {selectedProject.repositories.map((repository) => (
                                                            <option key={repository.id} value={repository.fullName}>
                                                                {repository.fullName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label>
                                                    <span>Issue number</span>
                                                    <input
                                                        value={taskIssueForm.issueNumber}
                                                        onChange={(event) =>
                                                            setTaskIssueForm((current) => ({
                                                                ...current,
                                                                issueNumber: event.target.value,
                                                            }))
                                                        }
                                                        placeholder="142"
                                                    />
                                                </label>
                                                <label>
                                                    <span>Or paste issue URL</span>
                                                    <input
                                                        value={taskIssueForm.issueUrl}
                                                        onChange={(event) =>
                                                            setTaskIssueForm((current) => ({
                                                                ...current,
                                                                issueUrl: event.target.value,
                                                            }))
                                                        }
                                                        placeholder="https://github.com/org/repo/issues/142"
                                                    />
                                                </label>
                                                <button type="button" className="button-secondary" onClick={() => void handleAddTaskIssue()}>
                                                    Link issue
                                                </button>
                                            </div>
                                        </section>
                                        <section className="nested-card">
                                            <h3>Create branch</h3>
                                            <div className="form-grid compact-form">
                                                <label>
                                                    <span>Repository</span>
                                                    <select
                                                        value={taskBranchForm.repositoryId}
                                                        onChange={(event) =>
                                                            setTaskBranchForm((current) => ({
                                                                ...current,
                                                                repositoryId: event.target.value,
                                                            }))
                                                        }
                                                    >
                                                        {selectedProject.repositories.map((repository) => (
                                                            <option key={repository.id} value={repository.id}>
                                                                {repository.fullName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label>
                                                    <span>Branch name</span>
                                                    <input
                                                        value={taskBranchForm.branchName}
                                                        onChange={(event) =>
                                                            setTaskBranchForm((current) => ({
                                                                ...current,
                                                                branchName: event.target.value,
                                                            }))
                                                        }
                                                        placeholder={`task-${selectedTask.id}`}
                                                    />
                                                </label>
                                                <button type="button" className="button-secondary" onClick={() => void handleCreateBranch()}>
                                                    Create branch
                                                </button>
                                                {selectedTask.branchUrl ? (
                                                    <a href={selectedTask.branchUrl} target="_blank" rel="noreferrer">
                                                        Open branch on GitHub
                                                    </a>
                                                ) : null}
                                            </div>
                                        </section>
                                    </div>
                                ) : null}

                                <section className="nested-card">
                                    <h3>Comments</h3>
                                    <div className="comment-thread">
                                        {selectedTask.comments.length === 0 ? (
                                            <p className="supporting-copy">No comments yet.</p>
                                        ) : (
                                            selectedTask.comments.map((comment) => (
                                                <article key={comment.id} className="comment-item">
                                                    <header>
                                                        <strong>{comment.author.username}</strong>
                                                        <span>{formatDateTime(comment.createdAt)}</span>
                                                    </header>
                                                    <p>{comment.body}</p>
                                                </article>
                                            ))
                                        )}
                                    </div>
                                    {selectedProject.permissions.canComment ? (
                                        <div className="comment-editor">
                                            <textarea
                                                rows={3}
                                                value={taskCommentDraft}
                                                onChange={(event) => setTaskCommentDraft(event.target.value)}
                                                placeholder="Add a comment and mention teammates with @username"
                                            />
                                            <button type="button" className="button-primary" onClick={() => void handleAddTaskComment()}>
                                                Post comment
                                            </button>
                                        </div>
                                    ) : null}
                                </section>

                                <section className="nested-card">
                                    <h3>Activity</h3>
                                    <div className="activity-list compact-activity">
                                        {selectedTask.activity.map((activity) => (
                                            <article key={activity.id} className="activity-row">
                                                <div>
                                                    <strong>{activity.description}</strong>
                                                    <p>{formatDateTime(activity.createdAt)}</p>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            </>
                        ) : (
                            <div className="empty-state detail-empty">
                                <h3>Select a task</h3>
                                <p>Click a board card to inspect comments, assignees, GitHub links, and branch actions.</p>
                            </div>
                        )}
                    </aside>
                </div>
            </section>
        );
    }

    function renderBugsTab() {
        if (!selectedProject) {
            return null;
        }

        return (
            <section className="project-panel-stack">
                {selectedProject.permissions.canCreateBugReports ? (
                    <section className="panel-card">
                        <div className="section-heading">
                            <div>
                                <span className="eyebrow">Create Bug</span>
                                <h2>Capture defects without forcing them onto the board</h2>
                            </div>
                        </div>
                        <form className="form-grid" onSubmit={handleCreateBugSubmit}>
                            <label>
                                <span>Title</span>
                                <input
                                    value={createBugForm.title}
                                    onChange={(event) =>
                                        setCreateBugForm((current) => ({ ...current, title: event.target.value }))
                                    }
                                    placeholder="Checkout page throws 500 after session expiry"
                                    required
                                />
                            </label>
                            <label>
                                <span>Description</span>
                                <textarea
                                    rows={3}
                                    value={createBugForm.description}
                                    onChange={(event) =>
                                        setCreateBugForm((current) => ({
                                            ...current,
                                            description: event.target.value,
                                        }))
                                    }
                                    placeholder="Repro steps, expected behavior, logs, and @mentions."
                                />
                            </label>
                            <label>
                                <span>Status</span>
                                <select
                                    value={createBugForm.status}
                                    onChange={(event) =>
                                        setCreateBugForm((current) => ({
                                            ...current,
                                            status: event.target.value as BugStatus,
                                        }))
                                    }
                                >
                                    {Object.entries(selectedProject.bugStatusLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button type="submit" className="button-primary" disabled={isWorking}>
                                Create bug report
                            </button>
                        </form>
                    </section>
                ) : null}

                <div className="project-grid board-layout">
                    <section className="bug-list-card panel-card">
                        <div className="section-heading">
                            <div>
                                <span className="eyebrow">Bug Reports</span>
                                <h2>Tracked defects</h2>
                            </div>
                        </div>
                        <div className="bug-list">
                            {selectedProject.bugReports.map((bug) => (
                                <article
                                    key={bug.id}
                                    className={classNames("bug-card", selectedBugId === bug.id && "selected")}
                                    onClick={() => setSelectedBugId(bug.id)}
                                >
                                    <div className="task-card-top">
                                        <strong>{bug.title}</strong>
                                        <span className="tag">{selectedProject.bugStatusLabels[bug.status]}</span>
                                    </div>
                                    <p>{bug.description || "No description yet."}</p>
                                    <div className="task-card-meta">
                                        <span>{bug.tasks.length} related task{bug.tasks.length === 1 ? "" : "s"}</span>
                                        <span>Reported {formatShortDate(bug.createdAt)}</span>
                                    </div>
                                </article>
                            ))}
                            {selectedProject.bugReports.length === 0 ? (
                                <div className="empty-state compact-empty">
                                    <p>No bug reports yet.</p>
                                </div>
                            ) : null}
                        </div>
                    </section>

                    <aside className="detail-panel">
                        {selectedBug ? (
                            <>
                                <div className="detail-panel-header">
                                    <div>
                                        <span className="eyebrow">Bug Detail</span>
                                        <h2>{selectedBug.title}</h2>
                                    </div>
                                    <span className="tag">{selectedProject.bugStatusLabels[selectedBug.status]}</span>
                                </div>
                                <div className="form-grid">
                                    <label>
                                        <span>Title</span>
                                        <input
                                            value={bugEditor.title}
                                            onChange={(event) =>
                                                setBugEditor((current) => ({ ...current, title: event.target.value }))
                                            }
                                            disabled={!canEditSelectedBug}
                                        />
                                    </label>
                                    <label>
                                        <span>Description</span>
                                        <textarea
                                            rows={4}
                                            value={bugEditor.description}
                                            onChange={(event) =>
                                                setBugEditor((current) => ({
                                                    ...current,
                                                    description: event.target.value,
                                                }))
                                            }
                                            disabled={!canEditSelectedBug}
                                        />
                                    </label>
                                    <label>
                                        <span>Status</span>
                                        <select
                                            value={bugEditor.status}
                                            onChange={(event) =>
                                                setBugEditor((current) => ({
                                                    ...current,
                                                    status: event.target.value as BugStatus,
                                                }))
                                            }
                                            disabled={!canEditSelectedBug}
                                        >
                                            {Object.entries(selectedProject.bugStatusLabels).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {canEditSelectedBug ? (
                                        <button type="button" className="button-primary" onClick={() => void handleSaveBug()}>
                                            Save bug report
                                        </button>
                                    ) : null}
                                </div>

                                <section className="nested-card">
                                    <div className="section-heading compact-heading">
                                        <div>
                                            <span className="eyebrow">Tasks</span>
                                            <h3>Work linked to this bug</h3>
                                        </div>
                                        {selectedProject.permissions.canCreateTasks ? (
                                            <button type="button" className="button-secondary small" onClick={() => prefillTaskFromBug(selectedBug)}>
                                                Create task from bug
                                            </button>
                                        ) : null}
                                    </div>
                                    <div className="bug-task-list">
                                        {selectedBug.tasks.length === 0 ? (
                                            <p className="supporting-copy">No tasks have been created from this bug report yet.</p>
                                        ) : (
                                            selectedBug.tasks.map((task) => (
                                                <article key={task.id} className="bug-task-row">
                                                    <div>
                                                        <strong>{task.title}</strong>
                                                        <p>{selectedProject.taskStatusLabels[task.status]}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="button-ghost small"
                                                        onClick={() => {
                                                            setActiveTab("board");
                                                            setSelectedTaskId(task.id);
                                                        }}
                                                    >
                                                        Open task
                                                    </button>
                                                </article>
                                            ))
                                        )}
                                    </div>

                                    {canEditSelectedBug ? (
                                        <div className="form-row split align-end">
                                            <label>
                                                <span>Resolution task</span>
                                                <select value={bugResolutionTaskId} onChange={(event) => setBugResolutionTaskId(event.target.value)}>
                                                    <option value="">None selected</option>
                                                    {selectedBug.tasks.map((task) => (
                                                        <option key={task.id} value={task.id}>
                                                            {task.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <button type="button" className="button-secondary" onClick={() => void handleSaveBugResolutionTask()}>
                                                Save resolution task
                                            </button>
                                        </div>
                                    ) : null}
                                </section>

                                <section className="nested-card">
                                    <h3>Linked GitHub issues</h3>
                                    <div className="link-list">
                                        {selectedBug.linkedGitHubIssues.length === 0 ? (
                                            <p className="supporting-copy">No GitHub issues linked to this bug report.</p>
                                        ) : (
                                            selectedBug.linkedGitHubIssues.map((issue) => (
                                                <a key={issue.id} href={issue.htmlUrl} target="_blank" rel="noreferrer">
                                                    {issue.repositoryFullName}#{issue.issueNumber} · {issue.title}
                                                </a>
                                            ))
                                        )}
                                    </div>
                                    {canEditSelectedBug ? (
                                        <div className="form-grid compact-form top-gap">
                                            <label>
                                                <span>Repository</span>
                                                <select
                                                    value={bugIssueForm.repositoryFullName}
                                                    onChange={(event) =>
                                                        setBugIssueForm((current) => ({
                                                            ...current,
                                                            repositoryFullName: event.target.value,
                                                        }))
                                                    }
                                                >
                                                    {selectedProject.repositories.map((repository) => (
                                                        <option key={repository.id} value={repository.fullName}>
                                                            {repository.fullName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label>
                                                <span>Issue number</span>
                                                <input
                                                    value={bugIssueForm.issueNumber}
                                                    onChange={(event) =>
                                                        setBugIssueForm((current) => ({
                                                            ...current,
                                                            issueNumber: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="88"
                                                />
                                            </label>
                                            <label>
                                                <span>Or paste issue URL</span>
                                                <input
                                                    value={bugIssueForm.issueUrl}
                                                    onChange={(event) =>
                                                        setBugIssueForm((current) => ({
                                                            ...current,
                                                            issueUrl: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="https://github.com/org/repo/issues/88"
                                                />
                                            </label>
                                            <button type="button" className="button-secondary" onClick={() => void handleAddBugIssue()}>
                                                Link issue
                                            </button>
                                        </div>
                                    ) : null}
                                </section>

                                <section className="nested-card">
                                    <h3>Comments</h3>
                                    <div className="comment-thread">
                                        {selectedBug.comments.map((comment) => (
                                            <article key={comment.id} className="comment-item">
                                                <header>
                                                    <strong>{comment.author.username}</strong>
                                                    <span>{formatDateTime(comment.createdAt)}</span>
                                                </header>
                                                <p>{comment.body}</p>
                                            </article>
                                        ))}
                                        {selectedBug.comments.length === 0 ? <p className="supporting-copy">No comments yet.</p> : null}
                                    </div>
                                    {selectedProject.permissions.canComment ? (
                                        <div className="comment-editor">
                                            <textarea
                                                rows={3}
                                                value={bugCommentDraft}
                                                onChange={(event) => setBugCommentDraft(event.target.value)}
                                                placeholder="Add reproduction notes or mention teammates with @username"
                                            />
                                            <button type="button" className="button-primary" onClick={() => void handleAddBugComment()}>
                                                Post comment
                                            </button>
                                        </div>
                                    ) : null}
                                </section>

                                <section className="nested-card">
                                    <h3>Activity</h3>
                                    <div className="activity-list compact-activity">
                                        {selectedBug.activity.map((activity) => (
                                            <article key={activity.id} className="activity-row">
                                                <div>
                                                    <strong>{activity.description}</strong>
                                                    <p>{formatDateTime(activity.createdAt)}</p>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </section>
                            </>
                        ) : (
                            <div className="empty-state detail-empty">
                                <h3>Select a bug report</h3>
                                <p>Open a report to manage linked tasks, comments, GitHub issues, and resolution flow.</p>
                            </div>
                        )}
                    </aside>
                </div>
            </section>
        );
    }

    function renderUsersTab() {
        if (!selectedProject) {
            return null;
        }

        return (
            <section className="project-panel-stack">
                {selectedProject.permissions.canManageUsers ? (
                    <section className="panel-card">
                        <div className="section-heading">
                            <div>
                                <span className="eyebrow">Invite People</span>
                                <h2>Manage project access</h2>
                            </div>
                        </div>
                        <form className="form-row split" onSubmit={(event) => void handleInviteMember(event)}>
                            <label>
                                <span>Username or email</span>
                                <input
                                    value={inviteForm.identifier}
                                    onChange={(event) =>
                                        setInviteForm((current) => ({ ...current, identifier: event.target.value }))
                                    }
                                    placeholder="alice or alice@example.com"
                                    required
                                />
                            </label>
                            <label>
                                <span>Role</span>
                                <select
                                    value={inviteForm.role}
                                    onChange={(event) =>
                                        setInviteForm((current) => ({
                                            ...current,
                                            role: event.target.value as ProjectRole,
                                        }))
                                    }
                                >
                                    <option value="admin">Admin</option>
                                    <option value="member">Member</option>
                                    <option value="viewer">Viewer</option>
                                </select>
                            </label>
                            <button type="submit" className="button-primary" disabled={isWorking}>
                                Add user
                            </button>
                        </form>
                    </section>
                ) : null}

                <section className="panel-card">
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">Team</span>
                            <h2>Project members and roles</h2>
                        </div>
                    </div>
                    <div className="member-list">
                        {selectedProject.members.map((member) => (
                            <article key={member.id} className="member-row">
                                <div className="member-meta">
                                    <div className="avatar mini">
                                        {member.user.githubAvatarUrl ? (
                                            <img src={member.user.githubAvatarUrl} alt="" />
                                        ) : (
                                            <span>{getInitials(member.user.username)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <strong>{member.user.username}</strong>
                                        <p>
                                            {member.user.email} · {member.user.githubConnected ? "GitHub linked" : "No GitHub linked"}
                                        </p>
                                    </div>
                                </div>
                                <div className="member-actions">
                                    <span className="tag subtle">{member.role}</span>
                                    {selectedProject.permissions.canManageUsers && member.role !== "owner" ? (
                                        <>
                                            <select value={member.role} onChange={(event) => void handleChangeMemberRole(member.id, event.target.value as ProjectRole)}>
                                                <option value="admin">Admin</option>
                                                <option value="member">Member</option>
                                                <option value="viewer">Viewer</option>
                                            </select>
                                            <button type="button" className="button-ghost small" onClick={() => void handleRemoveMember(member.id)}>
                                                Remove
                                            </button>
                                        </>
                                    ) : null}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            </section>
        );
    }

    function renderWorkspace() {
        return (
            <main className="workspace-shell">
                <aside className="workspace-sidebar">
                    <section className="sidebar-card brand-card">
                        <span className="eyebrow">Team Project Manager</span>
                        <h1>Developer workspace</h1>
                        <p>Track repository-backed projects, bugs, reviews, and the people moving them forward.</p>
                    </section>

                    <section className="sidebar-card profile-card">
                        <div className="profile-block align-start">
                            <div className="avatar large">
                                {user?.githubAvatarUrl ? <img src={user.githubAvatarUrl} alt="" /> : <span>{getInitials(user?.username ?? "TP")}</span>}
                            </div>
                            <div>
                                <span className="eyebrow">Signed in</span>
                                <h2>{user?.username}</h2>
                                <p>
                                    {user?.email}
                                    {user?.githubConnected && user.githubUsername
                                        ? ` · GitHub @${user.githubUsername}`
                                        : " · GitHub not connected"}
                                </p>
                            </div>
                        </div>
                        <div className="button-row compact">
                            <button type="button" className="button-secondary" onClick={() => void handleConnectGitHub()}>
                                {user?.githubConnected ? "Reconnect GitHub" : "Connect GitHub"}
                            </button>
                            <button type="button" className="button-ghost" onClick={handleLogout}>
                                Log out
                            </button>
                        </div>
                        {workspace?.githubRepoError ? <div className="message error inline-message">{workspace.githubRepoError}</div> : null}
                    </section>

                    <section className="sidebar-card">
                        <div className="section-heading compact-heading">
                            <div>
                                <span className="eyebrow">Create Project</span>
                                <h2>New project</h2>
                            </div>
                        </div>
                        {!user?.githubConnected ? (
                            <div className="empty-state compact-empty left-align">
                                <h3>GitHub required</h3>
                                <p>Connect GitHub first. Every project has to start with at least one repository.</p>
                                <button type="button" className="button-primary" onClick={() => void handleConnectGitHub()}>
                                    Connect GitHub
                                </button>
                            </div>
                        ) : (
                            <form className="form-grid compact-form" onSubmit={handleCreateProjectSubmit}>
                                <label>
                                    <span>Name</span>
                                    <input
                                        value={createProjectForm.name}
                                        onChange={(event) =>
                                            setCreateProjectForm((current) => ({ ...current, name: event.target.value }))
                                        }
                                        placeholder="Platform reliability"
                                        required
                                    />
                                </label>
                                <label>
                                    <span>Description</span>
                                    <textarea
                                        rows={3}
                                        value={createProjectForm.description}
                                        onChange={(event) =>
                                            setCreateProjectForm((current) => ({
                                                ...current,
                                                description: event.target.value,
                                            }))
                                        }
                                        placeholder="What is this project shipping?"
                                    />
                                </label>
                                <div>
                                    <span className="field-label">Connected repositories</span>
                                    <div className="checkbox-grid dense scroll-grid">
                                        {availableRepos.map((repo: Repo) => (
                                            <label key={repo.id} className="check-tile">
                                                <input
                                                    type="checkbox"
                                                    checked={createProjectForm.repositoryIds.includes(String(repo.id))}
                                                    onChange={(event) =>
                                                        setCreateProjectForm((current) => ({
                                                            ...current,
                                                            repositoryIds: event.target.checked
                                                                ? [...current.repositoryIds, String(repo.id)]
                                                                : current.repositoryIds.filter((value) => value !== String(repo.id)),
                                                        }))
                                                    }
                                                />
                                                <span>{repo.fullName}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <button type="submit" className="button-primary" disabled={isWorking || createProjectForm.repositoryIds.length === 0}>
                                    Create project
                                </button>
                            </form>
                        )}
                    </section>

                    <section className="sidebar-card">
                        <div className="section-heading compact-heading">
                            <div>
                                <span className="eyebrow">Projects</span>
                                <h2>Your workspaces</h2>
                            </div>
                        </div>
                        <div className="project-list">
                            {workspace?.projects.length ? (
                                workspace.projects.map((project) => (
                                    <button key={project.id} type="button" className={classNames("project-list-item", selectedProjectId === project.id && "selected")} onClick={() => void selectProject(project.id)}>
                                        <div>
                                            <strong>{project.name}</strong>
                                            <p>{project.description || "No description"}</p>
                                        </div>
                                        <div className="project-list-meta">
                                            <span>{project.role}</span>
                                            <span>{project.openBugCount} bugs</span>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="empty-state compact-empty left-align">
                                    <h3>No projects yet</h3>
                                    <p>Create one with GitHub, or wait for a teammate to add you to an existing project.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="sidebar-card">
                        <div className="section-heading compact-heading">
                            <div>
                                <span className="eyebrow">Inbox</span>
                                <h2>{unreadNotifications.length} unread</h2>
                            </div>
                        </div>
                        <div className="notification-list">
                            {workspace?.notifications.length ? (
                                workspace.notifications.map((notification) => (
                                    <article key={notification.id} className={classNames("notification-item", !notification.isRead && "unread")}>
                                        <div>
                                            <strong>{notification.message}</strong>
                                            <p>{formatDateTime(notification.createdAt)}</p>
                                        </div>
                                        {!notification.isRead ? (
                                            <button type="button" className="button-ghost small" onClick={() => void handleReadNotification(notification)}>
                                                Mark read
                                            </button>
                                        ) : null}
                                    </article>
                                ))
                            ) : (
                                <p className="supporting-copy">No notifications yet.</p>
                            )}
                        </div>
                    </section>
                </aside>

                <section className="workspace-main">
                    {error ? <div className="message error">{error}</div> : null}
                    {notice ? <div className="message success">{notice}</div> : null}

                    {selectedProject ? (
                        <>
                            <header className="project-header panel-card">
                                <div>
                                    <span className="eyebrow">{selectedProject.role} access</span>
                                    <h1>{selectedProject.name}</h1>
                                    <p>{selectedProject.description || "No project description yet."}</p>
                                </div>
                                <div className="project-header-meta">
                                    <span>{selectedProject.repositories.length} repos</span>
                                    <span>{selectedProject.members.length} users</span>
                                    <span>Updated {formatDateTime(selectedProject.updatedAt)}</span>
                                </div>
                            </header>

                            <nav className="tab-bar" aria-label="Project tabs">
                                {[
                                    ["overview", "Overview"],
                                    ["board", "Board"],
                                    ["bugs", "Bugs"],
                                    ["users", "Users"],
                                ].map(([value, label]) => (
                                    <button key={value} type="button" className={classNames("tab-button", activeTab === value && "active")} onClick={() => setActiveTab(value as AppTab)}>
                                        {label}
                                    </button>
                                ))}
                            </nav>

                            {activeTab === "overview" ? renderOverviewTab() : null}
                            {activeTab === "board" ? renderBoardTab() : null}
                            {activeTab === "bugs" ? renderBugsTab() : null}
                            {activeTab === "users" ? renderUsersTab() : null}
                        </>
                    ) : (
                        <section className="panel-card empty-workspace-card">
                            <span className="eyebrow">Ready when you are</span>
                            <h1>Choose or create a project</h1>
                            <p>
                                Projects are the hub for tasks, bug reports, the Kanban board, connected repositories,
                                and team members. Create one from the sidebar or open an existing project to get moving.
                            </p>
                        </section>
                    )}
                </section>
            </main>
        );
    }

    if (isBooting) {
        return (
            <main className="loading-shell">
                <div className="loading-card">
                    <span className="eyebrow">Team Project Manager</span>
                    <h1>Preparing your workspace</h1>
                    <p>{busyLabel ?? "Loading authentication state..."}</p>
                </div>
            </main>
        );
    }

    if (!workspace || !user) {
        return renderAuthScreen();
    }

    return renderWorkspace();
}

export default App;









