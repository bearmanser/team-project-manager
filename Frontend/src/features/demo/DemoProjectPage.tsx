import { useMemo, useRef, useState } from "react";

import { Button, Text } from "@chakra-ui/react";

import { TopNav } from "../../components/TopNav";
import { ModalFrame } from "../../components/ModalFrame";
import { ProjectWorkspaceView } from "../projects/components/ProjectWorkspaceView";
import {
  initialBugForm,
  initialTaskForm,
  type BugForm,
  type TaskForm,
} from "../../app/forms";
import type {
  BacklogPlacement,
  BugReport,
  BugStatus,
  EndSprintUnfinishedAction,
  PriorityLevel,
  ProjectDetail,
  Task,
  TaskStatus,
  User,
} from "../../types";
import type { NavItem, ProjectSection } from "../../view-models";
import { buildDemoProject, buildDemoProjectSummary, demoUser } from "./demoProjectData";

type DemoProjectPageProps = {
  themeMode: "light" | "dark";
  onExitDemo: () => void;
  onToggleThemeMode: () => void;
};

const demoOrganization = {
  id: 9800,
  displayName: "Demo Hiring Team",
  isPersonal: false,
};

const demoNavItems: NavItem<ProjectSection>[] = [
  {
    id: "board",
    label: "Board",
    description: "Move sprint work through delivery stages.",
  },
  {
    id: "tasks",
    label: "Tasks",
    description: "Compare sprint and product backlog work.",
  },
  {
    id: "bugs",
    label: "Bugs",
    description: "Triage issues and create follow-up tasks.",
  },
  {
    id: "history",
    label: "Sprint History",
    description: "Review completed sprint outcomes.",
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function taskSummary(task: Task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assigneeCount: task.assignees.length,
    sprintId: task.sprintId,
    sprintName: task.sprintName,
    isResolutionTask: task.isResolutionTask,
  };
}

function bugSummary(bug: BugReport) {
  return {
    id: bug.id,
    title: bug.title,
    status: bug.status,
    priority: bug.priority,
  };
}

function usersByIds(project: ProjectDetail, userIds: number[]): User[] {
  const memberUsers = new Map(project.members.map((member) => [member.user.id, member.user]));
  return userIds
    .map((userId) => memberUsers.get(userId) ?? null)
    .filter((user): user is User => user !== null);
}

export function DemoProjectPage({
  themeMode,
  onExitDemo,
  onToggleThemeMode,
}: DemoProjectPageProps) {
  const nextIdRef = useRef(10000);
  const [project, setProject] = useState<ProjectDetail>(() => buildDemoProject());
  const [projectSection, setProjectSection] = useState<ProjectSection>("board");
  const [createTaskForm, setCreateTaskForm] = useState<TaskForm>(initialTaskForm);
  const [createBugForm, setCreateBugForm] = useState<BugForm>(initialBugForm);
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const [showCreateBugForm, setShowCreateBugForm] = useState(false);
  const [showIntroPrompt, setShowIntroPrompt] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null);
  const [hiddenProductTaskIds, setHiddenProductTaskIds] = useState<Record<number, number[]>>({});
  const [notice, setNotice] = useState<string | null>(
    "Demo loaded. Changes are temporary and stay in this browser tab.",
  );

  const currentOrganizationProjects = useMemo(
    () => [buildDemoProjectSummary(project)],
    [project],
  );
  const selectedTask = useMemo(
    () => project.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [project.tasks, selectedTaskId],
  );
  const selectedBug = useMemo(
    () => project.bugReports.find((bug) => bug.id === selectedBugId) ?? null,
    [project.bugReports, selectedBugId],
  );
  const endSprintUnfinishedTasks = useMemo(
    () =>
      project.activeSprint
        ? project.tasks.filter(
            (task) => task.sprintId === project.activeSprint?.id && task.status !== "done",
          )
        : [],
    [project.activeSprint, project.tasks],
  );

  function allocateId(): number {
    const nextId = nextIdRef.current;
    nextIdRef.current += 1;
    return nextId;
  }

  function showTemporaryNotice(message: string): void {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  }

  function openCreateTaskForm(
    status: TaskStatus,
    placement: BacklogPlacement = "product",
  ): void {
    setCreateTaskForm({
      ...initialTaskForm,
      status,
      placement,
    });
    setShowCreateTaskForm(true);
  }

  function openCreateTaskFromBug(bugId: number): void {
    const bug = project.bugReports.find((item) => item.id === bugId);
    if (!bug) {
      return;
    }

    setCreateTaskForm({
      ...initialTaskForm,
      title: bug.title.startsWith("Fix:") ? bug.title : `Fix: ${bug.title}`,
      description: bug.description,
      priority: bug.priority,
      placement: project.activeSprint ? "sprint" : "product",
      bugReportId: bug.id,
      bugReportTitle: bug.title,
      markAsResolution: !bug.resolutionTaskId,
    });
    setShowCreateTaskForm(true);
  }

  function createTask(): void {
    const title = createTaskForm.title.trim();
    if (!title) {
      return;
    }

    const createdAt = nowIso();
    const linkedBug = createTaskForm.bugReportId
      ? project.bugReports.find((bug) => bug.id === createTaskForm.bugReportId) ?? null
      : null;
    const taskId = allocateId();
    const sprint = project.activeSprint && createTaskForm.placement === "sprint" ? project.activeSprint : null;
    const task: Task = {
      id: taskId,
      title,
      description: createTaskForm.description.trim(),
      status: createTaskForm.status,
      priority: createTaskForm.priority,
      creator: demoUser,
      assignees: [demoUser],
      sprintId: sprint?.id ?? null,
      sprintName: sprint?.name ?? "",
      bugReportId: linkedBug?.id ?? null,
      bugReportTitle: linkedBug?.title ?? "",
      isResolutionTask: Boolean(linkedBug && createTaskForm.markAsResolution),
      branchName: "",
      branchUrl: "",
      branchRepositoryId: null,
      resolvedBugs: linkedBug && createTaskForm.markAsResolution ? [bugSummary(linkedBug)] : [],
      directGitHubIssues: [],
      inheritedGitHubIssues: linkedBug?.linkedGitHubIssues ?? [],
      comments: [],
      activity: [],
      createdAt,
      updatedAt: createdAt,
    };

    setProject((current) => ({
      ...current,
      tasks: [...current.tasks, task],
      bugReports: current.bugReports.map((bug) => {
        if (bug.id !== linkedBug?.id) {
          return bug;
        }

        return {
          ...bug,
          resolutionTaskId: createTaskForm.markAsResolution ? task.id : bug.resolutionTaskId,
          resolutionTaskTitle: createTaskForm.markAsResolution ? task.title : bug.resolutionTaskTitle,
          tasks: [...bug.tasks, taskSummary(task)],
          updatedAt: createdAt,
        };
      }),
      updatedAt: createdAt,
    }));
    setCreateTaskForm(initialTaskForm);
    setShowCreateTaskForm(false);
    showTemporaryNotice(linkedBug ? "Demo task created from bug." : "Demo task added.");
  }

  function createBug(): void {
    const title = createBugForm.title.trim();
    if (!title) {
      return;
    }

    const createdAt = nowIso();
    const bug: BugReport = {
      id: allocateId(),
      title,
      description: createBugForm.description.trim(),
      status: createBugForm.status,
      priority: createBugForm.priority,
      reporter: demoUser,
      resolutionTaskId: null,
      resolutionTaskTitle: "",
      linkedGitHubIssues: [],
      tasks: [],
      comments: [],
      activity: [],
      closedAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    setProject((current) => ({
      ...current,
      bugReports: [bug, ...current.bugReports],
      updatedAt: createdAt,
    }));
    setCreateBugForm(initialBugForm);
    setShowCreateBugForm(false);
    showTemporaryNotice("Demo bug report added.");
  }

  function updateTask(taskId: number, payload: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
    assigneeIds: number[];
    resolvedBugIds: number[];
  }>): Promise<boolean> {
    const updatedAt = nowIso();
    setProject((current) => {
      const nextTasks = current.tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const resolvedBugs =
          payload.resolvedBugIds !== undefined
            ? current.bugReports
                .filter((bug) => payload.resolvedBugIds?.includes(bug.id))
                .map(bugSummary)
            : task.resolvedBugs;

        return {
          ...task,
          title: payload.title ?? task.title,
          description: payload.description ?? task.description,
          status: (payload.status as TaskStatus | undefined) ?? task.status,
          priority: (payload.priority as PriorityLevel | undefined) ?? task.priority,
          assignees:
            payload.assigneeIds !== undefined
              ? usersByIds(current, payload.assigneeIds)
              : task.assignees,
          resolvedBugs,
          updatedAt,
        };
      });
      const savedTask = nextTasks.find((task) => task.id === taskId);

      return {
        ...current,
        tasks: nextTasks,
        bugReports: current.bugReports.map((bug) => {
          const resolvesBug = Boolean(payload.resolvedBugIds?.includes(bug.id));
          const shouldClearResolution =
            payload.resolvedBugIds !== undefined && bug.resolutionTaskId === taskId && !resolvesBug;
          const shouldSetResolution = resolvesBug && savedTask !== undefined;

          return {
            ...bug,
            resolutionTaskId: shouldClearResolution
              ? null
              : shouldSetResolution
                ? taskId
                : bug.resolutionTaskId,
            resolutionTaskTitle: shouldClearResolution
              ? ""
              : shouldSetResolution
                ? savedTask.title
                : bug.resolutionTaskTitle,
            tasks: savedTask
              ? [
                  ...bug.tasks.filter((task) => task.id !== taskId),
                  ...(savedTask.bugReportId === bug.id || shouldSetResolution
                    ? [taskSummary({ ...savedTask, isResolutionTask: shouldSetResolution })]
                    : []),
                ]
              : bug.tasks,
            status:
              shouldSetResolution && savedTask.status === "done"
                ? "closed"
                : bug.status,
            closedAt:
              shouldSetResolution && savedTask.status === "done"
                ? updatedAt
                : bug.closedAt,
            updatedAt,
          };
        }),
        updatedAt,
      };
    });
    showTemporaryNotice("Demo task saved.");
    return Promise.resolve(true);
  }

  function updateBug(bugId: number, payload: Partial<{
    title: string;
    description: string;
    status: string;
    priority: string;
  }>): Promise<boolean> {
    const updatedAt = nowIso();
    setProject((current) => ({
      ...current,
      bugReports: current.bugReports.map((bug) =>
        bug.id === bugId
          ? {
              ...bug,
              title: payload.title ?? bug.title,
              description: payload.description ?? bug.description,
              status: (payload.status as BugStatus | undefined) ?? bug.status,
              priority: (payload.priority as PriorityLevel | undefined) ?? bug.priority,
              closedAt: payload.status === "closed" ? updatedAt : payload.status ? null : bug.closedAt,
              updatedAt,
            }
          : bug,
      ),
      updatedAt,
    }));
    showTemporaryNotice("Demo bug saved.");
    return Promise.resolve(true);
  }

  function deleteTask(taskId: number): Promise<boolean> {
    setProject((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
      bugReports: current.bugReports.map((bug) => ({
        ...bug,
        resolutionTaskId: bug.resolutionTaskId === taskId ? null : bug.resolutionTaskId,
        resolutionTaskTitle: bug.resolutionTaskId === taskId ? "" : bug.resolutionTaskTitle,
        tasks: bug.tasks.filter((task) => task.id !== taskId),
        updatedAt: bug.resolutionTaskId === taskId ? nowIso() : bug.updatedAt,
      })),
      updatedAt: nowIso(),
    }));
    setSelectedTaskId(null);
    showTemporaryNotice("Demo task deleted.");
    return Promise.resolve(true);
  }

  function deleteBug(bugId: number): Promise<boolean> {
    setProject((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.bugReportId === bugId
          ? {
              ...task,
              bugReportId: null,
              bugReportTitle: "",
              isResolutionTask: false,
              resolvedBugs: task.resolvedBugs.filter((bug) => bug.id !== bugId),
              inheritedGitHubIssues: [],
              updatedAt: nowIso(),
            }
          : task,
      ),
      bugReports: current.bugReports.filter((bug) => bug.id !== bugId),
      updatedAt: nowIso(),
    }));
    setSelectedBugId(null);
    showTemporaryNotice("Demo bug deleted.");
    return Promise.resolve(true);
  }

  function addTaskComment(taskId: number, payload: { body: string }): void {
    const createdAt = nowIso();
    setProject((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              comments: [
                ...task.comments,
                {
                  id: allocateId(),
                  body: payload.body,
                  author: demoUser,
                  anchorType: "",
                  anchorId: "",
                  anchorLabel: "",
                  reactions: [],
                  createdAt,
                  updatedAt: createdAt,
                },
              ],
            }
          : task,
      ),
    }));
  }

  function addBugComment(bugId: number, payload: { body: string }): void {
    const createdAt = nowIso();
    setProject((current) => ({
      ...current,
      bugReports: current.bugReports.map((bug) =>
        bug.id === bugId
          ? {
              ...bug,
              comments: [
                ...bug.comments,
                {
                  id: allocateId(),
                  body: payload.body,
                  author: demoUser,
                  anchorType: "",
                  anchorId: "",
                  anchorLabel: "",
                  reactions: [],
                  createdAt,
                  updatedAt: createdAt,
                },
              ],
            }
          : bug,
      ),
    }));
  }

  const topNav = (
    <TopNav
      busyLabel={null}
      error={null}
      notice={notice}
      notifications={[]}
      notificationOpen={false}
      unreadCount={0}
      themeMode={themeMode}
      user={demoUser}
      onAcceptNotification={() => undefined}
      onCloseNotifications={() => undefined}
      onConnectGitHub={() => showTemporaryNotice("GitHub is disabled in the temporary demo.")}
      onDisconnectGitHub={() => undefined}
      onLogout={onExitDemo}
      onOpenNotification={() => undefined}
      onReadNotification={() => undefined}
      onToggleNotifications={() => showTemporaryNotice("Notifications are disabled in the temporary demo.")}
      onToggleThemeMode={onToggleThemeMode}
    />
  );

  return (
    <>
      <ProjectWorkspaceView
        topNav={topNav}
        currentOrganization={demoOrganization}
        currentOrganizationProjects={currentOrganizationProjects}
        projectNavItems={demoNavItems}
        projectSection={projectSection}
        project={project}
        user={demoUser}
        availableRepos={[]}
        busyLabel={null}
        githubRepoErrorMessage={null}
        hiddenCompletedProductBacklogTaskIds={hiddenProductTaskIds}
        createTaskForm={createTaskForm}
        createBugForm={createBugForm}
        projectSettingsForm={{
          name: project.name,
          description: project.description,
          useSprints: project.useSprints,
        }}
        importableGitHubIssues={[]}
        isLoadingImportableGitHubIssues={false}
        showCreateTaskForm={showCreateTaskForm}
        showCreateBugForm={showCreateBugForm}
        showImportBugForm={false}
        showEndSprintModal={false}
        showEndSprintActionModal={false}
        endSprintReview=""
        endSprintUnfinishedAction="carryover"
        endSprintUnfinishedTasks={endSprintUnfinishedTasks}
        selectedTask={selectedTask}
        selectedBug={selectedBug}
        selectedBranchTask={null}
        branchNameDraft=""
        baseBranchDraft="main"
        onOpenProject={(_projectId, section = "board") => setProjectSection(section)}
        onOpenOrganization={onExitDemo}
        onCreateTask={createTask}
        onCreateBug={createBug}
        onCreateTaskFormChange={(field, value) =>
          setCreateTaskForm((current) => ({ ...current, [field]: value }))
        }
        onCreateBugFormChange={(field, value) =>
          setCreateBugForm((current) => ({ ...current, [field]: value }))
        }
        onMarkTaskAsResolutionChange={(value) =>
          setCreateTaskForm((current) => ({ ...current, markAsResolution: value }))
        }
        onToggleCreateTaskForm={() => setShowCreateTaskForm((current) => !current)}
        onToggleCreateBugForm={() => setShowCreateBugForm((current) => !current)}
        onOpenCreateTask={openCreateTaskForm}
        onOpenTask={(taskId) => {
          setSelectedBugId(null);
          setSelectedTaskId(taskId);
        }}
        onOpenBug={(bugId) => {
          setSelectedTaskId(null);
          setSelectedBugId(bugId);
        }}
        onUpdateTaskPriority={(taskId, priority) => void updateTask(taskId, { priority })}
        onUpdateTaskStatus={(taskId, status) => void updateTask(taskId, { status })}
        onMoveTaskPlacement={(taskId, placement) => {
          const sprint = project.activeSprint && placement === "sprint" ? project.activeSprint : null;
          void updateTask(taskId, {
            status: project.tasks.find((task) => task.id === taskId)?.status,
          });
          setProject((current) => ({
            ...current,
            tasks: current.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    sprintId: sprint?.id ?? null,
                    sprintName: sprint?.name ?? "",
                    updatedAt: nowIso(),
                  }
                : task,
            ),
          }));
        }}
        onUpdateBugPriority={(bugId, priority) => void updateBug(bugId, { priority })}
        onUpdateBugStatus={(bugId, status) => void updateBug(bugId, { status })}
        onRenameSprint={(name) =>
          setProject((current) => ({
            ...current,
            activeSprint: current.activeSprint
              ? { ...current.activeSprint, name, updatedAt: nowIso() }
              : current.activeSprint,
          }))
        }
        onOpenEndSprint={() => showTemporaryNotice("Ending sprints is disabled in the temporary demo.")}
        onCreateTaskBranch={() => showTemporaryNotice("Git branch creation is disabled in the temporary demo.")}
        onCleanupProductBacklogDoneTasks={(projectId, taskIds) =>
          setHiddenProductTaskIds((current) => ({ ...current, [projectId]: taskIds }))
        }
        onOpenImportBugForm={() => showTemporaryNotice("GitHub imports are disabled in the temporary demo.")}
        onCloseImportBugForm={() => undefined}
        onImportBugFromGitHubIssue={() => undefined}
        onCreateTaskFromBug={openCreateTaskFromBug}
        onAddProjectRepository={() => undefined}
        onRemoveProjectRepository={() => undefined}
        onProjectSettingsChange={(field, value) =>
          setProject((current) => ({
            ...current,
            [field === "useSprints" ? "useSprints" : field]: value,
          }))
        }
        onSaveProjectSettings={() => showTemporaryNotice("Demo project settings updated locally.")}
        onDeleteSelectedProject={() => showTemporaryNotice("Deleting the demo project is disabled.")}
        onConnectGitHub={() => showTemporaryNotice("GitHub is disabled in the temporary demo.")}
        onCloseTaskDetail={() => setSelectedTaskId(null)}
        onCloseBugDetail={() => setSelectedBugId(null)}
        onSaveTaskDetails={updateTask}
        onDeleteTask={deleteTask}
        onSaveBugDetails={updateBug}
        onDeleteBug={deleteBug}
        onAddTaskDetailComment={addTaskComment}
        onToggleTaskCommentReaction={() => undefined}
        onAddBugDetailComment={addBugComment}
        onToggleBugCommentReaction={() => undefined}
        onBaseBranchChange={() => undefined}
        onBranchNameChange={() => undefined}
        onCloseTaskBranchPrompt={() => undefined}
        onSubmitTaskBranch={() => undefined}
        onEndSprintReviewChange={() => undefined}
        onEndSprintActionChange={(_action: EndSprintUnfinishedAction) => undefined}
        onCloseEndSprintFlow={() => undefined}
        onSubmitEndSprintRequest={() => undefined}
        onSubmitEndSprint={() => undefined}
      />

      <ModalFrame
        title="Employer demo"
        description="This sample project is fully temporary and does not require an account."
        isOpen={showIntroPrompt}
        onClose={() => setShowIntroPrompt(false)}
      >
        <Text color="var(--color-text-secondary)">
          Explore the board, create a task from a bug, edit details, and add comments.
          Everything resets when you leave or refresh the demo.
        </Text>
        <Button
          mt="4"
          borderRadius="lg"
          bg="var(--color-accent)"
          color="var(--color-text-inverse)"
          _hover={{ bg: "var(--color-accent-hover)" }}
          onClick={() => setShowIntroPrompt(false)}
        >
          Start exploring
        </Button>
      </ModalFrame>
    </>
  );
}
