import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  AUTH_TOKEN_INVALID_EVENT,
  ApiError,
  disconnectGitHub,
  getProject,
  getWorkspace,
  login,
  signup,
  startGitHubOauth,
} from "../../api";
import type { ProjectDetail, User, WorkspaceResponse } from "../../types";
import type { OrganizationSection, ProjectSection } from "../../view-models";
import {
  MARKETING_PATH,
  ORGANIZATIONS_PATH,
  TOKEN_STORAGE_KEY,
} from "../constants";
import { getFriendlyError } from "../errors";
import { initialLoginForm, initialSignupForm } from "../forms";
import {
  getOrganizationPath,
  getProjectPath,
  normalizePath,
  parseRoute,
  stripAppBasePath,
  toBrowserPath,
} from "../routing";
import { mergeProjectIntoWorkspace, resolveOrganizationSelection } from "../workspace";

type UseWorkspaceSessionParams = {
  completeGitHubOauthOnce: (
    sessionToken: string,
    code: string,
    state: string,
  ) => Promise<{
    user: User;
    repos: WorkspaceResponse["availableRepos"];
    githubRepoError: string | null;
  }>;
  token: string | null;
  user: User | null;
  setCurrentPath: Dispatch<SetStateAction<string>>;
  selectedOrganizationId: number | null;
  selectedProjectId: number | null;
  selectedProject: ProjectDetail | null;
  workspace: WorkspaceResponse | null;
  setToken: Dispatch<SetStateAction<string | null>>;
  setWorkspace: Dispatch<SetStateAction<WorkspaceResponse | null>>;
  setSelectedOrganizationId: Dispatch<SetStateAction<number | null>>;
  setSelectedProjectId: Dispatch<SetStateAction<number | null>>;
  setSelectedProject: Dispatch<SetStateAction<ProjectDetail | null>>;
  setOrganizationSection: Dispatch<SetStateAction<OrganizationSection>>;
  setProjectSection: Dispatch<SetStateAction<ProjectSection>>;
  setBusyLabel: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setIsBooting: Dispatch<SetStateAction<boolean>>;
  setNotificationOpen: Dispatch<SetStateAction<boolean>>;
  setSignupForm: Dispatch<
    SetStateAction<{
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
    }>
  >;
  setLoginForm: Dispatch<
    SetStateAction<{
      identifier: string;
      password: string;
    }>
  >;
  applyProjectSettingsFromProject: (
    project: ProjectDetail,
    options?: { resetDirty?: boolean },
  ) => void;
  clearProjectSettingsDraft: (projectId?: number | null) => void;
  clearProjectSelection: () => void;
};

