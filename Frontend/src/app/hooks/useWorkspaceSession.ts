import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  disconnectGitHub,
  login,
  logout,
  signup,
  startGitHubOauth,
} from "../../api";
import type { ProjectDetail, User, WorkspaceResponse } from "../../types";
import type { OrganizationSection, ProjectSection } from "../../view-models";
import {
  MARKETING_PATH,
  ORGANIZATIONS_PATH,
  SELECTED_ORGANIZATION_STORAGE_KEY,
  SELECTED_PROJECT_STORAGE_KEY,
} from "../constants";
import { getFriendlyError } from "../errors";
import {
  initialLoginForm,
  initialSignupForm,
  type LoginForm,
  type SignupForm,
} from "../forms";
import {
  getOrganizationPath,
  getProjectPath,
  normalizePath,
  stripAppBasePath,
  toBrowserPath,
} from "../routing";
import { useWorkspaceRouteSync } from "./useWorkspaceRouteSync";
import { useWorkspaceSessionEffects } from "./useWorkspaceSessionEffects";

type UseWorkspaceSessionParams = {
  applyProjectSettingsFromProject: (
    project: ProjectDetail,
    options?: { resetDirty?: boolean },
  ) => void;
  clearProjectSelection: () => void;
  clearProjectSettingsDraft: (projectId?: number | null) => void;
  completeGitHubOauthOnce: (
    code: string,
    state: string,
  ) => Promise<{
    user: User;
    repos: WorkspaceResponse["availableRepos"];
    githubRepoError: string | null;
  }>;
  selectedOrganizationId: number | null;
  selectedProject: ProjectDetail | null;
  selectedProjectId: number | null;
  setBusyLabel: Dispatch<SetStateAction<string | null>>;
  setCurrentPath: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsBooting: Dispatch<SetStateAction<boolean>>;
  setLoginForm: Dispatch<SetStateAction<LoginForm>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setNotificationOpen: Dispatch<SetStateAction<boolean>>;
  setOrganizationSection: Dispatch<SetStateAction<OrganizationSection>>;
  setProjectSection: Dispatch<SetStateAction<ProjectSection>>;
  setSelectedOrganizationId: Dispatch<SetStateAction<number | null>>;
  setSelectedProject: Dispatch<SetStateAction<ProjectDetail | null>>;
  setSelectedProjectId: Dispatch<SetStateAction<number | null>>;
  setSignupForm: Dispatch<SetStateAction<SignupForm>>;
  setToken: Dispatch<SetStateAction<string | null>>;
  setWorkspace: Dispatch<SetStateAction<WorkspaceResponse | null>>;
  token: string | null;
  user: User | null;
  workspace: WorkspaceResponse | null;
};

const AUTHENTICATED_SESSION_MARKER = "authenticated-session";

