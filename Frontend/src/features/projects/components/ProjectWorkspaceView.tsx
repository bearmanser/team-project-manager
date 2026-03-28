import type { ReactNode } from "react";

import { Button, Stack, Text } from "@chakra-ui/react";

import { AppShell } from "../../../components/AppShell";
import { SideNav } from "../../../components/SideNav";
import { EndSprintIncompleteTasksModal } from "../modals/EndSprintIncompleteTasksModal";
import { EndSprintModal } from "../modals/EndSprintModal";
import { TaskBranchModal } from "../modals/TaskBranchModal";
import { WorkItemDetailModal } from "../modals/WorkItemDetailModal";
import { ProjectBoardPage } from "../pages/ProjectBoardPage";
import { ProjectBugsPage } from "../pages/ProjectBugsPage";
import { ProjectSettingsPage } from "../pages/ProjectSettingsPage";
import { ProjectSprintHistoryPage } from "../pages/ProjectSprintHistoryPage";
import { ProjectTasksPage } from "../pages/ProjectTasksPage";
import type {
  BacklogPlacement,
  BugReport,
  BugStatus,
  EndSprintUnfinishedAction,
  GitHubIssueCandidate,
  PriorityLevel,
  ProjectDetail,
  ProjectSummary,
  Repo,
  Task,
  TaskStatus,
  User,
} from "../../../types";
import { sidebarSelectStyle } from "../../../utils";
import type { NavItem, ProjectSection } from "../../../view-models";

type ProjectWorkspaceViewProps = {
  topNav: ReactNode;
  currentOrganization: {
    id: number;
    displayName: string;
    isPersonal: boolean;
  };
  currentOrganizationProjects: ProjectSummary[];
  projectNavItems: NavItem<ProjectSection>[];
  projectSection: ProjectSection;
  project: ProjectDetail;
  user: User;
  availableRepos: Repo[];
  busyLabel: string | null;
  githubRepoErrorMessage: string | null;
  hiddenCompletedProductBacklogTaskIds: Record<number, number[]>;
  createTaskForm: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: PriorityLevel;
    placement: BacklogPlacement;
    bugReportId: number | null;
    bugReportTitle: string;
    markAsResolution: boolean;
  };
  createBugForm: {
    title: string;
    description: string;
    status: BugStatus;
    priority: PriorityLevel;
  };
  projectSettingsForm: {
    name: string;
    description: string;
    useSprints: boolean;
  };
  importableGitHubIssues: GitHubIssueCandidate[];
  isLoadingImportableGitHubIssues: boolean;
  showCreateTaskForm: boolean;
  showCreateBugForm: boolean;
  showImportBugForm: boolean;
  showEndSprintModal: boolean;
  showEndSprintActionModal: boolean;
  endSprintReview: string;
  endSprintUnfinishedAction: EndSprintUnfinishedAction;
  endSprintUnfinishedTasks: Task[];
  selectedTask: Task | null;
  selectedBug: BugReport | null;
  selectedBranchTask: Task | null;
  branchNameDraft: string;
  baseBranchDraft: string;
  onOpenProject: (projectId: number, section?: ProjectSection) => void;
  onOpenOrganization: (organizationId: number) => void;
  onCreateTask: () => void;
  onCreateBug: () => void;
  onCreateTaskFormChange: (
    field: "title" | "description" | "status" | "priority" | "placement",
    value: string,
  ) => void;
  onCreateBugFormChange: (
    field: "title" | "description" | "status" | "priority",
    value: string,
  ) => void;
  onMarkTaskAsResolutionChange: (value: boolean) => void;
  onToggleCreateTaskForm: () => void;
  onToggleCreateBugForm: () => void;
  onOpenCreateTask: (status: TaskStatus, placement?: BacklogPlacement) => void;
  onOpenTask: (taskId: number) => void;
  onOpenBug: (bugId: number) => void;
  onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
  onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
  onMoveTaskPlacement: (taskId: number, placement: BacklogPlacement) => void;
  onUpdateBugPriority: (bugId: number, priority: PriorityLevel) => void;
  onUpdateBugStatus: (bugId: number, status: BugStatus) => void;
  onRenameSprint: (name: string) => void;
  onOpenEndSprint: () => void;
  onCreateTaskBranch: (task: Task) => void;
  onCleanupProductBacklogDoneTasks: (
    projectId: number,
    taskIds: number[],
  ) => void;
  onOpenImportBugForm: () => void;
  onCloseImportBugForm: () => void;
  onImportBugFromGitHubIssue: (issue: GitHubIssueCandidate) => void;
  onCreateTaskFromBug: (bugId: number) => void;
  onAddProjectRepository: (repositoryId: string) => void;
  onRemoveProjectRepository: (repositoryId: number) => void;
  onProjectSettingsChange: (
    field: "name" | "description" | "useSprints",
    value: string | boolean,
  ) => void;
  onSaveProjectSettings: () => void;
  onDeleteSelectedProject: () => void;
  onConnectGitHub: () => void;
  onCloseTaskDetail: () => void;
  onCloseBugDetail: () => void;
  onSaveTaskDetails: (
    taskId: number,
    payload: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      assigneeIds: number[];
      resolvedBugIds: number[];
    }>,
  ) => Promise<boolean>;
  onSaveBugDetails: (
    bugId: number,
    payload: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
    }>,
  ) => Promise<boolean>;
  onAddTaskDetailComment: (
    taskId: number,
    payload: {
      body: string;
      anchorType?: string;
      anchorId?: string;
      anchorLabel?: string;
    },
  ) => void;
  onToggleTaskCommentReaction: (commentId: number, emoji: string) => void;
  onAddBugDetailComment: (
    bugId: number,
    payload: {
      body: string;
      anchorType?: string;
      anchorId?: string;
      anchorLabel?: string;
    },
  ) => void;
  onToggleBugCommentReaction: (commentId: number, emoji: string) => void;
  onBaseBranchChange: (value: string) => void;
  onBranchNameChange: (value: string) => void;
  onCloseTaskBranchPrompt: () => void;
  onSubmitTaskBranch: () => void;
  onEndSprintReviewChange: (value: string) => void;
  onEndSprintActionChange: (value: EndSprintUnfinishedAction) => void;
  onCloseEndSprintFlow: () => void;
  onSubmitEndSprintRequest: () => void;
  onSubmitEndSprint: (action: EndSprintUnfinishedAction) => void;
};

