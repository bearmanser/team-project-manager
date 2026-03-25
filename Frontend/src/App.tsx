import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";

import {
  AUTH_TOKEN_INVALID_EVENT,
  ApiError,
  acceptNotification,
  addBugComment,
  addProjectRepos,
  addTaskComment,
  buildApiUrl,
  cancelOrganizationInvite,
  closeRelatedNotifications,
  completeGitHubOauth,
  createBugReport,
  createOrganization,
  createProject,
  createTask,
  createTaskBranch,
  deleteOrganization,
  deleteProject,
  disconnectGitHub,
  endProjectSprint,
  getOrganizationMembers,
  getProject,
  getProjectGitHubIssues,
  getWorkspace,
  importBugFromGitHubIssue,
  inviteOrganizationMember,
  leaveOrganization,
  login,
  markNotificationRead,
  removeOrganizationMember,
  removeProjectRepo,
  signup,
  startGitHubOauth,
  toggleBugCommentReaction,
  toggleTaskCommentReaction,
  updateBugReport,
  updateOrganizationMemberRole,
  updateOrganizationSettings,
  updateProjectSettings,
  updateProjectSprint,
  updateTask,
} from "./api";
import { AppShell } from "./components/AppShell";
import { EndSprintIncompleteTasksModal } from "./components/EndSprintIncompleteTasksModal";
import { EndSprintModal } from "./components/EndSprintModal";
import { OrganizationSelector } from "./components/OrganizationSelector";
import { SideNav } from "./components/SideNav";
import { SurfaceCard } from "./components/SurfaceCard";
import { TaskBranchModal } from "./components/TaskBranchModal";
import { TopNav } from "./components/TopNav";
import { WorkItemDetailModal } from "./components/WorkItemDetailModal";
import { MarketingPage } from "./pages/MarketingPage";
import { OrganizationProjectsPage } from "./pages/OrganizationProjectsPage";
import { OrganizationSettingsPage } from "./pages/OrganizationSettingsPage";
import { OrganizationUsersPage } from "./pages/OrganizationUsersPage";
import { ProjectBoardPage } from "./pages/ProjectBoardPage";
import { ProjectBugsPage } from "./pages/ProjectBugsPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { ProjectSprintHistoryPage } from "./pages/ProjectSprintHistoryPage";
import { ProjectTasksPage } from "./pages/ProjectTasksPage";
import { SignupPage } from "./pages/SignupPage";
import type {
  BacklogPlacement,
  BugReport,
  BugStatus,
  EndSprintUnfinishedAction,
  GitHubIssueCandidate,
  Notification,
  OrganizationMember,
  OrganizationSummary,
  PriorityLevel,
  ProjectDetail,
  ProjectRole,
  Task,
  TaskStatus,
  WorkspaceResponse,
} from "./types";
import { sidebarSelectStyle } from "./utils";
import type { NavItem, OrganizationSection, ProjectSection } from "./view-models";

const TOKEN_STORAGE_KEY = "team-project-manager.jwt";
const SELECTED_ORGANIZATION_STORAGE_KEY =
  "team-project-manager.selected-organization";
const SELECTED_PROJECT_STORAGE_KEY = "team-project-manager.selected-project";
const THEME_MODE_STORAGE_KEY = "team-project-manager.theme-mode";

let githubOauthCallbackRequestKey: string | null = null;
let githubOauthCallbackRequestPromise: ReturnType<
  typeof completeGitHubOauth
> | null = null;

function completeGitHubOauthOnce(
  sessionToken: string,
  code: string,
  state: string
) {
  const requestKey = `${sessionToken}:${code}:${state}`;
  if (
    githubOauthCallbackRequestKey !== requestKey ||
    !githubOauthCallbackRequestPromise
  ) {
    githubOauthCallbackRequestKey = requestKey;
    githubOauthCallbackRequestPromise = completeGitHubOauth(sessionToken, {
      code,
      state,
    });
  }

  return githubOauthCallbackRequestPromise;
}

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
  bugReportId: null as number | null,
  bugReportTitle: "",
  markAsResolution: false,
};

const initialBugForm = {
  title: "",
  description: "",
  status: "open" as BugStatus,
  priority: "medium" as PriorityLevel,
};

type OrganizationSettingsForm = {
  name: string;
};

function getOrganizationSettingsForm(
  organization: OrganizationSummary
): OrganizationSettingsForm {
  return {
    name: organization.name,
  };
}

