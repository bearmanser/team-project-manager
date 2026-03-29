import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  BacklogPlacement,
  EndSprintUnfinishedAction,
  GitHubIssueCandidate,
  ProjectDetail,
  TaskStatus,
} from "../../types";
import type { ProjectSection } from "../../view-models";
import {
  initialBugForm,
  initialTaskForm,
  type BugForm,
  type TaskForm,
} from "../forms";

type UseProjectWorkspaceStateParams = {
  setProjectSection: Dispatch<SetStateAction<ProjectSection>>;
  setSelectedProject: Dispatch<SetStateAction<ProjectDetail | null>>;
  setSelectedProjectId: Dispatch<SetStateAction<number | null>>;
};

export function useProjectWorkspaceState({
  setProjectSection,
  setSelectedProject,
  setSelectedProjectId,
}: UseProjectWorkspaceStateParams) {
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
  const [createTaskForm, setCreateTaskForm] = useState<TaskForm>(initialTaskForm);
  const [createBugForm, setCreateBugForm] = useState<BugForm>(initialBugForm);
  const [importableGitHubIssues, setImportableGitHubIssues] = useState<
    GitHubIssueCandidate[]
  >([]);
  const [isLoadingImportableGitHubIssues, setIsLoadingImportableGitHubIssues] =
    useState(false);
  const [
    hiddenCompletedProductBacklogTaskIds,
    setHiddenCompletedProductBacklogTaskIds,
  ] = useState<Record<number, number[]>>({});

  const openCreateTaskForm = useCallback(
    (status: TaskStatus, placement: BacklogPlacement = "product"): void => {
      setCreateTaskForm({
        ...initialTaskForm,
        status,
        placement,
      });
      setShowCreateTaskForm(true);
    },
    [],
  );

  const openTaskDetail = useCallback((taskId: number): void => {
    setSelectedBugId(null);
    setSelectedTaskId(taskId);
  }, []);

  const openBugDetail = useCallback((bugId: number): void => {
    setSelectedTaskId(null);
    setSelectedBugId(bugId);
  }, []);

  const closeImportBugForm = useCallback((): void => {
    setShowImportBugForm(false);
    setImportableGitHubIssues([]);
  }, []);

  const closeTaskBranchPrompt = useCallback((): void => {
    setBranchTaskId(null);
    setBranchNameDraft("");
    setBaseBranchDraft("");
  }, []);

  const closeEndSprintFlow = useCallback((): void => {
    setShowEndSprintModal(false);
    setShowEndSprintActionModal(false);
    setEndSprintReview("");
    setEndSprintUnfinishedAction("carryover");
  }, []);

  const openEndSprintFlow = useCallback((): void => {
    setEndSprintUnfinishedAction("carryover");
    setShowEndSprintActionModal(false);
    setShowEndSprintModal(true);
  }, []);

  const handleCleanupProductBacklogDoneTasks = useCallback(
    (projectId: number, taskIds: number[]): void => {
      setHiddenCompletedProductBacklogTaskIds((current) => ({
        ...current,
        [projectId]: taskIds,
      }));
    },
    [],
  );

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
  }, [setProjectSection, setSelectedProject, setSelectedProjectId]);

  return {
    baseBranchDraft,
    branchNameDraft,
    branchTaskId,
    clearProjectSelection,
    closeEndSprintFlow,
    closeImportBugForm,
    closeTaskBranchPrompt,
    createBugForm,
    createTaskForm,
    endSprintReview,
    endSprintUnfinishedAction,
    handleCleanupProductBacklogDoneTasks,
    hiddenCompletedProductBacklogTaskIds,
    importableGitHubIssues,
    isLoadingImportableGitHubIssues,
    openBugDetail,
    openCreateTaskForm,
    openEndSprintFlow,
    openTaskDetail,
    selectedBugId,
    selectedTaskId,
    setBaseBranchDraft,
    setBranchNameDraft,
    setBranchTaskId,
    setCreateBugForm,
    setCreateTaskForm,
    setEndSprintReview,
    setEndSprintUnfinishedAction,
    setImportableGitHubIssues,
    setIsLoadingImportableGitHubIssues,
    setSelectedBugId,
    setSelectedTaskId,
    setShowCreateBugForm,
    setShowCreateTaskForm,
    setShowEndSprintActionModal,
    setShowEndSprintModal,
    setShowImportBugForm,
    showCreateBugForm,
    showCreateTaskForm,
    showEndSprintActionModal,
    showEndSprintModal,
    showImportBugForm,
  };
}