export function ProjectWorkspaceView({
  topNav,
  currentOrganization,
  currentOrganizationProjects,
  projectNavItems,
  projectSection,
  project,
  user,
  availableRepos,
  busyLabel,
  githubRepoErrorMessage,
  hiddenCompletedProductBacklogTaskIds,
  createTaskForm,
  createBugForm,
  projectSettingsForm,
  importableGitHubIssues,
  isLoadingImportableGitHubIssues,
  showCreateTaskForm,
  showCreateBugForm,
  showImportBugForm,
  showEndSprintModal,
  showEndSprintActionModal,
  endSprintReview,
  endSprintUnfinishedAction,
  endSprintUnfinishedTasks,
  selectedTask,
  selectedBug,
  selectedBranchTask,
  branchNameDraft,
  baseBranchDraft,
  onOpenProject,
  onOpenOrganization,
  onCreateTask,
  onCreateBug,
  onCreateTaskFormChange,
  onCreateBugFormChange,
  onMarkTaskAsResolutionChange,
  onToggleCreateTaskForm,
  onToggleCreateBugForm,
  onOpenCreateTask,
  onOpenTask,
  onOpenBug,
  onUpdateTaskPriority,
  onUpdateTaskStatus,
  onMoveTaskPlacement,
  onUpdateBugPriority,
  onUpdateBugStatus,
  onRenameSprint,
  onOpenEndSprint,
  onCreateTaskBranch,
  onCleanupProductBacklogDoneTasks,
  onOpenImportBugForm,
  onCloseImportBugForm,
  onImportBugFromGitHubIssue,
  onCreateTaskFromBug,
  onAddProjectRepository,
  onRemoveProjectRepository,
  onProjectSettingsChange,
  onSaveProjectSettings,
  onDeleteSelectedProject,
  onConnectGitHub,
  onCloseTaskDetail,
  onCloseBugDetail,
  onSaveTaskDetails,
  onSaveBugDetails,
  onAddTaskDetailComment,
  onToggleTaskCommentReaction,
  onAddBugDetailComment,
  onToggleBugCommentReaction,
  onBaseBranchChange,
  onBranchNameChange,
  onCloseTaskBranchPrompt,
  onSubmitTaskBranch,
  onEndSprintReviewChange,
  onEndSprintActionChange,
  onCloseEndSprintFlow,
  onSubmitEndSprintRequest,
  onSubmitEndSprint,
}: ProjectWorkspaceViewProps) {
  const projectSidebar = (
    <SideNav
      items={projectNavItems}
      activeItem={projectSection}
      onSelect={(section) => onOpenProject(project.id, section)}
      topSlot={
        <Stack gap="3">
          <Text color="var(--color-text-subtle)" fontSize="sm">
            {currentOrganization.displayName}
          </Text>
          <select
            value={String(project.id)}
            style={sidebarSelectStyle}
            onChange={(event) => {
              const nextProjectId = Number(event.target.value);
              event.target.blur();
              onOpenProject(nextProjectId, projectSection);
            }}
          >
            {currentOrganizationProjects.map((organizationProject) => (
              <option key={organizationProject.id} value={organizationProject.id}>
                {organizationProject.name}
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
          onClick={() => onOpenOrganization(currentOrganization.id)}
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
      project={project}
      onCreateTask={onCreateTask}
      onCreateTaskFormChange={onCreateTaskFormChange}
      onMarkTaskAsResolutionChange={onMarkTaskAsResolutionChange}
      onOpenCreateTask={onOpenCreateTask}
      onOpenTask={onOpenTask}
      onToggleCreateTaskForm={onToggleCreateTaskForm}
      onUpdateTaskPriority={onUpdateTaskPriority}
      onUpdateTaskStatus={onUpdateTaskStatus}
      onMoveTaskPlacement={onMoveTaskPlacement}
      onRenameSprint={onRenameSprint}
      onOpenEndSprint={onOpenEndSprint}
      onCreateTaskBranch={onCreateTaskBranch}
    />
  );

  if (projectSection === "tasks") {
    projectContent = (
      <ProjectTasksPage
        createTaskForm={createTaskForm}
        hiddenProductBacklogTaskIds={
          hiddenCompletedProductBacklogTaskIds[project.id] ?? []
        }
        isCreateOpen={showCreateTaskForm}
        project={project}
        onCleanupProductBacklogDoneTasks={onCleanupProductBacklogDoneTasks}
        onCreateTask={onCreateTask}
        onCreateTaskFormChange={onCreateTaskFormChange}
        onMarkTaskAsResolutionChange={onMarkTaskAsResolutionChange}
        onToggleCreateForm={onToggleCreateTaskForm}
        onOpenCreateTask={onOpenCreateTask}
        onOpenTask={onOpenTask}
        onUpdateTaskPriority={onUpdateTaskPriority}
        onUpdateTaskStatus={onUpdateTaskStatus}
        onMoveTaskPlacement={onMoveTaskPlacement}
        onRenameSprint={onRenameSprint}
        onCreateTaskBranch={onCreateTaskBranch}
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
        project={project}
        onCloseImport={onCloseImportBugForm}
        onCreateBug={onCreateBug}
        onCreateBugFormChange={onCreateBugFormChange}
        onCreateTaskFromBug={onCreateTaskFromBug}
        onImportIssue={onImportBugFromGitHubIssue}
        onOpenBug={onOpenBug}
        onOpenImport={onOpenImportBugForm}
        onToggleCreateForm={onToggleCreateBugForm}
        onUpdateBugPriority={onUpdateBugPriority}
        onUpdateBugStatus={onUpdateBugStatus}
      />
    );
  }

  if (projectSection === "history" && project.useSprints) {
    projectContent = <ProjectSprintHistoryPage project={project} />;
  }

  if (projectSection === "settings") {
    projectContent = (
      <ProjectSettingsPage
        availableRepos={availableRepos}
        busyLabel={busyLabel}
        githubRepoError={githubRepoErrorMessage}
        isGitHubConnected={user.githubConnected}
        project={project}
        projectSettingsForm={projectSettingsForm}
        onAddRepository={onAddProjectRepository}
        onConnectGitHub={onConnectGitHub}
        onDeleteProject={onDeleteSelectedProject}
        onProjectSettingsChange={onProjectSettingsChange}
        onRemoveRepository={onRemoveProjectRepository}
        onSaveProjectSettings={onSaveProjectSettings}
      />
    );
  }

  return (
    <AppShell topNav={topNav} sidebar={projectSidebar}>
      {projectContent}
      <WorkItemDetailModal
        isOpen={Boolean(selectedTask)}
        project={project}
        task={selectedTask}
        onClose={onCloseTaskDetail}
        onSaveTask={onSaveTaskDetails}
        onCreateTaskBranch={onCreateTaskBranch}
        onSaveBug={onSaveBugDetails}
        onAddTaskComment={onAddTaskDetailComment}
        onToggleTaskCommentReaction={onToggleTaskCommentReaction}
        onAddBugComment={onAddBugDetailComment}
        onToggleBugCommentReaction={onToggleBugCommentReaction}
      />
      <WorkItemDetailModal
        isOpen={Boolean(selectedBug)}
        project={project}
        bug={selectedBug}
        onClose={onCloseBugDetail}
        onSaveTask={onSaveTaskDetails}
        onCreateTaskBranch={onCreateTaskBranch}
        onSaveBug={onSaveBugDetails}
        onAddTaskComment={onAddTaskDetailComment}
        onToggleTaskCommentReaction={onToggleTaskCommentReaction}
        onAddBugComment={onAddBugDetailComment}
        onToggleBugCommentReaction={onToggleBugCommentReaction}
      />
      <TaskBranchModal
        baseBranch={baseBranchDraft}
        branchName={branchNameDraft}
        isOpen={Boolean(selectedBranchTask)}
        project={project}
        task={selectedBranchTask}
        onBaseBranchChange={onBaseBranchChange}
        onBranchNameChange={onBranchNameChange}
        onClose={onCloseTaskBranchPrompt}
        onSubmit={onSubmitTaskBranch}
      />
      <EndSprintModal
        isOpen={showEndSprintModal}
        project={project}
        reviewText={endSprintReview}
        onChange={onEndSprintReviewChange}
        onClose={onCloseEndSprintFlow}
        onSubmit={onSubmitEndSprintRequest}
      />
      <EndSprintIncompleteTasksModal
        action={endSprintUnfinishedAction}
        isOpen={showEndSprintActionModal}
        sprintName={project.activeSprint?.name ?? ""}
        tasks={endSprintUnfinishedTasks}
        onActionChange={onEndSprintActionChange}
        onClose={onCloseEndSprintFlow}
        onSubmit={() => onSubmitEndSprint(endSprintUnfinishedAction)}
      />
    </AppShell>
  );
}
