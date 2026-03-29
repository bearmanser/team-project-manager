import { useEffect, useMemo, useState } from "react";

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
import type { ProjectDetail, WorkspaceResponse } from "../types";
import type { OrganizationSection, ProjectSection } from "../view-models";
import {
  MARKETING_PATH,
  SELECTED_ORGANIZATION_STORAGE_KEY,
  SELECTED_PROJECT_STORAGE_KEY,
  SIGNUP_PATH,
  THEME_MODE_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from "./constants";
import {
  initialLoginForm,
  initialSignupForm,
} from "./forms";
import { BootingView } from "./components/BootingView";
import { useProjectLiveSync } from "./hooks/useProjectLiveSync";
import { useProjectSettingsDraft } from "./hooks/useProjectSettingsDraft";
import { useProjectWorkspaceActions } from "./hooks/useProjectWorkspaceActions";
import { useProjectWorkspaceState } from "./hooks/useProjectWorkspaceState";
import { useWorkspaceDerivedState } from "./hooks/useWorkspaceDerivedState";
import { useWorkspaceSession } from "./hooks/useWorkspaceSession";
import { getProjectPath, parseRoute, toBrowserPath } from "./routing";
import { parseStoredNumber } from "./storage";

function WorkspaceApp() {
  const completeGitHubOauthOnce = useGitHubOauthCallback();
  const {
    notificationOpen,
    setNotificationOpen,
    closeNotifications,
    toggleNotifications,
  } = useNotificationPanel();
  const { themeMode, setThemeMode } = useThemeMode(THEME_MODE_STORAGE_KEY);
  const { selectedOrganizationId, setSelectedOrganizationId } =
    useOrganizationSelection(
      SELECTED_ORGANIZATION_STORAGE_KEY,
      parseStoredNumber(SELECTED_ORGANIZATION_STORAGE_KEY),
    );
  const { selectedProjectId, setSelectedProjectId } = useProjectSelection(
    SELECTED_PROJECT_STORAGE_KEY,
    parseStoredNumber(SELECTED_PROJECT_STORAGE_KEY),
  );
  const [signupForm, setSignupForm] = useState(initialSignupForm);
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [token, setToken] = useState<string | null>(() =>
    window.localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(
    null,
  );
  const [organizationSection, setOrganizationSection] =
    useState<OrganizationSection>("projects");
  const [projectSection, setProjectSection] = useState<ProjectSection>("board");
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(true);

  const {
    applyProjectSettingsFromProject,
    clearProjectSettingsDraft,
    projectSettingsForm,
    updateProjectSettingsField,
  } = useProjectSettingsDraft();
  const projectWorkspaceState = useProjectWorkspaceState({
    setProjectSection,
    setSelectedProject,
    setSelectedProjectId,
  });
  const {
    currentOrganization,
    currentOrganizationProjects,
    endSprintUnfinishedTasks,
    githubRepoErrorMessage,
    organizationNavItems,
    projectNavItems,
    selectedBranchTask,
    selectedBug,
    selectedTask,
    user,
  } = useWorkspaceDerivedState({
    branchTaskId: projectWorkspaceState.branchTaskId,
    selectedBugId: projectWorkspaceState.selectedBugId,
    selectedOrganizationId,
    selectedProject,
    selectedTaskId: projectWorkspaceState.selectedTaskId,
    workspace,
  });

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
    applyProjectSettingsFromProject,
    clearProjectSelection: projectWorkspaceState.clearProjectSelection,
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
    clearProjectSelection: projectWorkspaceState.clearProjectSelection,
    rememberOrganizationSelection,
    navigateToPath,
  });

  const projectWorkspaceActions = useProjectWorkspaceActions({
    baseBranchDraft: projectWorkspaceState.baseBranchDraft,
    branchNameDraft: projectWorkspaceState.branchNameDraft,
    clearProjectSelection: projectWorkspaceState.clearProjectSelection,
    closeEndSprintFlow: projectWorkspaceState.closeEndSprintFlow,
    closeTaskBranchPrompt: projectWorkspaceState.closeTaskBranchPrompt,
    createBugForm: projectWorkspaceState.createBugForm,
    createTaskForm: projectWorkspaceState.createTaskForm,
    endSprintReview: projectWorkspaceState.endSprintReview,
    endSprintUnfinishedTasks,
    navigateToPath,
    projectSettingsForm,
    runProjectMutation,
    selectedBranchTask,
    selectedProject,
    setBaseBranchDraft: projectWorkspaceState.setBaseBranchDraft,
    setBranchNameDraft: projectWorkspaceState.setBranchNameDraft,
    setBranchTaskId: projectWorkspaceState.setBranchTaskId,
    setBusyLabel,
    setCreateBugForm: projectWorkspaceState.setCreateBugForm,
    setCreateTaskForm: projectWorkspaceState.setCreateTaskForm,
    setError,
    setImportableGitHubIssues: projectWorkspaceState.setImportableGitHubIssues,
    setIsLoadingImportableGitHubIssues:
      projectWorkspaceState.setIsLoadingImportableGitHubIssues,
    setNotice,
    setShowCreateBugForm: projectWorkspaceState.setShowCreateBugForm,
    setShowCreateTaskForm: projectWorkspaceState.setShowCreateTaskForm,
    setShowEndSprintActionModal:
      projectWorkspaceState.setShowEndSprintActionModal,
    setShowEndSprintModal: projectWorkspaceState.setShowEndSprintModal,
    setShowImportBugForm: projectWorkspaceState.setShowImportBugForm,
    syncFromPath,
    token,
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
    openTaskDetail: projectWorkspaceState.openTaskDetail,
    openBugDetail: projectWorkspaceState.openBugDetail,
    navigateToProject: (projectId) => navigateToPath(getProjectPath(projectId)),
    syncFromPath,
  });

  useProjectLiveSync({
    applyProjectSettingsFromProject,
    navigateToPath,
    projectSection,
    selectedOrganizationId,
    selectedProject,
    selectedProjectId,
    setProjectSection,
    setSelectedProject,
    setWorkspace,
    syncFromPath,
    token,
    workspace,
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

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

  const currentRoute = useMemo(() => parseRoute(currentPath), [currentPath]);

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
          projectWorkspaceState.hiddenCompletedProductBacklogTaskIds
        }
        createTaskForm={projectWorkspaceState.createTaskForm}
        createBugForm={projectWorkspaceState.createBugForm}
        projectSettingsForm={projectSettingsForm}
        importableGitHubIssues={projectWorkspaceState.importableGitHubIssues}
        isLoadingImportableGitHubIssues={
          projectWorkspaceState.isLoadingImportableGitHubIssues
        }
        showCreateTaskForm={projectWorkspaceState.showCreateTaskForm}
        showCreateBugForm={projectWorkspaceState.showCreateBugForm}
        showImportBugForm={projectWorkspaceState.showImportBugForm}
        showEndSprintModal={projectWorkspaceState.showEndSprintModal}
        showEndSprintActionModal={
          projectWorkspaceState.showEndSprintActionModal
        }
        endSprintReview={projectWorkspaceState.endSprintReview}
        endSprintUnfinishedAction={
          projectWorkspaceState.endSprintUnfinishedAction
        }
        endSprintUnfinishedTasks={endSprintUnfinishedTasks}
        selectedTask={selectedTask}
        selectedBug={selectedBug}
        selectedBranchTask={selectedBranchTask}
        branchNameDraft={projectWorkspaceState.branchNameDraft}
        baseBranchDraft={projectWorkspaceState.baseBranchDraft}
        onOpenProject={openProject}
        onOpenOrganization={(organizationId) =>
          openOrganization(organizationId, "projects")
        }
        onCreateTask={() => void projectWorkspaceActions.handleCreateTask()}
        onCreateBug={() => void projectWorkspaceActions.handleCreateBug()}
        onCreateTaskFormChange={(field, value) =>
          projectWorkspaceState.setCreateTaskForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onCreateBugFormChange={(field, value) =>
          projectWorkspaceState.setCreateBugForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onMarkTaskAsResolutionChange={(value) =>
          projectWorkspaceState.setCreateTaskForm((current) => ({
            ...current,
            markAsResolution: value,
          }))
        }
        onToggleCreateTaskForm={() =>
          projectWorkspaceState.setShowCreateTaskForm((current) => !current)
        }
        onToggleCreateBugForm={() =>
          projectWorkspaceState.setShowCreateBugForm((current) => !current)
        }
        onOpenCreateTask={projectWorkspaceState.openCreateTaskForm}
        onOpenTask={projectWorkspaceState.openTaskDetail}
        onOpenBug={projectWorkspaceState.openBugDetail}
        onUpdateTaskPriority={(taskId, priority) =>
          void projectWorkspaceActions.handleUpdateTaskPriority(taskId, priority)
        }
        onUpdateTaskStatus={(taskId, status) =>
          void projectWorkspaceActions.handleUpdateTaskStatus(taskId, status)
        }
        onMoveTaskPlacement={(taskId, placement) =>
          void projectWorkspaceActions.handleMoveTaskPlacement(taskId, placement)
        }
        onUpdateBugPriority={(bugId, priority) =>
          void projectWorkspaceActions.handleUpdateBugPriority(bugId, priority)
        }
        onUpdateBugStatus={(bugId, status) =>
          void projectWorkspaceActions.handleUpdateBugStatus(bugId, status)
        }
        onRenameSprint={(name) =>
          void projectWorkspaceActions.handleRenameSprint(name)
        }
        onOpenEndSprint={projectWorkspaceState.openEndSprintFlow}
        onCreateTaskBranch={projectWorkspaceActions.openTaskBranchPrompt}
        onCleanupProductBacklogDoneTasks={
          projectWorkspaceState.handleCleanupProductBacklogDoneTasks
        }
        onOpenImportBugForm={() =>
          void projectWorkspaceActions.handleOpenImportBugForm()
        }
        onCloseImportBugForm={projectWorkspaceState.closeImportBugForm}
        onImportBugFromGitHubIssue={(issue) =>
          void projectWorkspaceActions.handleImportBugFromGitHubIssue(issue)
        }
        onCreateTaskFromBug={projectWorkspaceActions.openCreateTaskFromBug}
        onAddProjectRepository={(repositoryId) =>
          void projectWorkspaceActions.handleAddProjectRepository(repositoryId)
        }
        onRemoveProjectRepository={(repositoryId) =>
          void projectWorkspaceActions.handleRemoveProjectRepository(repositoryId)
        }
        onProjectSettingsChange={updateProjectSettingsField}
        onSaveProjectSettings={() =>
          void projectWorkspaceActions.handleSaveProjectSettings()
        }
        onDeleteSelectedProject={() =>
          void projectWorkspaceActions.handleDeleteSelectedProject()
        }
        onConnectGitHub={() => void handleConnectGitHub()}
        onCloseTaskDetail={() => projectWorkspaceState.setSelectedTaskId(null)}
        onCloseBugDetail={() => projectWorkspaceState.setSelectedBugId(null)}
        onSaveTaskDetails={projectWorkspaceActions.handleSaveTaskDetails}
        onSaveBugDetails={projectWorkspaceActions.handleSaveBugDetails}
        onAddTaskDetailComment={(taskId, payload) =>
          void projectWorkspaceActions.handleAddTaskDetailComment(taskId, payload)
        }
        onToggleTaskCommentReaction={(commentId, emoji) =>
          void projectWorkspaceActions.handleToggleTaskCommentReaction(
            commentId,
            emoji,
          )
        }
        onAddBugDetailComment={(bugId, payload) =>
          void projectWorkspaceActions.handleAddBugDetailComment(bugId, payload)
        }
        onToggleBugCommentReaction={(commentId, emoji) =>
          void projectWorkspaceActions.handleToggleBugCommentReaction(
            commentId,
            emoji,
          )
        }
        onBaseBranchChange={projectWorkspaceState.setBaseBranchDraft}
        onBranchNameChange={projectWorkspaceState.setBranchNameDraft}
        onCloseTaskBranchPrompt={projectWorkspaceState.closeTaskBranchPrompt}
        onSubmitTaskBranch={() =>
          void projectWorkspaceActions.handleCreateTaskBranch()
        }
        onEndSprintReviewChange={projectWorkspaceState.setEndSprintReview}
        onEndSprintActionChange={projectWorkspaceState.setEndSprintUnfinishedAction}
        onCloseEndSprintFlow={projectWorkspaceState.closeEndSprintFlow}
        onSubmitEndSprintRequest={projectWorkspaceActions.handleEndSprintRequest}
        onSubmitEndSprint={(action) =>
          void projectWorkspaceActions.handleEndSprint(action)
        }
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
