import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  addBugComment,
  addProjectRepos,
  addTaskComment,
  buildApiUrl,
  createBugReport,
  createTask,
  createTaskBranch,
  deleteProject,
  endProjectSprint,
  getProject,
  getProjectGitHubIssues,
  importBugFromGitHubIssue,
  removeProjectRepo,
  toggleBugCommentReaction,
  toggleTaskCommentReaction,
  updateBugReport,
  updateProjectSettings,
  updateProjectSprint,
  updateTask,
} from "../api";
import { TopNav } from "../components/TopNav";
import { PublicRouteView } from "../features/auth/components/PublicRouteView";
import { useThemeMode } from "../features/auth/hooks/useThemeMode";
import { useGitHubOauthCallback } from "../features/github/hooks/useGitHubOauthCallback";
import { useNotificationPanel } from "../features/notifications/hooks/useNotificationPanel";
import { useNotificationController } from "../features/notifications/hooks/useNotificationController";
import { OrganizationWorkspaceView } from "../features/organizations/components/OrganizationWorkspaceView";
import { useOrganizationController } from "../features/organizations/hooks/useOrganizationController";
import { useOrganizationSelection } from "../features/organizations/hooks/useOrganizationSelection";
import { ProjectWorkspaceView } from "../features/projects/components/ProjectWorkspaceView";
import { useProjectSelection } from "../features/projects/hooks/useProjectSelection";
import type {
  BacklogPlacement,
  BugReport,
  BugStatus,
  EndSprintUnfinishedAction,
  GitHubIssueCandidate,
  OrganizationSummary,
  PriorityLevel,
  ProjectDetail,
  Task,
  TaskStatus,
  WorkspaceResponse,
} from "../types";
import type { NavItem, OrganizationSection, ProjectSection } from "../view-models";
import {
  MARKETING_PATH,
  ORGANIZATIONS_PATH,
  SELECTED_ORGANIZATION_STORAGE_KEY,
  SELECTED_PROJECT_STORAGE_KEY,
  SIGNUP_PATH,
  THEME_MODE_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from "./constants";
import { getFriendlyError } from "./errors";
import {
  getProjectSettingsForm,
  initialBugForm,
  initialLoginForm,
  initialSignupForm,
  initialTaskForm,
  type ProjectSettingsForm,
} from "./forms";
import {
  getOrganizationPath,
  getProjectPath,
  parseRoute,
  toBrowserPath,
} from "./routing";
import { parseStoredNumber } from "./storage";
import { mergeProjectIntoWorkspace } from "./workspace";
import { BootingView } from "./components/BootingView";
import { useWorkspaceSession } from "./hooks/useWorkspaceSession";

function WorkspaceApp() {
  const completeGitHubOauthOnce = useGitHubOauthCallback();
  const { notificationOpen, setNotificationOpen, closeNotifications, toggleNotifications } =
    useNotificationPanel();
  const { themeMode, setThemeMode } = useThemeMode(THEME_MODE_STORAGE_KEY);
  const { selectedOrganizationId, setSelectedOrganizationId } =
    useOrganizationSelection(
      SELECTED_ORGANIZATION_STORAGE_KEY,
      parseStoredNumber(SELECTED_ORGANIZATION_STORAGE_KEY)
    );
  const { selectedProjectId, setSelectedProjectId } = useProjectSelection(
    SELECTED_PROJECT_STORAGE_KEY,
    parseStoredNumber(SELECTED_PROJECT_STORAGE_KEY)
  );
  const [signupForm, setSignupForm] = useState(initialSignupForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(
    null
  );
  const [organizationSection, setOrganizationSection] =
    useState<OrganizationSection>("projects");
  const [projectSection, setProjectSection] = useState<ProjectSection>("board");
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const [showCreateBugForm, setShowCreateBugForm] = useState(false);
  const [showImportBugForm, setShowImportBugForm] = useState(false);
  const [showEndSprintModal, setShowEndSprintModal] = useState(false);
  const [showEndSprintActionModal, setShowEndSprintActionModal] =
    useState(false);
  const [endSprintReview, setEndSprintReview] = useState("");
  const [endSprintUnfinishedAction, setEndSprintUnfinishedAction] =
    useState<EndSprintUnfinishedAction>("carryover");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [branchTaskId, setBranchTaskId] = useState<number | null>(null);
  const [branchNameDraft, setBranchNameDraft] = useState("");
  const [baseBranchDraft, setBaseBranchDraft] = useState("");
  const [createTaskForm, setCreateTaskForm] = useState(initialTaskForm);
  const [createBugForm, setCreateBugForm] = useState(initialBugForm);
  const [importableGitHubIssues, setImportableGitHubIssues] = useState<
    GitHubIssueCandidate[]
  >([]);
  const [isLoadingImportableGitHubIssues, setIsLoadingImportableGitHubIssues] =
    useState(false);
  const [projectSettingsForm, setProjectSettingsForm] =
    useState<ProjectSettingsForm>({
      name: "",
      description: "",
      useSprints: false,
    });
  const [
    hiddenCompletedProductBacklogTaskIds,
    setHiddenCompletedProductBacklogTaskIds,
  ] = useState<Record<number, number[]>>({});
  const projectSettingsDirtyFieldsRef = useRef<Set<keyof ProjectSettingsForm>>(
    new Set()
  );
  const projectSettingsProjectIdRef = useRef<number | null>(null);
  const selectedProjectUpdatedAtRef = useRef<string | null>(null);
  const isRefreshingProjectFromEventsRef = useRef(false);
  const githubRepoRetryCountRef = useRef(0);
  const user = workspace?.user ?? null;
  const githubRepoErrorMessage =
    workspace?.githubRepoError === "Bad credentials" &&
    workspace?.user.githubConnected
      ? "GitHub connected, but repositories are still syncing. Please wait a moment and try again."
      : workspace?.githubRepoError ?? null;
  const currentRoute = useMemo(() => parseRoute(currentPath), [currentPath]);
  const currentOrganization = useMemo<OrganizationSummary | null>(() => {
    if (!workspace || selectedOrganizationId === null) {
      return null;
    }

    return (
      workspace.organizations.find(
        (organization) => organization.id === selectedOrganizationId
      ) ?? null
    );
  }, [selectedOrganizationId, workspace]);
  const currentOrganizationProjects = useMemo(
    () =>
      workspace?.projects.filter(
        (project) => project.organizationId === currentOrganization?.id
      ) ?? [],
    [currentOrganization?.id, workspace]
  );
  const endSprintUnfinishedTasks = useMemo(() => {
    if (!selectedProject?.activeSprint) {
      return [];
    }

    return selectedProject.tasks.filter(
      (task) =>
        task.sprintId === selectedProject.activeSprint?.id &&
        task.status !== "done"
    );
  }, [selectedProject]);
  const selectedTask = useMemo<Task | null>(() => {
    if (!selectedProject || selectedTaskId === null) {
      return null;
    }

    return (
      selectedProject.tasks.find((task) => task.id === selectedTaskId) ?? null
    );
  }, [selectedProject, selectedTaskId]);
  const selectedBug = useMemo<BugReport | null>(() => {
    if (!selectedProject || selectedBugId === null) {
      return null;
    }

    return (
      selectedProject.bugReports.find((bug) => bug.id === selectedBugId) ?? null
    );
  }, [selectedBugId, selectedProject]);
  const selectedBranchTask = useMemo<Task | null>(() => {
    if (!selectedProject || branchTaskId === null) {
      return null;
    }

    return (
      selectedProject.tasks.find((task) => task.id === branchTaskId) ?? null
    );
  }, [branchTaskId, selectedProject]);

  const organizationNavItems: NavItem<OrganizationSection>[] = useMemo(() => {
    const items: NavItem<OrganizationSection>[] = [
      {
        id: "projects",
        label: "Projects",
        description:
          currentOrganization?.role === "owner" ||
          currentOrganization?.role === "admin"
            ? "Open and add projects in this workspace."
            : "Open the projects shared with this organization.",
      },
    ];

    if (!currentOrganization?.isPersonal) {
      items.push({
        id: "users",
        label: "Users",
        description: "See the people attached to projects here.",
      });
    }

    if (!currentOrganization?.isPersonal) {
      items.push({
        id: "settings",
        label: "Settings",
        description:
          currentOrganization?.role === "owner"
            ? "Organization details and danger zone."
            : currentOrganization?.role === "admin"
            ? "Organization details and leave organization."
            : "Leave organization.",
      });
    }

    return items;
  }, [currentOrganization?.isPersonal, currentOrganization?.role]);

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
      description:
        "Project details, workflow mode, repo reference, and deletion.",
    });

    return items;
  }, [selectedProject?.useSprints]);

  const clearProjectSettingsDraft = useCallback((projectId: number | null = null): void => {
    projectSettingsDirtyFieldsRef.current.clear();
    projectSettingsProjectIdRef.current = projectId;
    if (projectId === null) {
      setProjectSettingsForm({
        name: "",
        description: "",
        useSprints: false,
      });
    }
  }, []);

  const applyProjectSettingsFromProject = useCallback((
    project: ProjectDetail,
    options: { resetDirty?: boolean } = {}
  ): void => {
    const nextForm = getProjectSettingsForm(project);
    const shouldResetDirty =
      options.resetDirty === true ||
      projectSettingsProjectIdRef.current !== project.id;

    if (shouldResetDirty) {
      projectSettingsDirtyFieldsRef.current.clear();
    }

    projectSettingsProjectIdRef.current = project.id;

    setProjectSettingsForm((current) => {
      if (shouldResetDirty) {
        return nextForm;
      }

      const dirtyFields = projectSettingsDirtyFieldsRef.current;
      return {
        name: dirtyFields.has("name") ? current.name : nextForm.name,
        description: dirtyFields.has("description")
          ? current.description
          : nextForm.description,
        useSprints: dirtyFields.has("useSprints")
          ? current.useSprints
          : nextForm.useSprints,
      };
    });
  }, []);

  const clearProjectSelection = useCallback((): void => {
    setSelectedProjectId(null);
    setSelectedProject(null);
    setProjectSection("board");
    setSelectedTaskId(null);
    setSelectedBugId(null);
    setBranchTaskId(null);
    setBranchNameDraft("");
    setBaseBranchDraft("");
    setCreateTaskForm(initialTaskForm);
    setShowImportBugForm(false);
    setImportableGitHubIssues([]);
    setIsLoadingImportableGitHubIssues(false);
    setShowEndSprintModal(false);
    setShowEndSprintActionModal(false);
    setEndSprintReview("");
    setEndSprintUnfinishedAction("carryover");
  }, [setSelectedProjectId]);

  const {
    clearSession,
    handleConnectGitHub,
    handleDisconnectGitHub,
    navigateToPath,
    openOrganization,
    openProject,
    rememberOrganizationSelection,
    runProjectMutation,
    submitLogin,
    submitSignup,
    syncFromPath,
  } = useWorkspaceSession({
    completeGitHubOauthOnce,
    token,
    user,
    setCurrentPath,
    selectedOrganizationId,
    selectedProjectId,
    selectedProject,
    workspace,
    setToken,
    setWorkspace,
    setSelectedOrganizationId,
    setSelectedProjectId,
    setSelectedProject,
    setOrganizationSection,
    setProjectSection,
    setBusyLabel,
    setError,
    setNotice,
    setIsBooting,
    setNotificationOpen,
    setSignupForm,
    setLoginForm,
    applyProjectSettingsFromProject,
    clearProjectSettingsDraft,
    clearProjectSelection,
  });
  const {
    createOrganizationForm,
    createProjectForm,
    handleCancelOrganizationInvite,
    handleChangeOrganizationUserRole,
    handleCreateOrganization,
    handleCreateProject,
    handleDeleteOrganization,
    handleInviteOrganizationUser,
    handleLeaveCurrentOrganization,
    handleRemoveOrganizationUser,
    handleSaveOrganizationSettings,
    organizationSettingsForm,
    organizationUsers,
    organizationUsersLoading,
    setCreateOrganizationForm,
    setCreateProjectForm,
    setOrganizationSettingsForm,
    setShowCreateOrganizationForm,
    setShowCreateProjectForm,
    showCreateOrganizationForm,
    showCreateProjectForm,
  } = useOrganizationController({
    token,
    currentOrganization,
    organizationSection,
    selectedProject,
    setOrganizationSection,
    setBusyLabel,
    setError,
    setNotice,
    syncFromPath,
    clearProjectSelection,
    rememberOrganizationSelection,
    navigateToPath,
  });
  const {
    notifications,
    unreadNotifications,
    handleAcceptNotification,
    handleOpenNotification,
    handleReadNotification,
  } = useNotificationController({
    token,
    workspace,
    setWorkspace,
    selectedProject,
    selectedTask,
    selectedBug,
    setBusyLabel,
    setError,
    setNotice,
    setNotificationOpen,
    openTaskDetail,
    openBugDetail,
    navigateToProject: (projectId) => navigateToPath(getProjectPath(projectId)),
    syncFromPath,
  });
  const navigateToPathRef = useRef(navigateToPath);
  const syncFromPathRef = useRef(syncFromPath);

  useEffect(() => {
    navigateToPathRef.current = navigateToPath;
    syncFromPathRef.current = syncFromPath;
  }, [navigateToPath, syncFromPath]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (
      !selectedProject ||
      selectedProject.useSprints ||
      projectSection !== "history"
    ) {
      return;
    }

    setProjectSection("board");
    navigateToPathRef.current(getProjectPath(selectedProject.id, "board"), true);
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
    selectedProjectUpdatedAtRef.current = selectedProject?.updatedAt ?? null;
  }, [selectedProject?.id, selectedProject?.updatedAt]);

  useEffect(() => {
    if (
      !token ||
      !workspace?.user.githubConnected ||
      workspace.githubRepoError !== "Bad credentials"
    ) {
      githubRepoRetryCountRef.current = 0;
      return;
    }

    if (githubRepoRetryCountRef.current >= 2) {
      return;
    }

    githubRepoRetryCountRef.current += 1;
    const retryDelayMs = 1200 * githubRepoRetryCountRef.current;
    const timeoutId = window.setTimeout(() => {
      void syncFromPathRef.current(token, { quiet: true });
    }, retryDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [token, workspace?.githubRepoError, workspace?.user.githubConnected]);

  useEffect(() => {
    if (!token || !selectedProjectId) {
      return;
    }

    const stream = new EventSource(
      buildApiUrl(
        `/api/projects/${selectedProjectId}/events/?token=${encodeURIComponent(
          token
        )}`
      )
    );

    const parseUpdatedAt = (event: Event): string | null => {
      if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
        return null;
      }

      try {
        const payload = JSON.parse(event.data) as { updatedAt?: unknown };
        return typeof payload.updatedAt === "string" ? payload.updatedAt : null;
      } catch {
        return null;
      }
    };

    const refreshProject = (updatedAt: string | null = null) => {
      if (updatedAt && updatedAt === selectedProjectUpdatedAtRef.current) {
        return;
      }
      if (isRefreshingProjectFromEventsRef.current) {
        return;
      }

      isRefreshingProjectFromEventsRef.current = true;
      void (async () => {
        try {
          const projectResponse = await getProject(token, selectedProjectId);
          selectedProjectUpdatedAtRef.current =
            projectResponse.project.updatedAt;
          startTransition(() => {
            setSelectedProject(projectResponse.project);
            applyProjectSettingsFromProject(projectResponse.project);
            setWorkspace((current) =>
              mergeProjectIntoWorkspace(current, projectResponse.project)
            );
          });
        } catch {
          // Manual refresh paths will recover the UI.
        } finally {
          isRefreshingProjectFromEventsRef.current = false;
        }
      })();
    };

    const handleUpdated = (event: Event) => {
      refreshProject(parseUpdatedAt(event));
    };

    const handleDeleted = () => {
      navigateToPathRef.current(
        selectedOrganizationId
          ? getOrganizationPath(selectedOrganizationId)
          : ORGANIZATIONS_PATH,
        true
      );
      void syncFromPathRef.current(token, { quiet: true });
    };

    stream.addEventListener("project.updated", handleUpdated);
    stream.addEventListener("project.deleted", handleDeleted);

    return () => {
      stream.removeEventListener("project.updated", handleUpdated);
      stream.removeEventListener("project.deleted", handleDeleted);
      stream.close();
      isRefreshingProjectFromEventsRef.current = false;
    };
  }, [applyProjectSettingsFromProject, selectedOrganizationId, selectedProjectId, token]);

  function openCreateTaskForm(
    status: TaskStatus,
    placement: BacklogPlacement = "product"
  ): void {
    setCreateTaskForm({
      ...initialTaskForm,
      status,
      placement,
    });
    setShowCreateTaskForm(true);
  }

  function openCreateTaskFromBug(bugId: number): void {
    if (!selectedProject) {
      return;
    }

    const bug = selectedProject.bugReports.find((item) => item.id === bugId);
    if (!bug) {
      return;
    }

    setCreateTaskForm({
      ...initialTaskForm,
      title: bug.title.startsWith("Fix:") ? bug.title : `Fix: ${bug.title}`,
      description: bug.description,
      priority: bug.priority,
      placement:
        selectedProject.useSprints && selectedProject.activeSprint
          ? "sprint"
          : "product",
      bugReportId: bug.id,
      bugReportTitle: bug.title,
      markAsResolution: !bug.resolutionTaskId,
    });
    setShowCreateTaskForm(true);
  }

  function closeImportBugForm(): void {
    setShowImportBugForm(false);
    setImportableGitHubIssues([]);
  }

  async function loadProjectGitHubIssueCandidates(
    projectId: number
  ): Promise<void> {
    if (!token) {
      return;
    }

    setIsLoadingImportableGitHubIssues(true);
    try {
      const response = await getProjectGitHubIssues(token, projectId);
      startTransition(() => {
        setImportableGitHubIssues(response.issues);
      });
    } catch (reason) {
      setError(getFriendlyError(reason));
    } finally {
      setIsLoadingImportableGitHubIssues(false);
    }
  }

  async function handleOpenImportBugForm(): Promise<void> {
    if (!selectedProject) {
      return;
    }

    setError(null);
    setNotice(null);
    setShowImportBugForm(true);
    await loadProjectGitHubIssueCandidates(selectedProject.id);
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
          bugReportId: createTaskForm.bugReportId ?? undefined,
          markAsResolution: createTaskForm.markAsResolution,
        }),
      createTaskForm.bugReportId ? "Task created from bug." : "Task added."
    );
    setCreateTaskForm(initialTaskForm);
    setShowCreateTaskForm(false);
  }

  async function handleUpdateTaskStatus(
    taskId: number,
    status: TaskStatus
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Updating task",
      () => updateTask(token, taskId, { status }),
      "Task updated."
    );
  }

  async function handleUpdateTaskPriority(
    taskId: number,
    priority: PriorityLevel
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Updating task priority",
      () => updateTask(token, taskId, { priority }),
      "Task updated."
    );
  }

  async function handleMoveTaskPlacement(
    taskId: number,
    placement: BacklogPlacement
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Updating backlog placement",
      () => updateTask(token, taskId, { placement }),
      "Task updated."
    );
  }

  async function handleSaveTaskDetails(
    taskId: number,
    payload: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      assigneeIds: number[];
      resolvedBugIds: number[];
    }>
  ): Promise<boolean> {
    if (!token) {
      return false;
    }

    return runProjectMutation(
      "Saving task",
      () => updateTask(token, taskId, payload),
      "Task saved."
    );
  }

  function openTaskBranchPrompt(task: Task): void {
    const repository = selectedProject?.repositories[0] ?? null;
    if (!repository) {
      setNotice(null);
      setError("This project does not have a connected repository.");
      return;
    }

    setBranchTaskId(task.id);
    setBranchNameDraft(task.branchName || "");
    setBaseBranchDraft(repository.defaultBranch);
  }

  function closeTaskBranchPrompt(): void {
    setBranchTaskId(null);
    setBranchNameDraft("");
    setBaseBranchDraft("");
  }

  async function handleCreateTaskBranch(): Promise<void> {
    if (!token || !selectedProject || !selectedBranchTask) {
      return;
    }

    if (!selectedProject.repositories.length) {
      setNotice(null);
      setError("This project does not have a connected repository.");
      return;
    }

    const didCreateBranch = await runProjectMutation(
      "Creating git branch",
      () =>
        createTaskBranch(token, selectedBranchTask.id, {
          branchName: branchNameDraft.trim() || undefined,
          baseBranch: baseBranchDraft.trim() || undefined,
        }),
      "Git branch created."
    );

    if (didCreateBranch) {
      closeTaskBranchPrompt();
    }
  }

  async function handleAddTaskDetailComment(
    taskId: number,
    payload: {
      body: string;
      anchorType?: string;
      anchorId?: string;
      anchorLabel?: string;
    }
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Adding task comment",
      () => addTaskComment(token, taskId, payload),
      "Comment added."
    );
  }

  async function handleToggleTaskCommentReaction(
    commentId: number,
    emoji: string
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Updating task reaction",
      () => toggleTaskCommentReaction(token, commentId, { emoji }),
      "Reaction updated."
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
      "Bug report added."
    );
    setCreateBugForm(initialBugForm);
    setShowCreateBugForm(false);
  }

  async function handleUpdateBugStatus(
    bugId: number,
    status: BugStatus
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Updating bug report",
      () => updateBugReport(token, bugId, { status }),
      "Bug report updated."
    );
  }

  async function handleUpdateBugPriority(
    bugId: number,
    priority: PriorityLevel
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Updating bug priority",
      () => updateBugReport(token, bugId, { priority }),
      "Bug report updated."
    );
  }

  async function handleSaveBugDetails(
    bugId: number,
    payload: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
    }>
  ): Promise<boolean> {
    if (!token) {
      return false;
    }

    return runProjectMutation(
      "Saving bug report",
      () => updateBugReport(token, bugId, payload),
      "Bug saved."
    );
  }

  async function handleAddBugDetailComment(
    bugId: number,
    payload: {
      body: string;
      anchorType?: string;
      anchorId?: string;
      anchorLabel?: string;
    }
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Adding bug comment",
      () => addBugComment(token, bugId, payload),
      "Comment added."
    );
  }

  async function handleToggleBugCommentReaction(
    commentId: number,
    emoji: string
  ): Promise<void> {
    if (!token) {
      return;
    }

    await runProjectMutation(
      "Updating bug reaction",
      () => toggleBugCommentReaction(token, commentId, { emoji }),
      "Reaction updated."
    );
  }
  async function handleImportBugFromGitHubIssue(
    issue: GitHubIssueCandidate
  ): Promise<void> {
    if (!token || !selectedProject) {
      return;
    }

    const didImportBug = await runProjectMutation(
      "Importing GitHub issue",
      () =>
        importBugFromGitHubIssue(token, selectedProject.id, {
          repositoryFullName: issue.repositoryFullName,
          issueNumber: issue.issueNumber,
        }),
      "GitHub issue imported as a bug."
    );
    if (didImportBug) {
      await loadProjectGitHubIssueCandidates(selectedProject.id);
    }
  }

  async function handleAddProjectRepository(
    repositoryId: string
  ): Promise<void> {
    if (!token || !selectedProject || !repositoryId) {
      return;
    }

    await runProjectMutation(
      "Connecting repository",
      () => addProjectRepos(token, selectedProject.id, { repositoryId }),
      "Repository connected."
    );
  }

  async function handleRemoveProjectRepository(
    repositoryId: number
  ): Promise<void> {
    if (!token || !selectedProject) {
      return;
    }

    await runProjectMutation(
      "Disconnecting repository",
      () => removeProjectRepo(token, selectedProject.id, repositoryId),
      "Repository disconnected."
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
      "Project settings saved."
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

  async function handleEndSprint(
    unfinishedAction: EndSprintUnfinishedAction = "carryover"
  ): Promise<void> {
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
      "Sprint ended."
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
      "Sprint renamed."
    );
  }

  function handleCleanupProductBacklogDoneTasks(
    projectId: number,
    taskIds: number[]
  ): void {
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
      navigateToPath(
        currentOrganizationId
          ? getOrganizationPath(currentOrganizationId)
          : ORGANIZATIONS_PATH,
        true
      );
      await syncFromPath(token, { quiet: true });
      setNotice("Project deleted.");
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
      notifications={notifications}
      notificationOpen={notificationOpen}
      unreadCount={unreadNotifications.length}
      themeMode={themeMode}
      user={user}
      onCloseNotifications={closeNotifications}
      onConnectGitHub={() => void handleConnectGitHub()}
      onDisconnectGitHub={() => void handleDisconnectGitHub()}
      onLogout={clearSession}
      onAcceptNotification={(notification) =>
        void handleAcceptNotification(notification)
      }
      onOpenNotification={(notification) =>
        void handleOpenNotification(notification)
      }
      onReadNotification={(notification) =>
        void handleReadNotification(notification)
      }
      onToggleNotifications={toggleNotifications}
      onToggleThemeMode={() =>
        setThemeMode((current) => (current === "dark" ? "light" : "dark"))
      }
    />
  );

  if (isBooting) {
    return <BootingView busyLabel={busyLabel} />;
  }

  if (!workspace || !user) {
    if (currentRoute.kind !== "marketing" && currentRoute.kind !== "signup") {
      return <BootingView busyLabel={busyLabel ?? "Loading workspace..."} />;
    }

    return (
      <PublicRouteView
        busyLabel={busyLabel}
        error={error}
        notice={notice}
        loginForm={loginForm}
        signupForm={signupForm}
        themeMode={themeMode}
        isSignupRoute={currentRoute.kind === "signup"}
        onLoginFormChange={(field, value) =>
          setLoginForm((current) => ({ ...current, [field]: value }))
        }
        onSignupFormChange={(field, value) =>
          setSignupForm((current) => ({ ...current, [field]: value }))
        }
        onNavigateHome={() =>
          window.location.assign(toBrowserPath(MARKETING_PATH))
        }
        onNavigateToSignup={() => window.location.assign(toBrowserPath(SIGNUP_PATH))}
        onSubmitLogin={() => void submitLogin(loginForm)}
        onSubmitSignup={(connectGitHub) =>
          void submitSignup(signupForm, connectGitHub)
        }
        onToggleThemeMode={() =>
          setThemeMode((current) => (current === "dark" ? "light" : "dark"))
        }
      />
    );
  }

  if (!currentOrganization) {
    return <BootingView busyLabel="Loading workspace..." />;
  }

  if (selectedProject) {
    return (
      <ProjectWorkspaceView
        topNav={topNav}
        currentOrganization={currentOrganization}
        currentOrganizationProjects={currentOrganizationProjects}
        projectNavItems={projectNavItems}
        projectSection={projectSection}
        project={selectedProject}
        user={user}
        availableRepos={workspace.availableRepos}
        busyLabel={busyLabel}
        githubRepoErrorMessage={githubRepoErrorMessage}
        hiddenCompletedProductBacklogTaskIds={
          hiddenCompletedProductBacklogTaskIds
        }
        createTaskForm={createTaskForm}
        createBugForm={createBugForm}
        projectSettingsForm={projectSettingsForm}
        importableGitHubIssues={importableGitHubIssues}
        isLoadingImportableGitHubIssues={isLoadingImportableGitHubIssues}
        showCreateTaskForm={showCreateTaskForm}
        showCreateBugForm={showCreateBugForm}
        showImportBugForm={showImportBugForm}
        showEndSprintModal={showEndSprintModal}
        showEndSprintActionModal={showEndSprintActionModal}
        endSprintReview={endSprintReview}
        endSprintUnfinishedAction={endSprintUnfinishedAction}
        endSprintUnfinishedTasks={endSprintUnfinishedTasks}
        selectedTask={selectedTask}
        selectedBug={selectedBug}
        selectedBranchTask={selectedBranchTask}
        branchNameDraft={branchNameDraft}
        baseBranchDraft={baseBranchDraft}
        onOpenProject={openProject}
        onOpenOrganization={(organizationId) =>
          openOrganization(organizationId, "projects")
        }
        onCreateTask={() => void handleCreateTask()}
        onCreateBug={() => void handleCreateBug()}
        onCreateTaskFormChange={(field, value) =>
          setCreateTaskForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onCreateBugFormChange={(field, value) =>
          setCreateBugForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onMarkTaskAsResolutionChange={(value) =>
          setCreateTaskForm((current) => ({
            ...current,
            markAsResolution: value,
          }))
        }
        onToggleCreateTaskForm={() =>
          setShowCreateTaskForm((current) => !current)
        }
        onToggleCreateBugForm={() =>
          setShowCreateBugForm((current) => !current)
        }
        onOpenCreateTask={openCreateTaskForm}
        onOpenTask={openTaskDetail}
        onOpenBug={openBugDetail}
        onUpdateTaskPriority={(taskId, priority) =>
          void handleUpdateTaskPriority(taskId, priority)
        }
        onUpdateTaskStatus={(taskId, status) =>
          void handleUpdateTaskStatus(taskId, status)
        }
        onMoveTaskPlacement={(taskId, placement) =>
          void handleMoveTaskPlacement(taskId, placement)
        }
        onUpdateBugPriority={(bugId, priority) =>
          void handleUpdateBugPriority(bugId, priority)
        }
        onUpdateBugStatus={(bugId, status) =>
          void handleUpdateBugStatus(bugId, status)
        }
        onRenameSprint={(name) => void handleRenameSprint(name)}
        onOpenEndSprint={() => {
          setEndSprintUnfinishedAction("carryover");
          setShowEndSprintActionModal(false);
          setShowEndSprintModal(true);
        }}
        onCreateTaskBranch={openTaskBranchPrompt}
        onCleanupProductBacklogDoneTasks={
          handleCleanupProductBacklogDoneTasks
        }
        onOpenImportBugForm={() => void handleOpenImportBugForm()}
        onCloseImportBugForm={closeImportBugForm}
        onImportBugFromGitHubIssue={(issue) =>
          void handleImportBugFromGitHubIssue(issue)
        }
        onCreateTaskFromBug={openCreateTaskFromBug}
        onAddProjectRepository={(repositoryId) =>
          void handleAddProjectRepository(repositoryId)
        }
        onRemoveProjectRepository={(repositoryId) =>
          void handleRemoveProjectRepository(repositoryId)
        }
        onProjectSettingsChange={(field, value) => {
          projectSettingsDirtyFieldsRef.current.add(field);
          setProjectSettingsForm((current) => ({
            ...current,
            [field]: value,
          }));
        }}
        onSaveProjectSettings={() => void handleSaveProjectSettings()}
        onDeleteSelectedProject={() => void handleDeleteSelectedProject()}
        onConnectGitHub={() => void handleConnectGitHub()}
        onCloseTaskDetail={() => setSelectedTaskId(null)}
        onCloseBugDetail={() => setSelectedBugId(null)}
        onSaveTaskDetails={handleSaveTaskDetails}
        onSaveBugDetails={handleSaveBugDetails}
        onAddTaskDetailComment={(taskId, payload) =>
          void handleAddTaskDetailComment(taskId, payload)
        }
        onToggleTaskCommentReaction={(commentId, emoji) =>
          void handleToggleTaskCommentReaction(commentId, emoji)
        }
        onAddBugDetailComment={(bugId, payload) =>
          void handleAddBugDetailComment(bugId, payload)
        }
        onToggleBugCommentReaction={(commentId, emoji) =>
          void handleToggleBugCommentReaction(commentId, emoji)
        }
        onBaseBranchChange={setBaseBranchDraft}
        onBranchNameChange={setBranchNameDraft}
        onCloseTaskBranchPrompt={closeTaskBranchPrompt}
        onSubmitTaskBranch={() => void handleCreateTaskBranch()}
        onEndSprintReviewChange={setEndSprintReview}
        onEndSprintActionChange={setEndSprintUnfinishedAction}
        onCloseEndSprintFlow={closeEndSprintFlow}
        onSubmitEndSprintRequest={handleEndSprintRequest}
        onSubmitEndSprint={(action) => void handleEndSprint(action)}
      />
    );
  }

  return (
    <OrganizationWorkspaceView
      topNav={topNav}
      organization={currentOrganization}
      projects={currentOrganizationProjects}
      organizations={workspace.organizations}
      organizationNavItems={organizationNavItems}
      organizationSection={organizationSection}
      availableRepos={workspace.availableRepos}
      user={user}
      busyLabel={busyLabel}
      githubRepoErrorMessage={githubRepoErrorMessage}
      showCreateOrganizationForm={showCreateOrganizationForm}
      showCreateProjectForm={showCreateProjectForm}
      createOrganizationForm={createOrganizationForm}
      createProjectForm={createProjectForm}
      organizationSettingsForm={organizationSettingsForm}
      organizationUsers={organizationUsers}
      organizationUsersLoading={organizationUsersLoading}
      onSelectSection={(section) => openOrganization(currentOrganization.id, section)}
      onOpenOrganization={(organizationId) => openOrganization(organizationId)}
      onOpenProject={(projectId) => openProject(projectId)}
      onConnectGitHub={() => void handleConnectGitHub()}
      onCreateOrganization={() => void handleCreateOrganization()}
      onCreateProject={() => void handleCreateProject()}
      onCreateOrganizationFormChange={(field, value) =>
        setCreateOrganizationForm((current) => ({
          ...current,
          [field]: value,
        }))
      }
      onCreateProjectFormChange={(field, value) =>
        setCreateProjectForm((current) => ({
          ...current,
          [field]: value,
        }))
      }
      onOrganizationSettingsChange={(field, value) =>
        setOrganizationSettingsForm((current) => ({
          ...current,
          [field]: value,
        }))
      }
      onToggleCreateOrganizationForm={() =>
        setShowCreateOrganizationForm((current) => !current)
      }
      onToggleCreateProjectForm={() =>
        setShowCreateProjectForm((current) => !current)
      }
      onDeleteOrganization={() => void handleDeleteOrganization()}
      onLeaveOrganization={() => void handleLeaveCurrentOrganization()}
      onSaveOrganizationSettings={() => void handleSaveOrganizationSettings()}
      onInviteUser={(identifier, role) =>
        void handleInviteOrganizationUser(identifier, role)
      }
      onChangeRole={(membershipId, role) =>
        void handleChangeOrganizationUserRole(membershipId, role)
      }
      onRemoveUser={(membershipId) =>
        void handleRemoveOrganizationUser(membershipId)
      }
      onCancelInvite={(membershipId) =>
        void handleCancelOrganizationInvite(membershipId)
      }
    />
  );
}

export default WorkspaceApp;
