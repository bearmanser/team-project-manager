import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  addBugComment,
  addProjectRepos,
  addTaskComment,
  createBugReport,
  createTask,
  createTaskBranch,
  deleteProject,
  endProjectSprint,
  getProjectGitHubIssues,
  importBugFromGitHubIssue,
  removeProjectRepo,
  toggleBugCommentReaction,
  toggleTaskCommentReaction,
  updateBugReport,
  updateProjectSettings,
  updateProjectSprint,
  updateTask,
} from "../../api";
import type {
  BacklogPlacement,
  BugStatus,
  EndSprintUnfinishedAction,
  GitHubIssueCandidate,
  PriorityLevel,
  ProjectDetail,
  Task,
  TaskStatus,
} from "../../types";
import { ORGANIZATIONS_PATH } from "../constants";
import { getFriendlyError } from "../errors";
import {
  initialBugForm,
  initialTaskForm,
  type BugForm,
  type ProjectSettingsForm,
  type TaskForm,
} from "../forms";
import { getOrganizationPath } from "../routing";

type RunProjectMutation = (
  label: string,
  action: () => Promise<{ project: ProjectDetail }>,
  successNotice: string,
) => Promise<boolean>;

type UseProjectWorkspaceActionsParams = {
  baseBranchDraft: string;
  branchNameDraft: string;
  clearProjectSelection: () => void;
  closeEndSprintFlow: () => void;
  closeTaskBranchPrompt: () => void;
  createBugForm: BugForm;
  createTaskForm: TaskForm;
  endSprintReview: string;
  endSprintUnfinishedTasks: Task[];
  navigateToPath: (path: string, replace?: boolean) => void;
  projectSettingsForm: ProjectSettingsForm;
  runProjectMutation: RunProjectMutation;
  selectedBranchTask: Task | null;
  selectedProject: ProjectDetail | null;
  setBaseBranchDraft: Dispatch<SetStateAction<string>>;
  setBranchNameDraft: Dispatch<SetStateAction<string>>;
  setBranchTaskId: Dispatch<SetStateAction<number | null>>;
  setBusyLabel: Dispatch<SetStateAction<string | null>>;
  setCreateBugForm: Dispatch<SetStateAction<BugForm>>;
  setCreateTaskForm: Dispatch<SetStateAction<TaskForm>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setImportableGitHubIssues: Dispatch<SetStateAction<GitHubIssueCandidate[]>>;
  setIsLoadingImportableGitHubIssues: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setShowCreateBugForm: Dispatch<SetStateAction<boolean>>;
  setShowCreateTaskForm: Dispatch<SetStateAction<boolean>>;
  setShowEndSprintActionModal: Dispatch<SetStateAction<boolean>>;
  setShowEndSprintModal: Dispatch<SetStateAction<boolean>>;
  setShowImportBugForm: Dispatch<SetStateAction<boolean>>;
  syncFromPath: (
    sessionToken: string,
    options?: { quiet?: boolean },
  ) => Promise<void>;
  token: string | null;
};

