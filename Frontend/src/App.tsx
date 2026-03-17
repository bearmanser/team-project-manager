import { startTransition, useEffect, useMemo, useState } from "react";

import { Box, Button, Heading, Stack, Text } from "@chakra-ui/react";

import {
  ApiError,
  buildApiUrl,
  completeGitHubOauth,
  createBugReport,
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
  ProjectDetail,
  TaskStatus,
  WorkspaceResponse,
} from "./types";
import type {
  NavItem,
  OrganizationSection,
  OrganizationSummary,
  OrganizationUser,
  ProjectSection,
  TopView,
} from "./view-models";

const TOKEN_STORAGE_KEY = "team-project-manager.jwt";
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

function buildOrganizationName(workspace: WorkspaceResponse): string {
  const handle = workspace.user.githubUsername || workspace.user.username;
  return `${handle} organization`;
}

function dedupeOrganizationUsers(
  projects: ProjectDetail[]
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

  return [...registry.values()].sort((left, right) =>
    left.user.username.localeCompare(right.user.username)
  );
}

function App() {
  const [authMode, setAuthMode] = useState<"signup" | "login">("login");
  const [signupForm, setSignupForm] = useState(initialSignupForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem(TOKEN_STORAGE_KEY)
  );
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    () => {
      const rawValue = window.localStorage.getItem(
        SELECTED_PROJECT_STORAGE_KEY
      );
      if (!rawValue) {
        return null;
      }

      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : null;
    }
  );
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(
    null
  );
  const [topView, setTopView] = useState<TopView>("organizations");
  const [organizationOpened, setOrganizationOpened] = useState(false);
  const [organizationSection, setOrganizationSection] =
    useState<OrganizationSection>("projects");
  const [projectSection, setProjectSection] = useState<ProjectSection>("board");
  const [organizationUsers, setOrganizationUsers] = useState<
    OrganizationUser[]
  >([]);
  const [organizationUsersLoading, setOrganizationUsersLoading] =
    useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [createProjectForm, setCreateProjectForm] =
    useState(initialProjectForm);
  const [createTaskForm, setCreateTaskForm] = useState(initialTaskForm);
  const [createBugForm, setCreateBugForm] = useState(initialBugForm);
  const [projectSettingsForm, setProjectSettingsForm] = useState({
    name: "",
    description: "",
  });

  const user = workspace?.user ?? null;
  const unreadNotifications = (workspace?.notifications ?? []).filter(
    (item) => !item.isRead
  );

  const organization = useMemo<OrganizationSummary | null>(() => {
    if (!workspace || !user) {
      return null;
    }

    return {
      id: "primary",
      name: buildOrganizationName(workspace),
      description:
        "Shared delivery workspace for multiple projects, a central user directory, and one GitHub repository per project.",
      projectCount: workspace.projects.length,
      repoCount: workspace.projects.reduce(
        (count, project) => count + project.repoCount,
        0
      ),
      openBugCount: workspace.projects.reduce(
        (count, project) => count + project.openBugCount,
        0
      ),
      memberCount:
        organizationUsers.length || selectedProject?.members.length || 1,
    };
  }, [
    organizationUsers.length,
    selectedProject?.members.length,
    user,
    workspace,
  ]);

  const organizationNavItems: NavItem<OrganizationSection>[] = useMemo(
    () => [
      {
        id: "projects",
        label: "Projects",
        description: "Create and open repository-backed projects.",
      },
      {
        id: "users",
        label: "Users",
        description: "Manage the shared org-level team directory.",
      },
      {
        id: "settings",
        label: "Settings",
        description: "Review org structure and GitHub connectivity.",
      },
    ],
    []
  );

  const projectNavItems: NavItem<ProjectSection>[] = useMemo(
    () => [
      {
        id: "board",
        label: "Board",
        description: "Track progress across delivery stages.",
      },
      {
        id: "bugs",
        label: "Bugs",
        description: "Review and triage project bug reports.",
      },
      {
        id: "tasks",
        label: "Tasks",
        description: "Create and manage scoped project work.",
      },
      {
        id: "settings",
        label: "Project settings",
        description: "Maintain naming and repository ownership.",
      },
    ],
    []
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
      window.localStorage.setItem(
        SELECTED_PROJECT_STORAGE_KEY,
        String(projectId)
      );
    }
    setSelectedProjectId(projectId);
  }

  function clearSession(): void {
    storeToken(null);
    rememberProjectSelection(null);
    setWorkspace(null);
    setSelectedProject(null);
    setOrganizationOpened(false);
    setTopView("organizations");
    setNotice(null);
    setError(null);
  }

  async function loadProjectDetail(
    sessionToken: string,
    projectId: number
  ): Promise<ProjectDetail> {
    const response = await getProject(sessionToken, projectId);
    startTransition(() => {
      setSelectedProject(response.project);
      setProjectSettingsForm({
        name: response.project.name,
        description: response.project.description,
      });
    });
    rememberProjectSelection(projectId);
    setOrganizationOpened(true);
    return response.project;
  }

  async function hydrateWorkspace(
    sessionToken: string,
    options: {
      preferredProjectId?: number | null;
      projectOverride?: ProjectDetail | null;
      quiet?: boolean;
    } = {}
  ): Promise<void> {
    if (!options.quiet) {
      setBusyLabel("Loading workspace");
    }

    const workspaceData = await getWorkspace(sessionToken);
    startTransition(() => {
      setWorkspace(workspaceData);
    });

    const requestedProjectId = options.preferredProjectId ?? selectedProjectId;
    const resolvedProjectId = workspaceData.projects.some(
      (project) => project.id === requestedProjectId
    )
      ? requestedProjectId
      : null;

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

    const projectOverride = options.projectOverride;

    if (projectOverride && projectOverride.id === resolvedProjectId) {
      rememberProjectSelection(resolvedProjectId);
      startTransition(() => {
        setSelectedProject(projectOverride);
        setProjectSettingsForm({
          name: projectOverride.name,
          description: projectOverride.description,
        });
      });
      setOrganizationOpened(true);
    } else {
      await loadProjectDetail(sessionToken, resolvedProjectId);
    }

    if (!options.quiet) {
      setBusyLabel(null);
    }
  }

  async function runProjectMutation(
    label: string,
    action: () => Promise<{ project: ProjectDetail }>,
    successNotice: string
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
      await hydrateWorkspace(token, {
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
    const isGitHubCallback =
      window.location.pathname === "/oauth/github/callback";
    const params = new URLSearchParams(window.location.search);

    if (isGitHubCallback) {
      const providerError =
        params.get("error_description") ?? params.get("error");
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
        setOrganizationOpened(true);
        setOrganizationSection("projects");
        setShowCreateProjectForm(true);
        setNotice(
          "GitHub connected. You can now create a project with a single repository."
        );
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
      if (selectedProjectId) {
        setOrganizationOpened(true);
      }
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
      buildApiUrl(
        `/api/projects/${selectedProjectId}/events/?token=${encodeURIComponent(
          token
        )}`
      )
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
      void hydrateWorkspace(token, { quiet: true });
    };

    stream.addEventListener("project.updated", handleUpdated);
    stream.addEventListener("project.deleted", handleDeleted);
    stream.onerror = () => stream.close();

    return () => {
      stream.removeEventListener("project.updated", handleUpdated);
      stream.removeEventListener("project.deleted", handleDeleted);
      stream.close();
    };
  }, [selectedProjectId, token]);

  useEffect(() => {
    if (
      !token ||
      !workspace ||
      !organizationOpened ||
      selectedProject ||
      organizationSection !== "users"
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setOrganizationUsersLoading(true);
        const responses = await Promise.all(
          workspace.projects.map((project) => getProject(token, project.id))
        );
        if (cancelled) {
          return;
        }
        setOrganizationUsers(
          dedupeOrganizationUsers(responses.map((response) => response.project))
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
  }, [
    organizationOpened,
    organizationSection,
    selectedProject,
    token,
    workspace,
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
      setTopView("organizations");

      if (connectGitHub) {
        await beginGitHubConnection(response.accessToken);
        return;
      }

      await hydrateWorkspace(response.accessToken, { quiet: true });
      setNotice("Account created. Open your organization when you are ready.");
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

  async function handleCreateProject(): Promise<void> {
    if (!token) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Creating project");

    try {
      const response = await createProject(token, {
        name: createProjectForm.name.trim(),
        description: createProjectForm.description.trim(),
        repositoryIds: [createProjectForm.repositoryId],
      });
      setCreateProjectForm(initialProjectForm);
      setShowCreateProjectForm(false);
      setProjectSection("board");
      setOrganizationOpened(true);
      await hydrateWorkspace(token, {
        preferredProjectId: response.project.id,
        projectOverride: response.project,
        quiet: true,
      });
      setNotice("Project created.");
    } catch (reason) {
      setError(getFriendlyError(reason));
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

  async function handleOpenProject(projectId: number): Promise<void> {
    if (!token) {
      return;
    }

    setBusyLabel("Opening project");
    setError(null);
    setNotice(null);

    try {
      await loadProjectDetail(token, projectId);
      setOrganizationOpened(true);
      setProjectSection("board");
    } catch (reason) {
      setError(getFriendlyError(reason));
    } finally {
      setBusyLabel(null);
    }
  }

  function openOrganization(section: OrganizationSection): void {
    setTopView(section === "settings" ? "settings" : "organizations");
    setOrganizationOpened(true);
    setOrganizationSection(section);
    setSelectedProject(null);
    rememberProjectSelection(null);
    setNotificationOpen(false);
  }

  function openOrganizationOverview(): void {
    setTopView("organizations");
    setOrganizationOpened(false);
    setSelectedProject(null);
    rememberProjectSelection(null);
    setNotificationOpen(false);
  }

  async function handleCreateTask(): Promise<void> {
    if (!token || !selectedProject) {
      return;
    }

    await runProjectMutation(
      "Creating task",
      () =>
        createTask(token, selectedProject.id, {
          title: createTaskForm.title.trim(),
          description: createTaskForm.description.trim(),
          status: createTaskForm.status,
          assigneeIds: [],
        }),
      "Task created."
    );
    setCreateTaskForm(initialTaskForm);
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

  async function handleCreateBug(): Promise<void> {
    if (!token || !selectedProject) {
      return;
    }

    await runProjectMutation(
      "Creating bug report",
      () =>
        createBugReport(token, selectedProject.id, {
          title: createBugForm.title.trim(),
          description: createBugForm.description.trim(),
          status: createBugForm.status,
        }),
      "Bug report created."
    );
    setCreateBugForm(initialBugForm);
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
      "Project settings saved."
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
      await deleteProject(token, selectedProject.id);
      rememberProjectSelection(null);
      setSelectedProject(null);
      setProjectSection("board");
      setOrganizationOpened(true);
      setOrganizationSection("projects");
      await hydrateWorkspace(token, { quiet: true });
      setNotice("Project deleted.");
    } catch (reason) {
      setError(getFriendlyError(reason));
    } finally {
      setBusyLabel(null);
    }
  }

  function handleTopViewChange(nextView: TopView): void {
    setNotificationOpen(false);

    if (nextView === "organizations") {
      openOrganizationOverview();
      return;
    }

    if (nextView === "settings") {
      openOrganization("settings");
      return;
    }

    setTopView("profile");
  }

  const topNav = (
    <TopNav
      activeView={topView}
      busyLabel={busyLabel}
      notifications={workspace?.notifications ?? []}
      notificationOpen={notificationOpen}
      unreadCount={unreadNotifications.length}
      user={user}
      onReadNotification={(notification) =>
        void handleReadNotification(notification)
      }
      onToggleNotifications={() => setNotificationOpen((current) => !current)}
      onViewChange={handleTopViewChange}
    />
  );

  const banner =
    error || notice ? (
      <SurfaceCard
        p="4"
        bg={error ? "#2a1317" : "#0f211d"}
        borderColor={error ? "#8c3a46" : "#2f6c58"}
      >
        <Text color={error ? "#ffc6ce" : "#b7f5de"}>{error ?? notice}</Text>
      </SurfaceCard>
    ) : null;

  if (isBooting) {
    return (
      <Box minH="100vh" bg="#090d12" display="grid" placeItems="center" px="4">
        <SurfaceCard p={{ base: "6", lg: "10" }} w="full" maxW="640px">
          <Stack gap="3">
            <Text
              fontSize="xs"
              textTransform="uppercase"
              letterSpacing="0.18em"
              color="#90a0b7"
            >
              Team Project Manager
            </Text>
            <Heading size="2xl" color="#f5f7fb">
              Preparing your workspace
            </Heading>
            <Text color="#b0bccf">
              {busyLabel ?? "Loading authentication state..."}
            </Text>
          </Stack>
        </SurfaceCard>
      </Box>
    );
  }

  if (!workspace || !user || !organization) {
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
        onSubmitSignup={(connectGitHub) =>
          void handleSubmitSignup(connectGitHub)
        }
      />
    );
  }

  if (topView === "profile") {
    return (
      <AppShell topNav={topNav} banner={banner}>
        <ProfilePage
          organization={organization}
          user={user}
          onConnectGitHub={() => void handleConnectGitHub()}
          onLogout={clearSession}
        />
      </AppShell>
    );
  }

  if (!organizationOpened) {
    return (
      <AppShell topNav={topNav} banner={banner}>
        <OrganizationOverviewPage
          organization={organization}
          projects={workspace.projects}
          onEnterOrganization={() => openOrganization("projects")}
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
              onChange={(event) =>
                void handleOpenProject(Number(event.target.value))
              }
            >
              {workspace.projects.map((project) => (
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
            borderRadius="0"
            variant="outline"
            borderColor="#2b3544"
            color="#eef3fb"
            onClick={() => openOrganization("projects")}
          >
            Back to organization
          </Button>
        }
      />
    );

    let projectContent = (
      <ProjectBoardPage
        project={selectedProject}
        onOpenTasks={() => setProjectSection("tasks")}
        onUpdateTaskStatus={(taskId, status) =>
          void handleUpdateTaskStatus(taskId, status)
        }
      />
    );

    if (projectSection === "tasks") {
      projectContent = (
        <ProjectTasksPage
          createTaskForm={createTaskForm}
          project={selectedProject}
          onCreateTask={() => void handleCreateTask()}
          onCreateTaskFormChange={(field, value) =>
            setCreateTaskForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onUpdateTaskStatus={(taskId, status) =>
            void handleUpdateTaskStatus(taskId, status)
          }
        />
      );
    }

    if (projectSection === "bugs") {
      projectContent = (
        <ProjectBugsPage
          createBugForm={createBugForm}
          project={selectedProject}
          onCreateBug={() => void handleCreateBug()}
          onCreateBugFormChange={(field, value) =>
            setCreateBugForm((current) => ({
              ...current,
              [field]: value,
            }))
          }
          onUpdateBugStatus={(bugId, status) =>
            void handleUpdateBugStatus(bugId, status)
          }
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
          borderRadius="0"
          variant="outline"
          borderColor="#2b3544"
          color="#eef3fb"
          onClick={openOrganizationOverview}
        >
          Back to organizations
        </Button>
      }
    />
  );

  let organizationContent = (
    <OrganizationProjectsPage
      projects={workspace.projects}
      availableRepos={workspace.availableRepos}
      createProjectForm={createProjectForm}
      githubRepoError={workspace.githubRepoError}
      isGitHubConnected={user.githubConnected}
      isCreatingProject={busyLabel === "Creating project"}
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
      <OrganizationUsersPage
        isLoading={organizationUsersLoading}
        users={organizationUsers}
      />
    );
  }

  if (organizationSection === "settings") {
    organizationContent = (
      <OrganizationSettingsPage
        githubRepoError={workspace.githubRepoError}
        isGitHubConnected={user.githubConnected}
        organization={organization}
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