export function useWorkspaceSession({
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
}: UseWorkspaceSessionParams) {
  const routeSyncRequestIdRef = useRef(0);

  const storeToken = useCallback((nextToken: string | null): void => {
    if (nextToken) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setToken(nextToken);
  }, [setToken]);

  const rememberOrganizationSelection = useCallback((organizationId: number | null): void => {
    if (organizationId === null) {
      window.localStorage.removeItem("team-project-manager.selected-organization");
    } else {
      window.localStorage.setItem(
        "team-project-manager.selected-organization",
        String(organizationId),
      );
    }
    setSelectedOrganizationId(organizationId);
  }, [setSelectedOrganizationId]);

  const rememberProjectSelection = useCallback((projectId: number | null): void => {
    if (projectId === null) {
      window.localStorage.removeItem("team-project-manager.selected-project");
    } else {
      window.localStorage.setItem(
        "team-project-manager.selected-project",
        String(projectId),
      );
    }
    setSelectedProjectId(projectId);
  }, [setSelectedProjectId]);

  const navigateToPath = useCallback((path: string, replace = false): void => {
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

    setCurrentPath(window.location.pathname);
  }, [setCurrentPath]);

  const clearSession = useCallback((): void => {
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
  }, [
    clearProjectSettingsDraft,
    navigateToPath,
    rememberOrganizationSelection,
    rememberProjectSelection,
    setBusyLabel,
    setError,
    setNotificationOpen,
    setNotice,
    setOrganizationSection,
    setProjectSection,
    setSelectedProject,
    setWorkspace,
    storeToken,
  ]);

  function isActiveRouteSyncRequest(routeSyncRequestId?: number): boolean {
    return (
      routeSyncRequestId === undefined ||
      routeSyncRequestId === routeSyncRequestIdRef.current
    );
  }

  async function loadProjectDetail(
    sessionToken: string,
    projectId: number,
    routeSyncRequestId?: number,
  ): Promise<ProjectDetail> {
    const response = await getProject(sessionToken, projectId);
    if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
      return response.project;
    }
    setSelectedProject(response.project);
    applyProjectSettingsFromProject(response.project);
    setWorkspace((current) =>
      mergeProjectIntoWorkspace(current, response.project),
    );
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
    routeSyncRequestId?: number,
  ): Promise<{
    resolvedOrganizationId: number | null;
    resolvedProjectId: number | null;
  }> {
    if (!options.quiet && isActiveRouteSyncRequest(routeSyncRequestId)) {
      setBusyLabel("Loading workspace");
    }

    const workspaceData = await getWorkspace(sessionToken);
    if (isActiveRouteSyncRequest(routeSyncRequestId)) {
      setWorkspace(workspaceData);
    }

    const requestedProjectId = Object.prototype.hasOwnProperty.call(
      options,
      "preferredProjectId",
    )
      ? options.preferredProjectId ?? null
      : selectedProjectId;
    const resolvedProjectId = workspaceData.projects.some(
      (project) => project.id === requestedProjectId,
    )
      ? requestedProjectId
      : null;

    if (resolvedProjectId !== null) {
      const projectOverride = options.projectOverride;
      if (projectOverride && projectOverride.id === resolvedProjectId) {
        if (isActiveRouteSyncRequest(routeSyncRequestId)) {
          rememberProjectSelection(resolvedProjectId);
          rememberOrganizationSelection(projectOverride.organizationId);
          setSelectedProject(projectOverride);
          applyProjectSettingsFromProject(projectOverride);
        }
      } else {
        await loadProjectDetail(
          sessionToken,
          resolvedProjectId,
          routeSyncRequestId,
        );
      }

      if (!options.quiet && isActiveRouteSyncRequest(routeSyncRequestId)) {
        setBusyLabel(null);
      }

      return {
        resolvedOrganizationId:
          options.projectOverride?.id === resolvedProjectId
            ? options.projectOverride.organizationId
            : workspaceData.projects.find(
                (project) => project.id === resolvedProjectId,
              )?.organizationId ?? null,
        resolvedProjectId,
      };
    }

    if (isActiveRouteSyncRequest(routeSyncRequestId)) {
      rememberProjectSelection(null);
      setSelectedProject(null);
    }

    const requestedOrganizationId = Object.prototype.hasOwnProperty.call(
      options,
      "preferredOrganizationId",
    )
      ? options.preferredOrganizationId ?? null
      : selectedOrganizationId;
    const resolvedOrganizationId = resolveOrganizationSelection(
      workspaceData.organizations,
      requestedOrganizationId,
    );

    if (isActiveRouteSyncRequest(routeSyncRequestId)) {
      rememberOrganizationSelection(resolvedOrganizationId);
    }

    if (!options.quiet && isActiveRouteSyncRequest(routeSyncRequestId)) {
      setBusyLabel(null);
    }

    return {
      resolvedOrganizationId,
      resolvedProjectId: null,
    };
  }

  async function syncFromPath(
    sessionToken: string,
    options: { quiet?: boolean } = {},
  ): Promise<void> {
    const routeSyncRequestId = ++routeSyncRequestIdRef.current;
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
      const result = await hydrateWorkspace(
        sessionToken,
        {
          preferredProjectId: null,
          quiet: options.quiet,
        },
        routeSyncRequestId,
      );
      if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
        return;
      }
      if (result.resolvedOrganizationId !== null) {
        navigateToPath(getOrganizationPath(result.resolvedOrganizationId), true);
      }
      return;
    }

    if (route.kind === "organization") {
      setOrganizationSection(route.section);
      clearProjectSelection();
      const result = await hydrateWorkspace(
        sessionToken,
        {
          preferredOrganizationId: route.organizationId,
          preferredProjectId: null,
          quiet: options.quiet,
        },
        routeSyncRequestId,
      );
      if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
        return;
      }
      if (result.resolvedOrganizationId !== route.organizationId) {
        navigateToPath(
          result.resolvedOrganizationId
            ? getOrganizationPath(result.resolvedOrganizationId)
            : ORGANIZATIONS_PATH,
          true,
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
          await loadProjectDetail(
            sessionToken,
            route.projectId,
            routeSyncRequestId,
          );
          if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
            return;
          }
          return;
        } catch (reason) {
          if (!(reason instanceof ApiError) || reason.status !== 404) {
            throw reason;
          }
        }
      }

      const result = await hydrateWorkspace(
        sessionToken,
        {
          preferredOrganizationId: null,
          preferredProjectId: route.projectId,
          quiet: options.quiet,
        },
        routeSyncRequestId,
      );
      if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
        return;
      }
      if (result.resolvedProjectId !== route.projectId) {
        navigateToPath(
          result.resolvedOrganizationId
            ? getOrganizationPath(result.resolvedOrganizationId)
            : ORGANIZATIONS_PATH,
          true,
        );
      }
    }
  }

  const syncFromPathRef = useRef(syncFromPath);

  useEffect(() => {
    syncFromPathRef.current = syncFromPath;
  });

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
      setSelectedProject(response.project);
      applyProjectSettingsFromProject(response.project, { resetDirty: true });
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
        handleAuthTokenInvalid,
      );
  }, [clearSession, setError]);

  useEffect(() => {
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
          const response = await completeGitHubOauthOnce(sessionToken, code, state);
          setWorkspace((current) =>
            current
              ? {
                  ...current,
                  user: response.user,
                  availableRepos: response.repos,
                  githubRepoError: response.githubRepoError,
                }
              : current,
          );
          navigateToPath(ORGANIZATIONS_PATH, true);
          try {
            await syncFromPathRef.current(sessionToken, { quiet: true });
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
        await syncFromPathRef.current(sessionToken, { quiet: true });
      } catch (reason) {
        clearSession();
        setError(getFriendlyError(reason));
      } finally {
        setIsBooting(false);
      }
    }

    void bootstrapWorkspace();
  }, [
    clearSession,
    completeGitHubOauthOnce,
    navigateToPath,
    setBusyLabel,
    setError,
    setIsBooting,
    setNotice,
    setWorkspace,
  ]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const sessionToken = token;

    function handlePopState(): void {
      setCurrentPath(window.location.pathname);
      void syncFromPathRef.current(sessionToken, { quiet: true });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setCurrentPath, token]);

  async function submitSignup(
    signupForm: {
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
    },
    connectGitHub: boolean,
  ): Promise<void> {
    if (signupForm.password !== signupForm.confirmPassword) {
      setError("Passwords must match before creating the account.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsBooting(true);
    setBusyLabel(
      connectGitHub
        ? "Creating account and preparing GitHub"
        : "Creating account",
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
      setIsBooting(false);
    }
  }

  async function submitLogin(loginForm: {
    identifier: string;
    password: string;
  }): Promise<void> {
    setError(null);
    setNotice(null);
    setIsBooting(true);
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
      setIsBooting(false);
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
        : "Opening GitHub",
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
      setWorkspace((current) =>
        current
          ? {
              ...current,
              user: response.user,
              availableRepos: [],
              githubRepoError: null,
            }
          : current,
      );
      setNotice("GitHub disconnected.");
    } catch (reason) {
      setError(getFriendlyError(reason));
    } finally {
      setBusyLabel(null);
    }
  }

  function openProject(
    projectId: number,
    section: ProjectSection = "board",
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
    section: OrganizationSection = "projects",
  ): void {
    if (!token) {
      return;
    }

    setNotificationOpen(false);
    const organizationPath = getOrganizationPath(organizationId, section);
    const organizationExistsInWorkspace =
      workspace?.organizations.some(
        (organization) => organization.id === organizationId,
      ) ?? false;

    if (organizationExistsInWorkspace) {
      rememberOrganizationSelection(organizationId);
      clearProjectSelection();
      setOrganizationSection(section);
      navigateToPath(organizationPath);
      return;
    }

    navigateToPath(organizationPath);
    void syncFromPath(token, { quiet: true });
  }

  return {
    clearSession,
    handleConnectGitHub,
    handleDisconnectGitHub,
    hydrateWorkspace,
    navigateToPath,
    openOrganization,
    openProject,
    rememberOrganizationSelection,
    rememberProjectSelection,
    runProjectMutation,
    submitLogin,
    submitSignup,
    syncFromPath,
  };
}