type ProjectSettingsForm = {
  name: string;
  description: string;
  useSprints: boolean;
};
function getProjectSettingsForm(project: ProjectDetail): ProjectSettingsForm {
  return {
    name: project.name,
    description: project.description,
    useSprints: project.useSprints,
  };
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

type WorkspaceProjectSummary = WorkspaceResponse["projects"][number];

function buildProjectSummary(project: ProjectDetail): WorkspaceProjectSummary {
  return {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    description: project.description,
    role: project.role,
    memberCount: project.members.length,
    repoCount: project.repositories.length,
    openBugCount: project.bugReports.filter((bug) => bug.status !== "closed")
      .length,
    taskCounts: {
      todo: project.tasks.filter((task) => task.status === "todo").length,
      in_progress: project.tasks.filter((task) => task.status === "in_progress")
        .length,
      in_review: project.tasks.filter((task) => task.status === "in_review")
        .length,
      done: project.tasks.filter((task) => task.status === "done").length,
    },
    updatedAt: project.updatedAt,
  };
}

function mergeProjectIntoWorkspace(
  current: WorkspaceResponse | null,
  project: ProjectDetail
): WorkspaceResponse | null {
  if (!current) {
    return current;
  }

  const nextProjectSummary = buildProjectSummary(project);
  const nextProjects = current.projects.some((entry) => entry.id === project.id)
    ? current.projects.map((entry) =>
        entry.id === project.id ? nextProjectSummary : entry
      )
    : [...current.projects, nextProjectSummary];
  const organizationProjects = nextProjects.filter(
    (entry) => entry.organizationId === project.organizationId
  );
  const nextOrganizations = current.organizations.map((organization) => {
    if (organization.id !== project.organizationId) {
      return organization;
    }

    const repoCount = organizationProjects.reduce(
      (total, entry) => total + entry.repoCount,
      0
    );
    const openBugCount = organizationProjects.reduce(
      (total, entry) => total + entry.openBugCount,
      0
    );
    const updatedAt = organizationProjects.reduce(
      (latest, entry) => (entry.updatedAt > latest ? entry.updatedAt : latest),
      organization.updatedAt
    );

    return {
      ...organization,
      projectCount: organizationProjects.length,
      repoCount,
      openBugCount,
      updatedAt,
    };
  });

  return {
    ...current,
    projects: nextProjects,
    organizations: nextOrganizations,
  };
}

function parseStoredNumber(key: string): number | null {
  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveOrganizationSelection(
  organizations: OrganizationSummary[],
  preferredOrganizationId: number | null
): number | null {
  if (
    organizations.some(
      (organization) => organization.id === preferredOrganizationId
    )
  ) {
    return preferredOrganizationId;
  }

  const personalOrganization = organizations.find(
    (organization) => organization.isPersonal
  );
  return personalOrganization?.id ?? organizations[0]?.id ?? null;
}

const ORGANIZATIONS_PATH = "/organizations";
const MARKETING_PATH = "/";
const SIGNUP_PATH = "/signup";
const LOGIN_PATH = "/login";

type AppRoute =
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

function normalizePath(pathname: string): string {
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

function stripAppBasePath(pathname: string): string {
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

function toBrowserPath(pathname: string): string {
  const normalizedPath = normalizePath(pathname);
  if (!APP_BASE_PATH) {
    return normalizedPath;
  }

  return normalizedPath === "/"
    ? APP_BASE_PATH
    : `${APP_BASE_PATH}${normalizedPath}`;
}

function parseRoute(pathname: string): AppRoute {
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
    /^\/organizations\/(\d+)(?:\/(projects|users|settings))?$/
  );
  if (organizationMatch) {
    return {
      kind: "organization",
      organizationId: Number(organizationMatch[1]),
      section:
        (organizationMatch[2] as OrganizationSection | undefined) ?? "projects",
    };
  }

  const projectMatch = normalizedPath.match(
    /^\/projects\/(\d+)(?:\/(board|tasks|bugs|history|settings))?$/
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

function getOrganizationPath(
  organizationId: number,
  section: OrganizationSection = "projects"
): string {
  return section === "projects"
    ? `/organizations/${organizationId}`
    : `/organizations/${organizationId}/${section}`;
}

function getProjectPath(
  projectId: number,
  section: ProjectSection = "board"
): string {
  return section === "board"
    ? `/projects/${projectId}`
    : `/projects/${projectId}/${section}`;
}

function getStoredThemeMode(): "light" | "dark" {
  return window.localStorage.getItem(THEME_MODE_STORAGE_KEY) === "light"
    ? "light"
    : "dark";
}

function App() {
  const [pendingNotificationTarget, setPendingNotificationTarget] = useState<{
    projectId: number;
    taskId: number | null;
    bugReportId: number | null;
  } | null>(null);
  const [signupForm, setSignupForm] = useState(initialSignupForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() =>
    getStoredThemeMode()
  );
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    number | null
  >(() => parseStoredNumber(SELECTED_ORGANIZATION_STORAGE_KEY));
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    () => parseStoredNumber(SELECTED_PROJECT_STORAGE_KEY)
  );
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(
    null
  );
  const [organizationSection, setOrganizationSection] =
    useState<OrganizationSection>("projects");
  const [projectSection, setProjectSection] = useState<ProjectSection>("board");
  const [organizationUsers, setOrganizationUsers] = useState<
    OrganizationMember[]
  >([]);
  const [organizationUsersLoading, setOrganizationUsersLoading] =
    useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [showCreateOrganizationForm, setShowCreateOrganizationForm] =
    useState(false);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
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
  const [createOrganizationForm, setCreateOrganizationForm] = useState(
    initialOrganizationForm
  );
  const [organizationSettingsForm, setOrganizationSettingsForm] =
    useState<OrganizationSettingsForm>({
      name: "",
    });
  const [createProjectForm, setCreateProjectForm] =
    useState(initialProjectForm);
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
  const lastAutoClosedWorkItemKeyRef = useRef<string | null>(null);

  const user = workspace?.user ?? null;
  const githubRepoErrorMessage =
    workspace?.githubRepoError === "Bad credentials" &&
    workspace?.user.githubConnected
      ? "GitHub connected, but repositories are still syncing. Please wait a moment and try again."
      : workspace?.githubRepoError ?? null;
  const notifications = (workspace?.notifications ?? []).filter(
    (item) => !item.isClosed
  );
  const unreadNotifications = notifications.filter((item) => !item.isRead);
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

  useEffect(() => {
    if (!pendingNotificationTarget || !selectedProject) {
      return;
    }

    if (selectedProject.id !== pendingNotificationTarget.projectId) {
      return;
    }

    if (pendingNotificationTarget.taskId !== null) {
      const taskExists = selectedProject.tasks.some(
        (task) => task.id === pendingNotificationTarget.taskId
      );
      if (taskExists) {
        openTaskDetail(pendingNotificationTarget.taskId);
      } else {
        setError("The task for this notification is no longer available.");
      }
    } else if (pendingNotificationTarget.bugReportId !== null) {
      const bugExists = selectedProject.bugReports.some(
        (bug) => bug.id === pendingNotificationTarget.bugReportId
      );
      if (bugExists) {
        openBugDetail(pendingNotificationTarget.bugReportId);
      } else {
        setError("The bug for this notification is no longer available.");
      }
    }

    setPendingNotificationTarget(null);
  }, [pendingNotificationTarget, selectedProject]);

  useEffect(() => {
    const workItemKey = selectedTask
      ? `task:${selectedTask.id}`
      : selectedBug
      ? `bug:${selectedBug.id}`
      : null;

    if (!workItemKey) {
      lastAutoClosedWorkItemKeyRef.current = null;
      return;
    }

    if (lastAutoClosedWorkItemKeyRef.current === workItemKey) {
      return;
    }

    lastAutoClosedWorkItemKeyRef.current = workItemKey;
    const payload = selectedTask
      ? { taskId: selectedTask.id }
      : { bugReportId: selectedBug!.id };

    void handleCloseRelatedNotifications(payload).then((didClose) => {
      if (!didClose && lastAutoClosedWorkItemKeyRef.current === workItemKey) {
        lastAutoClosedWorkItemKeyRef.current = null;
      }
    });
  }, [selectedBug, selectedTask, token]);

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

  function clearProjectSettingsDraft(projectId: number | null = null): void {
    projectSettingsDirtyFieldsRef.current.clear();
    projectSettingsProjectIdRef.current = projectId;
    if (projectId === null) {
      setProjectSettingsForm({
        name: "",
        description: "",
        useSprints: false,
      });
    }
  }

  function applyProjectSettingsFromProject(
    project: ProjectDetail,
    options: { resetDirty?: boolean } = {}
  ): void {
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
  }

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
      window.localStorage.setItem(
        SELECTED_ORGANIZATION_STORAGE_KEY,
        String(organizationId)
      );
    }
    setSelectedOrganizationId(organizationId);
  }

  function rememberProjectSelection(projectId: number | null): void {
    if (projectId === null) {
      window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        SELECTED_PROJECT_STORAGE_KEY,
        String(projectId)
      );
    }
    setSelectedProjectId(projectId);
  }

  function navigateToPath(path: string, replace = false): void {
    const normalizedPath = normalizePath(path);
    const currentPath = stripAppBasePath(window.location.pathname);
    const browserPath = toBrowserPath(normalizedPath);
    if (normalizedPath === currentPath && !replace) {
      return;
    }

    if (replace) {
      window.history.replaceState({}, document.title, browserPath);
    } else {
      window.history.pushState({}, document.title, browserPath);
    }
  }

  function clearProjectSelection(): void {
    rememberProjectSelection(null);
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
    setBusyLabel(null);
    setNotificationOpen(false);
    clearProjectSettingsDraft();
    navigateToPath(MARKETING_PATH, true);
  }

  async function loadProjectDetail(
    sessionToken: string,
    projectId: number
  ): Promise<ProjectDetail> {
    const response = await getProject(sessionToken, projectId);
    startTransition(() => {
      setSelectedProject(response.project);
      applyProjectSettingsFromProject(response.project);
      setWorkspace((current) =>
        mergeProjectIntoWorkspace(current, response.project)
      );
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
    } = {}
  ): Promise<{
    resolvedOrganizationId: number | null;
    resolvedProjectId: number | null;
  }> {
    if (!options.quiet) {
      setBusyLabel("Loading workspace");
    }

    const workspaceData = await getWorkspace(sessionToken);
    startTransition(() => {
      setWorkspace(workspaceData);
    });

    const requestedProjectId = Object.prototype.hasOwnProperty.call(
      options,
      "preferredProjectId"
    )
      ? options.preferredProjectId ?? null
      : selectedProjectId;
    const resolvedProjectId = workspaceData.projects.some(
      (project) => project.id === requestedProjectId
    )
      ? requestedProjectId
      : null;

    if (resolvedProjectId !== null) {
      const projectOverride = options.projectOverride;
      if (projectOverride && projectOverride.id === resolvedProjectId) {
        rememberProjectSelection(resolvedProjectId);
        rememberOrganizationSelection(projectOverride.organizationId);
        startTransition(() => {
          setSelectedProject(projectOverride);
          applyProjectSettingsFromProject(projectOverride);
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
            : workspaceData.projects.find(
                (project) => project.id === resolvedProjectId
              )?.organizationId ?? null,
        resolvedProjectId,
      };
    }

    rememberProjectSelection(null);
    startTransition(() => {
      setSelectedProject(null);
    });

    const requestedOrganizationId = Object.prototype.hasOwnProperty.call(
      options,
      "preferredOrganizationId"
    )
      ? options.preferredOrganizationId ?? null
      : selectedOrganizationId;
    const resolvedOrganizationId = resolveOrganizationSelection(
      workspaceData.organizations,
      requestedOrganizationId
    );

    rememberOrganizationSelection(resolvedOrganizationId);

    if (!options.quiet) {
      setBusyLabel(null);
    }

    return {
      resolvedOrganizationId,
      resolvedProjectId: null,
    };
  }

  async function syncFromPath(
    sessionToken: string,
    options: { quiet?: boolean } = {}
  ): Promise<void> {
    const route = parseRoute(window.location.pathname);
    setNotificationOpen(false);

    if (route.kind === "marketing" || route.kind === "signup") {
      navigateToPath(ORGANIZATIONS_PATH, true);
      await syncFromPath(sessionToken, options);
      return;
    }

    if (route.kind === "organizations") {
      setOrganizationSection("projects");
      clearProjectSelection();
      const result = await hydrateWorkspace(sessionToken, {
        preferredProjectId: null,
        quiet: options.quiet,
      });
      if (result.resolvedOrganizationId !== null) {
        navigateToPath(
          getOrganizationPath(result.resolvedOrganizationId),
          true
        );
      }
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
        navigateToPath(
          result.resolvedOrganizationId
            ? getOrganizationPath(result.resolvedOrganizationId)
            : ORGANIZATIONS_PATH,
          true
        );
      }
      return;
    }

    if (route.kind === "project") {
      setProjectSection(route.section);

      if (selectedProject?.id === route.projectId) {
        rememberProjectSelection(route.projectId);
        rememberOrganizationSelection(selectedProject.organizationId);
        return;
      }

      const knownProject =
        workspace?.projects.some((project) => project.id === route.projectId) ??
        false;
      if (knownProject) {
        try {
          await loadProjectDetail(sessionToken, route.projectId);
          return;
        } catch (reason) {
          if (!(reason instanceof ApiError) || reason.status !== 404) {
            throw reason;
          }
        }
      }

      const result = await hydrateWorkspace(sessionToken, {
        preferredOrganizationId: null,
        preferredProjectId: route.projectId,
        quiet: options.quiet,
      });
      if (result.resolvedProjectId !== route.projectId) {
        navigateToPath(
          result.resolvedOrganizationId
            ? getOrganizationPath(result.resolvedOrganizationId)
            : ORGANIZATIONS_PATH,
          true
        );
      }
    }
  }

  async function runProjectMutation(
    label: string,
    action: () => Promise<{ project: ProjectDetail }>,
    successNotice: string
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
        applyProjectSettingsFromProject(response.project, { resetDirty: true });
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
      const providerError =
        params.get("error_description") ?? params.get("error");
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
        navigateToPath(MARKETING_PATH, true);
        setIsBooting(false);
        return;
      }

      setBusyLabel("Connecting GitHub");
      try {
        const response = await completeGitHubOauthOnce(
          sessionToken,
          code,
          state
        );
        startTransition(() => {
          setWorkspace((current) =>
            current
              ? {
                  ...current,
                  user: response.user,
                  availableRepos: response.repos,
                  githubRepoError: response.githubRepoError,
                }
              : current
          );
        });
        navigateToPath(ORGANIZATIONS_PATH, true);
        try {
          await syncFromPath(sessionToken, { quiet: true });
        } catch (reason) {
          setError(getFriendlyError(reason));
        }
        setNotice("GitHub connected.");
      } catch (reason) {
        navigateToPath(ORGANIZATIONS_PATH, true);
        setError(getFriendlyError(reason));
      } finally {
        setBusyLabel(null);
        setIsBooting(false);
      }
      return;
    }

    if (!sessionToken) {
      if (route.kind !== "marketing" && route.kind !== "signup") {
        navigateToPath(MARKETING_PATH, true);
      }
      setIsBooting(false);
      return;
    }

    try {
      if (route.kind === "marketing" || route.kind === "signup") {
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
    function handleAuthTokenInvalid(event: Event): void {
      const message =
        event instanceof CustomEvent &&
        typeof event.detail?.message === "string"
          ? event.detail.message
          : "Your session has expired. Please sign in again.";

      clearSession();
      setError(message);
    }

    window.addEventListener(AUTH_TOKEN_INVALID_EVENT, handleAuthTokenInvalid);
    return () =>
      window.removeEventListener(
        AUTH_TOKEN_INVALID_EVENT,
        handleAuthTokenInvalid
      );
  }, []);

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
    if (
      !selectedProject ||
      selectedProject.useSprints ||
      projectSection !== "history"
    ) {
      return;
    }

    setProjectSection("board");
    navigateToPath(getProjectPath(selectedProject.id, "board"), true);
  }, [projectSection, selectedProject]);

  useEffect(() => {
    if (!currentOrganization) {
      setOrganizationSettingsForm({
        name: "",
      });
      return;
    }

    if (currentOrganization.isPersonal) {
      setOrganizationSettingsForm({
        name: "",
      });
      if (organizationSection === "users" || organizationSection === "settings") {
        setOrganizationSection("projects");
        navigateToPath(
          getOrganizationPath(currentOrganization.id, "projects"),
          true
        );
      }
      return;
    }

    if (
      currentOrganization.role === "owner" ||
      currentOrganization.role === "admin"
    ) {
      setOrganizationSettingsForm(
        getOrganizationSettingsForm(currentOrganization)
      );
      return;
    }

    setOrganizationSettingsForm({
      name: "",
    });
  }, [
    currentOrganization?.id,
    currentOrganization?.isPersonal,
    currentOrganization?.name,
    currentOrganization?.role,
    organizationSection,
  ]);

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
      void syncFromPath(token, { quiet: true });
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
      navigateToPath(
        selectedOrganizationId
          ? getOrganizationPath(selectedOrganizationId)
          : ORGANIZATIONS_PATH,
        true
      );
      void syncFromPath(token, { quiet: true });
    };

    stream.addEventListener("project.updated", handleUpdated);
    stream.addEventListener("project.deleted", handleDeleted);

    return () => {
      stream.removeEventListener("project.updated", handleUpdated);
      stream.removeEventListener("project.deleted", handleDeleted);
      stream.close();
      isRefreshingProjectFromEventsRef.current = false;
    };
  }, [selectedOrganizationId, selectedProjectId, token]);

  useEffect(() => {
    if (
      !token ||
      !currentOrganization ||
      selectedProject ||
      organizationSection !== "users"
    ) {
      return;
    }
    if (currentOrganization.isPersonal) {
      setOrganizationSection("projects");
      navigateToPath(
        getOrganizationPath(currentOrganization.id, "projects"),
        true
      );
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setOrganizationUsersLoading(true);
        const response = await getOrganizationMembers(token, currentOrganization.id);
        if (cancelled) {
          return;
        }
        setOrganizationUsers(response.members);
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
  }, [
    currentOrganization,
    organizationSection,
    selectedProject,
    token,
  ]);

  async function handleSubmitSignup(connectGitHub: boolean): Promise<void> {
    if (signupForm.password !== signupForm.confirmPassword) {
      setError("Passwords must match before creating the account.");
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel(
      connectGitHub
        ? "Creating account and preparing GitHub"
        : "Creating account"
    );

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
      setNotice("Account created. Your account workspace is ready.");
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
    setBusyLabel(
      user?.githubConnected
        ? "Refreshing GitHub repositories"
        : "Opening GitHub"
    );

    try {
      await beginGitHubConnection(token);
    } catch (reason) {
      setError(getFriendlyError(reason));
      setBusyLabel(null);
    }
  }

  async function handleDisconnectGitHub(): Promise<void> {
    if (!token) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Disconnecting GitHub");

    try {
      const response = await disconnectGitHub(token);
      startTransition(() => {
        setWorkspace((current) =>
          current
            ? {
                ...current,
                user: response.user,
                availableRepos: [],
                githubRepoError: null,
              }
            : current
        );
      });
      setNotice("GitHub disconnected.");
    } catch (reason) {
      setError(getFriendlyError(reason));
    } finally {
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

  async function handleSaveOrganizationSettings(): Promise<void> {
    if (
      !token ||
      !currentOrganization ||
      currentOrganization.isPersonal ||
      (currentOrganization.role !== "owner" &&
        currentOrganization.role !== "admin")
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Saving organization settings");

    try {
      await updateOrganizationSettings(token, currentOrganization.id, {
        name: organizationSettingsForm.name.trim(),
      });
      await syncFromPath(token, { quiet: true });
      setNotice("Organization settings saved.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleDeleteOrganization(): Promise<void> {
    if (
      !token ||
      !currentOrganization ||
      currentOrganization.isPersonal ||
      currentOrganization.role !== "owner"
    ) {
      return;
    }

    const organizationId = currentOrganization.id;
    setBusyLabel("Deleting organization");
    setError(null);
    setNotice(null);

    try {
      clearProjectSelection();
      rememberOrganizationSelection(null);
      await deleteOrganization(token, organizationId);
      navigateToPath(ORGANIZATIONS_PATH, true);
      await syncFromPath(token, { quiet: true });
      setNotice("Organization deleted.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleLeaveCurrentOrganization(): Promise<void> {
    if (
      !token ||
      !currentOrganization ||
      currentOrganization.isPersonal ||
      currentOrganization.role === "owner"
    ) {
      return;
    }

    const organizationId = currentOrganization.id;
    setBusyLabel("Leaving organization");
    setError(null);
    setNotice(null);

    try {
      clearProjectSelection();
      rememberOrganizationSelection(null);
      await leaveOrganization(token, organizationId);
      navigateToPath(ORGANIZATIONS_PATH, true);
      await syncFromPath(token, { quiet: true });
      setNotice("You left the organization.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleCreateProject(): Promise<void> {
    if (
      !token ||
      !currentOrganization ||
      (currentOrganization.role !== "owner" &&
        currentOrganization.role !== "admin")
    ) {
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
        repositoryId: createProjectForm.repositoryId || undefined,
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

  async function handleReadNotification(
    notification: Notification
  ): Promise<void> {
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
                  item.id === notification.id ? response.notification : item
                ),
              }
            : current
        );
      });
    } catch (reason) {
      setError(getFriendlyError(reason));
    }
  }

  async function handleCloseRelatedNotifications(payload: {
    taskId?: number;
    bugReportId?: number;
  }): Promise<boolean> {
    if (!token) {
      return false;
    }

    try {
      const response = await closeRelatedNotifications(token, payload);
      if (!response.closedNotificationIds.length) {
        return true;
      }

      const closedIds = new Set(response.closedNotificationIds);
      startTransition(() => {
        setWorkspace((current) =>
          current
            ? {
                ...current,
                notifications: current.notifications.filter(
                  (item) => !closedIds.has(item.id)
                ),
              }
            : current
        );
      });
      return true;
    } catch (reason) {
      setError(getFriendlyError(reason));
      return false;
    }
  }

  async function handleOpenNotification(
    notification: Notification
  ): Promise<void> {
    if (
      !token ||
      notification.projectId === null ||
      (notification.taskId === null && notification.bugReportId === null)
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setNotificationOpen(false);

    if (selectedProject?.id === notification.projectId) {
      if (notification.taskId !== null) {
        openTaskDetail(notification.taskId);
      } else if (notification.bugReportId !== null) {
        openBugDetail(notification.bugReportId);
      }
      return;
    }

    setPendingNotificationTarget({
      projectId: notification.projectId,
      taskId: notification.taskId,
      bugReportId: notification.bugReportId,
    });
    setBusyLabel("Opening item");
    navigateToPath(getProjectPath(notification.projectId));

    try {
      await syncFromPath(token, { quiet: true });
    } catch (reason) {
      setPendingNotificationTarget(null);
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleAcceptNotification(
    notification: Notification
  ): Promise<void> {
    if (!token || !notification.action) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Accepting invite");

    try {
      const response = await acceptNotification(token, notification.id);
      startTransition(() => {
        setWorkspace((current) =>
          current
            ? {
                ...current,
                notifications: current.notifications.map((item) =>
                  item.id === notification.id ? response.notification : item
                ),
              }
            : current
        );
      });
      await syncFromPath(token, { quiet: true });
      setNotice("Invite accepted.");
    } catch (reason) {
      setError(getFriendlyError(reason));
    } finally {
      setBusyLabel(null);
    }
  }

  function openProject(
    projectId: number,
    section: ProjectSection = "board"
  ): void {
    if (!token) {
      return;
    }

    setError(null);
    setNotice(null);
    setNotificationOpen(false);

    if (selectedProject?.id === projectId) {
      setProjectSection(section);
      rememberProjectSelection(projectId);
      rememberOrganizationSelection(selectedProject.organizationId);
      navigateToPath(getProjectPath(projectId, section));
      return;
    }

    setBusyLabel("Opening project");
    navigateToPath(getProjectPath(projectId, section));
    void syncFromPath(token, { quiet: true }).finally(() => setBusyLabel(null));
  }

  function openOrganization(
    organizationId: number,
    section: OrganizationSection = "projects"
  ): void {
    if (!token) {
      return;
    }

    setNotificationOpen(false);
    navigateToPath(getOrganizationPath(organizationId, section));
    void syncFromPath(token, { quiet: true });
  }

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

  async function handleInviteOrganizationUser(
    identifier: string,
    role: ProjectRole
  ): Promise<void> {
    if (!token || !currentOrganization) {
      return;
    }

    setBusyLabel("Inviting user");
    setError(null);
    setNotice(null);

    try {
      const response = await inviteOrganizationMember(token, currentOrganization.id, {
        identifier,
        role,
      });
      setOrganizationUsers(response.members);
      await syncFromPath(token, { quiet: true });
      setNotice("User invited.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleChangeOrganizationUserRole(
    membershipId: number,
    role: ProjectRole
  ): Promise<void> {
    if (!token || !currentOrganization) {
      return;
    }

    setBusyLabel("Changing organization role");
    setError(null);
    setNotice(null);

    try {
      const response = await updateOrganizationMemberRole(
        token,
        currentOrganization.id,
        membershipId,
        { role }
      );
      setOrganizationUsers(response.members);
      await syncFromPath(token, { quiet: true });
      setNotice("Role updated.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleRemoveOrganizationUser(membershipId: number): Promise<void> {
    if (!token || !currentOrganization) {
      return;
    }

    setBusyLabel("Removing user");
    setError(null);
    setNotice(null);

    try {
      await removeOrganizationMember(token, currentOrganization.id, membershipId);
      const response = await getOrganizationMembers(token, currentOrganization.id);
      setOrganizationUsers(response.members);
      await syncFromPath(token, { quiet: true });
      setNotice("User removed.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleCancelOrganizationInvite(membershipId: number): Promise<void> {
    if (!token || !currentOrganization) {
      return;
    }

    setBusyLabel("Canceling invite");
    setError(null);
    setNotice(null);

    try {
      await cancelOrganizationInvite(token, currentOrganization.id, membershipId);
      const response = await getOrganizationMembers(token, currentOrganization.id);
      setOrganizationUsers(response.members);
      await syncFromPath(token, { quiet: true });
      setNotice("Invite canceled.");
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
      onCloseNotifications={() => setNotificationOpen(false)}
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
      onToggleNotifications={() => setNotificationOpen((current) => !current)}
      onToggleThemeMode={() =>
        setThemeMode((current) => (current === "dark" ? "light" : "dark"))
      }
    />
  );

  if (isBooting) {
    return (
      <Box
        minH="100vh"
        bg="var(--color-bg-app)"
        display="grid"
        placeItems="center"
        px="4"
      >
        <SurfaceCard p={{ base: "6", lg: "10" }} w="full" maxW="640px">
          <Stack gap="3">
            <Text
              fontSize="xs"
              textTransform="uppercase"
              letterSpacing="0.18em"
              color="var(--color-text-muted)"
            >
              Team Project Manager
            </Text>
            <Heading size="2xl" color="var(--color-text-primary)">
              Preparing your workspace
            </Heading>
            <Text color="var(--color-text-secondary)">
              {busyLabel ?? "Loading authentication state..."}
            </Text>
          </Stack>
        </SurfaceCard>
      </Box>
    );
  }

  if (!workspace || !user) {
    const publicRoute = parseRoute(window.location.pathname);

    if (publicRoute.kind === "signup") {
      return (
        <SignupPage
          busyLabel={busyLabel}
          error={error}
          notice={notice}
          loginForm={loginForm}
          signupForm={signupForm}
          themeMode={themeMode}
          onLoginFormChange={(field, value) =>
            setLoginForm((current) => ({ ...current, [field]: value }))
          }
          onSignupFormChange={(field, value) =>
            setSignupForm((current) => ({ ...current, [field]: value }))
          }
          onNavigateHome={() =>
            window.location.assign(toBrowserPath(MARKETING_PATH))
          }
          onSubmitLogin={() => void handleSubmitLogin()}
          onSubmitSignup={(connectGitHub) =>
            void handleSubmitSignup(connectGitHub)
          }
          onToggleThemeMode={() =>
            setThemeMode((current) => (current === "dark" ? "light" : "dark"))
          }
        />
      );
    }

    return (
      <MarketingPage
        busyLabel={busyLabel}
        error={error}
        notice={notice}
        loginForm={loginForm}
        themeMode={themeMode}
        onLoginFormChange={(field, value) =>
          setLoginForm((current) => ({ ...current, [field]: value }))
        }
        onNavigateHome={() =>
          window.location.assign(toBrowserPath(MARKETING_PATH))
        }
        onNavigateToSignup={() =>
          window.location.assign(toBrowserPath(SIGNUP_PATH))
        }
        onSubmitLogin={() => void handleSubmitLogin()}
        onToggleThemeMode={() =>
          setThemeMode((current) => (current === "dark" ? "light" : "dark"))
        }
      />
    );
  }

  if (!currentOrganization) {
    return (
      <AppShell topNav={topNav}>
        <SurfaceCard p="5" bg="var(--color-bg-muted)">
          <Text color="var(--color-text-muted)">Loading workspace...</Text>
        </SurfaceCard>
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
              {currentOrganization.displayName}
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
            _hover={{
              bg: "var(--color-bg-hover)",
              borderColor: "var(--color-accent-border)",
            }}
            onClick={() => openOrganization(currentOrganization.id, "projects")}
          >
            {currentOrganization.isPersonal
              ? "Back to your account"
              : "Back to organization"}
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
        onMarkTaskAsResolutionChange={(value) =>
          setCreateTaskForm((current) => ({
            ...current,
            markAsResolution: value,
          }))
        }
        onOpenCreateTask={openCreateTaskForm}
        onOpenTask={openTaskDetail}
        onToggleCreateTaskForm={() =>
          setShowCreateTaskForm((current) => !current)
        }
        onUpdateTaskPriority={(taskId, priority) =>
          void handleUpdateTaskPriority(taskId, priority)
        }
        onUpdateTaskStatus={(taskId, status) =>
          void handleUpdateTaskStatus(taskId, status)
        }
        onMoveTaskPlacement={(taskId, placement) =>
          void handleMoveTaskPlacement(taskId, placement)
        }
        onRenameSprint={(name) => void handleRenameSprint(name)}
        onOpenEndSprint={() => {
          setEndSprintUnfinishedAction("carryover");
          setShowEndSprintActionModal(false);
          setShowEndSprintModal(true);
        }}
        onCreateTaskBranch={openTaskBranchPrompt}
      />
    );

    if (projectSection === "tasks") {
      projectContent = (
        <ProjectTasksPage
          createTaskForm={createTaskForm}
          hiddenProductBacklogTaskIds={
            hiddenCompletedProductBacklogTaskIds[selectedProject.id] ?? []
          }
          isCreateOpen={showCreateTaskForm}
          project={selectedProject}
          onCleanupProductBacklogDoneTasks={
            handleCleanupProductBacklogDoneTasks
          }
          onCreateTask={() => void handleCreateTask()}
          onCreateTaskFormChange={(field, value) =>
            setCreateTaskForm((current) => ({
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
          onToggleCreateForm={() =>
            setShowCreateTaskForm((current) => !current)
          }
          onOpenCreateTask={openCreateTaskForm}
          onOpenTask={openTaskDetail}
          onUpdateTaskPriority={(taskId, priority) =>
            void handleUpdateTaskPriority(taskId, priority)
          }
          onUpdateTaskStatus={(taskId, status) =>
            void handleUpdateTaskStatus(taskId, status)
          }
          onMoveTaskPlacement={(taskId, placement) =>
            void handleMoveTaskPlacement(taskId, placement)
          }
          onRenameSprint={(name) => void handleRenameSprint(name)}
          onCreateTaskBranch={openTaskBranchPrompt}
        />
      );
    }

    if (projectSection === "bugs") {
      projectContent = (
        <ProjectBugsPage
          createBugForm={createBugForm}
          githubIssues={importableGitHubIssues}
          isCreateOpen={showCreateBugForm}
          isImportOpen={showImportBugForm}
          isImportLoading={isLoadingImportableGitHubIssues}
          project={selectedProject}
          onCloseImport={closeImportBugForm}
          onCreateBug={() => void handleCreateBug()}
          onCreateBugFormChange={(field, value) =>
            setCreateBugForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onCreateTaskFromBug={openCreateTaskFromBug}
          onImportIssue={(issue) => void handleImportBugFromGitHubIssue(issue)}
          onOpenBug={openBugDetail}
          onOpenImport={() => void handleOpenImportBugForm()}
          onToggleCreateForm={() => setShowCreateBugForm((current) => !current)}
          onUpdateBugPriority={(bugId, priority) =>
            void handleUpdateBugPriority(bugId, priority)
          }
          onUpdateBugStatus={(bugId, status) =>
            void handleUpdateBugStatus(bugId, status)
          }
        />
      );
    }

    if (projectSection === "history" && selectedProject.useSprints) {
      projectContent = <ProjectSprintHistoryPage project={selectedProject} />;
    }

    if (projectSection === "settings") {
      projectContent = (
        <ProjectSettingsPage
          availableRepos={workspace.availableRepos}
          busyLabel={busyLabel}
          githubRepoError={githubRepoErrorMessage}
          isGitHubConnected={user.githubConnected}
          project={selectedProject}
          projectSettingsForm={projectSettingsForm}
          onAddRepository={(repositoryId) =>
            void handleAddProjectRepository(repositoryId)
          }
          onConnectGitHub={() => void handleConnectGitHub()}
          onDeleteProject={() => void handleDeleteSelectedProject()}
          onProjectSettingsChange={(field, value) => {
            projectSettingsDirtyFieldsRef.current.add(field);
            setProjectSettingsForm((current) => ({
              ...current,
              [field]: value,
            }));
          }}
          onRemoveRepository={(repositoryId) =>
            void handleRemoveProjectRepository(repositoryId)
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
          onSaveTask={handleSaveTaskDetails}
          onCreateTaskBranch={openTaskBranchPrompt}
          onSaveBug={handleSaveBugDetails}
          onAddTaskComment={(taskId, payload) =>
            void handleAddTaskDetailComment(taskId, payload)
          }
          onToggleTaskCommentReaction={(commentId, emoji) =>
            void handleToggleTaskCommentReaction(commentId, emoji)
          }
          onAddBugComment={(bugId, payload) =>
            void handleAddBugDetailComment(bugId, payload)
          }
          onToggleBugCommentReaction={(commentId, emoji) =>
            void handleToggleBugCommentReaction(commentId, emoji)
          }
        />
        <WorkItemDetailModal
          isOpen={Boolean(selectedBug)}
          project={selectedProject}
          bug={selectedBug}
          onClose={() => setSelectedBugId(null)}
          onSaveTask={handleSaveTaskDetails}
          onCreateTaskBranch={openTaskBranchPrompt}
          onSaveBug={handleSaveBugDetails}
          onAddTaskComment={(taskId, payload) =>
            void handleAddTaskDetailComment(taskId, payload)
          }
          onToggleTaskCommentReaction={(commentId, emoji) =>
            void handleToggleTaskCommentReaction(commentId, emoji)
          }
          onAddBugComment={(bugId, payload) =>
            void handleAddBugDetailComment(bugId, payload)
          }
          onToggleBugCommentReaction={(commentId, emoji) =>
            void handleToggleBugCommentReaction(commentId, emoji)
          }
        />
        <TaskBranchModal
          baseBranch={baseBranchDraft}
          branchName={branchNameDraft}
          isOpen={Boolean(selectedBranchTask)}
          project={selectedProject}
          task={selectedBranchTask}
          onBaseBranchChange={setBaseBranchDraft}
          onBranchNameChange={setBranchNameDraft}
          onClose={closeTaskBranchPrompt}
          onSubmit={() => void handleCreateTaskBranch()}
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
      topSlot={
        <OrganizationSelector
          createOrganizationForm={createOrganizationForm}
          currentOrganization={currentOrganization}
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
          onOpenOrganization={(organizationId) =>
            openOrganization(organizationId)
          }
          onToggleCreateForm={() =>
            setShowCreateOrganizationForm((current) => !current)
          }
        />
      }
    />
  );

  let organizationContent = (
    <OrganizationProjectsPage
      organization={currentOrganization}
      projects={currentOrganizationProjects}
      availableRepos={workspace.availableRepos}
      canCreateProject={
        currentOrganization.role === "owner" || currentOrganization.role === "admin"
      }
      createProjectForm={createProjectForm}
      githubRepoError={githubRepoErrorMessage}
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

  if (!currentOrganization.isPersonal && organizationSection === "users") {
    organizationContent = (
      <OrganizationUsersPage
        isInviting={busyLabel === "Inviting user"}
        isLoading={organizationUsersLoading}
        members={organizationUsers}
        organizationRole={currentOrganization.role}
        onCancelInvite={(membershipId) =>
          void handleCancelOrganizationInvite(membershipId)
        }
        onChangeRole={(membershipId, role) =>
          void handleChangeOrganizationUserRole(membershipId, role)
        }
        onInviteUser={(identifier, role) =>
          void handleInviteOrganizationUser(identifier, role)
        }
        onRemoveUser={(membershipId) =>
          void handleRemoveOrganizationUser(membershipId)
        }
      />
    );
  }

  if (!currentOrganization.isPersonal && organizationSection === "settings") {
    organizationContent = (
      <OrganizationSettingsPage
        busyLabel={busyLabel}
        organization={currentOrganization}
        role={currentOrganization.role}
        organizationSettingsForm={organizationSettingsForm}
        onDeleteOrganization={() => void handleDeleteOrganization()}
        onLeaveOrganization={() => void handleLeaveCurrentOrganization()}
        onOrganizationSettingsChange={(field, value) =>
          setOrganizationSettingsForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onSaveOrganizationSettings={() => void handleSaveOrganizationSettings()}
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