export function useWorkspaceSession({
  applyProjectSettingsFromProject,
  clearProjectSelection,
  clearProjectSettingsDraft,
  completeGitHubOauthOnce,
  selectedOrganizationId,
  selectedProject,
  selectedProjectId,
  setBusyLabel,
  setCurrentPath,
  setError,
  setIsBooting,
  setLoginForm,
  setNotice,
  setNotificationOpen,
  setOrganizationSection,
  setProjectSection,
  setSelectedOrganizationId,
  setSelectedProject,
  setSelectedProjectId,
  setSignupForm,
  setToken,
  setWorkspace,
  token,
  user,
  workspace,
}: UseWorkspaceSessionParams) {
  const setAuthenticatedSession = useCallback(
    (isAuthenticated: boolean): void => {
      setToken(isAuthenticated ? AUTHENTICATED_SESSION_MARKER : null);
    },
    [setToken],
  );

  const rememberOrganizationSelection = useCallback(
    (organizationId: number | null): void => {
      if (organizationId === null) {
        window.localStorage.removeItem(SELECTED_ORGANIZATION_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SELECTED_ORGANIZATION_STORAGE_KEY,
          String(organizationId),
        );
      }
      setSelectedOrganizationId(organizationId);
    },
    [setSelectedOrganizationId],
  );

  const rememberProjectSelection = useCallback(
    (projectId: number | null): void => {
      if (projectId === null) {
        window.localStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          SELECTED_PROJECT_STORAGE_KEY,
          String(projectId),
        );
      }
      setSelectedProjectId(projectId);
    },
    [setSelectedProjectId],
  );

  const navigateToPath = useCallback(
    (path: string, replace = false): void => {
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
    },
    [setCurrentPath],
  );

  const { runProjectMutation, syncFromPath } = useWorkspaceRouteSync({
    applyProjectSettingsFromProject,
    clearProjectSelection,
    navigateToPath,
    rememberOrganizationSelection,
    rememberProjectSelection,
    selectedOrganizationId,
    selectedProject,
    selectedProjectId,
    setBusyLabel,
    setError,
    setNotice,
    setNotificationOpen,
    setOrganizationSection,
    setProjectSection,
    setSelectedProject,
    setWorkspace,
    token,
    workspace,
  });

  const clearSession = useCallback((): void => {
    if (token) {
      void logout().catch(() => undefined);
    }
    setAuthenticatedSession(false);
    rememberOrganizationSelection(null);
    rememberProjectSelection(null);
    setWorkspace(null);
    clearProjectSelection();
    setOrganizationSection("projects");
    setNotice(null);
    setError(null);
    setBusyLabel(null);
    setNotificationOpen(false);
    clearProjectSettingsDraft();
    navigateToPath(MARKETING_PATH, true);
  }, [
    clearProjectSelection,
    clearProjectSettingsDraft,
    navigateToPath,
    rememberOrganizationSelection,
    rememberProjectSelection,
    setBusyLabel,
    setError,
    setNotificationOpen,
    setNotice,
    setOrganizationSection,
    setAuthenticatedSession,
    setWorkspace,
    token,
  ]);

  useWorkspaceSessionEffects({
    clearSession,
    completeGitHubOauthOnce,
    navigateToPath,
    setBusyLabel,
    setCurrentPath,
    setError,
    setIsBooting,
    setNotice,
    setToken,
    setWorkspace,
    syncFromPath,
    token,
  });

  const beginGitHubConnection = useCallback(
    async (): Promise<void> => {
      const response = await startGitHubOauth();
      window.location.assign(response.authorizationUrl);
    },
    [],
  );

  const submitSignup = useCallback(
    async (signupForm: SignupForm, connectGitHub: boolean): Promise<void> => {
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
        setAuthenticatedSession(true);
        setSignupForm(initialSignupForm);
        setLoginForm({ identifier: response.user.email, password: "" });
        navigateToPath(ORGANIZATIONS_PATH, true);

        if (connectGitHub) {
          await beginGitHubConnection();
          return;
        }

        await syncFromPath(AUTHENTICATED_SESSION_MARKER, { quiet: true });
        setNotice("Account created. Your account workspace is ready.");
      } catch (reason) {
        clearSession();
        setError(getFriendlyError(reason));
      } finally {
        setBusyLabel(null);
        setIsBooting(false);
      }
    },
    [
      beginGitHubConnection,
      clearSession,
      navigateToPath,
      setBusyLabel,
      setError,
      setIsBooting,
      setLoginForm,
      setNotice,
      setSignupForm,
      setAuthenticatedSession,
      syncFromPath,
    ],
  );

  const submitLogin = useCallback(
    async (loginForm: LoginForm): Promise<void> => {
      setError(null);
      setNotice(null);
      setIsBooting(true);
      setBusyLabel("Signing in");

      try {
        await login({
          identifier: loginForm.identifier.trim(),
          password: loginForm.password,
        });
        setAuthenticatedSession(true);
        setLoginForm(initialLoginForm);
        navigateToPath(ORGANIZATIONS_PATH, true);
        await syncFromPath(AUTHENTICATED_SESSION_MARKER, { quiet: true });
        setNotice("Welcome back.");
      } catch (reason) {
        clearSession();
        setError(getFriendlyError(reason));
      } finally {
        setBusyLabel(null);
        setIsBooting(false);
      }
    },
    [
      clearSession,
      navigateToPath,
      setBusyLabel,
      setError,
      setIsBooting,
      setLoginForm,
      setNotice,
      setAuthenticatedSession,
      syncFromPath,
    ],
  );

  const handleConnectGitHub = useCallback(async (): Promise<void> => {
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
      await beginGitHubConnection();
    } catch (reason) {
      setError(getFriendlyError(reason));
      setBusyLabel(null);
    }
  }, [
    beginGitHubConnection,
    setBusyLabel,
    setError,
    setNotice,
    token,
    user?.githubConnected,
  ]);

  const handleDisconnectGitHub = useCallback(async (): Promise<void> => {
    if (!token) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Disconnecting GitHub");

    try {
      const response = await disconnectGitHub();
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
  }, [setBusyLabel, setError, setNotice, setWorkspace, token]);

  const openProject = useCallback(
    (projectId: number, section: ProjectSection = "board"): void => {
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
    },
    [
      navigateToPath,
      rememberOrganizationSelection,
      rememberProjectSelection,
      selectedProject,
      setBusyLabel,
      setError,
      setNotice,
      setNotificationOpen,
      setProjectSection,
      syncFromPath,
      token,
    ],
  );

  const openOrganization = useCallback(
    (
      organizationId: number,
      section: OrganizationSection = "projects",
    ): void => {
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
    },
    [
      clearProjectSelection,
      navigateToPath,
      rememberOrganizationSelection,
      setNotificationOpen,
      setOrganizationSection,
      syncFromPath,
      token,
      workspace?.organizations,
    ],
  );

  return {
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
  };
}