export function useProjectWorkspaceActions({
  baseBranchDraft,
  branchNameDraft,
  clearProjectSelection,
  closeEndSprintFlow,
  closeTaskBranchPrompt,
  createBugForm,
  createTaskForm,
  endSprintReview,
  endSprintUnfinishedTasks,
  navigateToPath,
  projectSettingsForm,
  runProjectMutation,
  selectedBranchTask,
  selectedProject,
  setBaseBranchDraft,
  setBranchNameDraft,
  setBranchTaskId,
  setBusyLabel,
  setCreateBugForm,
  setCreateTaskForm,
  setError,
  setImportableGitHubIssues,
  setIsLoadingImportableGitHubIssues,
  setNotice,
  setShowCreateBugForm,
  setShowCreateTaskForm,
  setShowEndSprintActionModal,
  setShowEndSprintModal,
  setShowImportBugForm,
  syncFromPath,
  token,
}: UseProjectWorkspaceActionsParams) {
  const loadProjectGitHubIssueCandidates = useCallback(
    async (projectId: number): Promise<void> => {
      if (!token) {
        return;
      }

      setIsLoadingImportableGitHubIssues(true);
      try {
        const response = await getProjectGitHubIssues(token, projectId);
        setImportableGitHubIssues(response.issues);
      } catch (reason) {
        setError(getFriendlyError(reason));
      } finally {
        setIsLoadingImportableGitHubIssues(false);
      }
    },
    [
      setError,
      setImportableGitHubIssues,
      setIsLoadingImportableGitHubIssues,
      token,
    ],
  );

  const openCreateTaskFromBug = useCallback(
    (bugId: number): void => {
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
    },
    [selectedProject, setCreateTaskForm, setShowCreateTaskForm],
  );

  const handleOpenImportBugForm = useCallback(async (): Promise<void> => {
    if (!selectedProject) {
      return;
    }

    setError(null);
    setNotice(null);
    setShowImportBugForm(true);
    await loadProjectGitHubIssueCandidates(selectedProject.id);
  }, [
    loadProjectGitHubIssueCandidates,
    selectedProject,
    setError,
    setNotice,
    setShowImportBugForm,
  ]);

  const handleCreateTask = useCallback(async (): Promise<void> => {
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
      createTaskForm.bugReportId ? "Task created from bug." : "Task added.",
    );
    setCreateTaskForm(initialTaskForm);
    setShowCreateTaskForm(false);
  }, [
    createTaskForm,
    runProjectMutation,
    selectedProject,
    setCreateTaskForm,
    setShowCreateTaskForm,
    token,
  ]);

  const handleUpdateTaskStatus = useCallback(
    async (taskId: number, status: TaskStatus): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Updating task",
        () => updateTask(token, taskId, { status }),
        "Task updated.",
      );
    },
    [runProjectMutation, token],
  );

  const handleUpdateTaskPriority = useCallback(
    async (taskId: number, priority: PriorityLevel): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Updating task priority",
        () => updateTask(token, taskId, { priority }),
        "Task updated.",
      );
    },
    [runProjectMutation, token],
  );

  const handleMoveTaskPlacement = useCallback(
    async (taskId: number, placement: BacklogPlacement): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Updating backlog placement",
        () => updateTask(token, taskId, { placement }),
        "Task updated.",
      );
    },
    [runProjectMutation, token],
  );

  const handleSaveTaskDetails = useCallback(
    async (
      taskId: number,
      payload: Partial<{
        title: string;
        description: string;
        status: string;
        priority: string;
        assigneeIds: number[];
        resolvedBugIds: number[];
      }>,
    ): Promise<boolean> => {
      if (!token) {
        return false;
      }

      return runProjectMutation(
        "Saving task",
        () => updateTask(token, taskId, payload),
        "Task saved.",
      );
    },
    [runProjectMutation, token],
  );

  const openTaskBranchPrompt = useCallback(
    (task: Task): void => {
      const repository = selectedProject?.repositories[0] ?? null;
      if (!repository) {
        setNotice(null);
        setError("This project does not have a connected repository.");
        return;
      }

      setBranchTaskId(task.id);
      setBranchNameDraft(task.branchName || "");
      setBaseBranchDraft(repository.defaultBranch);
    },
    [
      selectedProject,
      setBaseBranchDraft,
      setBranchNameDraft,
      setBranchTaskId,
      setError,
      setNotice,
    ],
  );

  const handleCreateTaskBranch = useCallback(async (): Promise<void> => {
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
      "Git branch created.",
    );

    if (didCreateBranch) {
      closeTaskBranchPrompt();
    }
  }, [
    baseBranchDraft,
    branchNameDraft,
    closeTaskBranchPrompt,
    runProjectMutation,
    selectedBranchTask,
    selectedProject,
    setError,
    setNotice,
    token,
  ]);

  const handleAddTaskDetailComment = useCallback(
    async (
      taskId: number,
      payload: {
        body: string;
        anchorType?: string;
        anchorId?: string;
        anchorLabel?: string;
      },
    ): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Adding task comment",
        () => addTaskComment(token, taskId, payload),
        "Comment added.",
      );
    },
    [runProjectMutation, token],
  );

  const handleToggleTaskCommentReaction = useCallback(
    async (commentId: number, emoji: string): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Updating task reaction",
        () => toggleTaskCommentReaction(token, commentId, { emoji }),
        "Reaction updated.",
      );
    },
    [runProjectMutation, token],
  );

  const handleCreateBug = useCallback(async (): Promise<void> => {
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
  }, [
    createBugForm,
    runProjectMutation,
    selectedProject,
    setCreateBugForm,
    setShowCreateBugForm,
    token,
  ]);

  const handleUpdateBugStatus = useCallback(
    async (bugId: number, status: BugStatus): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Updating bug report",
        () => updateBugReport(token, bugId, { status }),
        "Bug report updated.",
      );
    },
    [runProjectMutation, token],
  );

  const handleUpdateBugPriority = useCallback(
    async (bugId: number, priority: PriorityLevel): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Updating bug priority",
        () => updateBugReport(token, bugId, { priority }),
        "Bug report updated.",
      );
    },
    [runProjectMutation, token],
  );

  const handleSaveBugDetails = useCallback(
    async (
      bugId: number,
      payload: Partial<{
        title: string;
        description: string;
        status: string;
        priority: string;
      }>,
    ): Promise<boolean> => {
      if (!token) {
        return false;
      }

      return runProjectMutation(
        "Saving bug report",
        () => updateBugReport(token, bugId, payload),
        "Bug saved.",
      );
    },
    [runProjectMutation, token],
  );

  const handleAddBugDetailComment = useCallback(
    async (
      bugId: number,
      payload: {
        body: string;
        anchorType?: string;
        anchorId?: string;
        anchorLabel?: string;
      },
    ): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Adding bug comment",
        () => addBugComment(token, bugId, payload),
        "Comment added.",
      );
    },
    [runProjectMutation, token],
  );

  const handleToggleBugCommentReaction = useCallback(
    async (commentId: number, emoji: string): Promise<void> => {
      if (!token) {
        return;
      }

      await runProjectMutation(
        "Updating bug reaction",
        () => toggleBugCommentReaction(token, commentId, { emoji }),
        "Reaction updated.",
      );
    },
    [runProjectMutation, token],
  );

  const handleImportBugFromGitHubIssue = useCallback(
    async (issue: GitHubIssueCandidate): Promise<void> => {
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
        "GitHub issue imported as a bug.",
      );
      if (didImportBug) {
        await loadProjectGitHubIssueCandidates(selectedProject.id);
      }
    },
    [
      loadProjectGitHubIssueCandidates,
      runProjectMutation,
      selectedProject,
      token,
    ],
  );

  const handleAddProjectRepository = useCallback(
    async (repositoryId: string): Promise<void> => {
      if (!token || !selectedProject || !repositoryId) {
        return;
      }

      await runProjectMutation(
        "Connecting repository",
        () => addProjectRepos(token, selectedProject.id, { repositoryId }),
        "Repository connected.",
      );
    },
    [runProjectMutation, selectedProject, token],
  );

  const handleRemoveProjectRepository = useCallback(
    async (repositoryId: number): Promise<void> => {
      if (!token || !selectedProject) {
        return;
      }

      await runProjectMutation(
        "Disconnecting repository",
        () => removeProjectRepo(token, selectedProject.id, repositoryId),
        "Repository disconnected.",
      );
    },
    [runProjectMutation, selectedProject, token],
  );

  const handleSaveProjectSettings = useCallback(async (): Promise<void> => {
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
  }, [projectSettingsForm, runProjectMutation, selectedProject, token]);

  const handleEndSprint = useCallback(
    async (
      unfinishedAction: EndSprintUnfinishedAction = "carryover",
    ): Promise<void> => {
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
    },
    [
      closeEndSprintFlow,
      endSprintReview,
      runProjectMutation,
      selectedProject,
      token,
    ],
  );

  const handleEndSprintRequest = useCallback((): void => {
    if (endSprintUnfinishedTasks.length > 0) {
      setShowEndSprintModal(false);
      setShowEndSprintActionModal(true);
      return;
    }

    void handleEndSprint();
  }, [
    endSprintUnfinishedTasks.length,
    handleEndSprint,
    setShowEndSprintActionModal,
    setShowEndSprintModal,
  ]);

  const handleRenameSprint = useCallback(
    async (name: string): Promise<void> => {
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
    },
    [runProjectMutation, selectedProject, token],
  );

  const handleDeleteSelectedProject = useCallback(async (): Promise<void> => {
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
        true,
      );
      await syncFromPath(token, { quiet: true });
      setNotice("Project deleted.");
    } catch (reason) {
      setError(getFriendlyError(reason));
    } finally {
      setBusyLabel(null);
    }
  }, [
    clearProjectSelection,
    navigateToPath,
    selectedProject,
    setBusyLabel,
    setError,
    setNotice,
    syncFromPath,
    token,
  ]);

  return {
    handleAddBugDetailComment,
    handleAddProjectRepository,
    handleAddTaskDetailComment,
    handleCreateBug,
    handleCreateTask,
    handleCreateTaskBranch,
    handleDeleteSelectedProject,
    handleEndSprint,
    handleEndSprintRequest,
    handleImportBugFromGitHubIssue,
    handleMoveTaskPlacement,
    handleOpenImportBugForm,
    handleRemoveProjectRepository,
    handleRenameSprint,
    handleSaveBugDetails,
    handleSaveProjectSettings,
    handleSaveTaskDetails,
    handleToggleBugCommentReaction,
    handleToggleTaskCommentReaction,
    handleUpdateBugPriority,
    handleUpdateBugStatus,
    handleUpdateTaskPriority,
    handleUpdateTaskStatus,
    openCreateTaskFromBug,
    openTaskBranchPrompt,
  };
}
