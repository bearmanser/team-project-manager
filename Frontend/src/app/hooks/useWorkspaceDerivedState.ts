import { useMemo } from "react";

import type {
  BugReport,
  OrganizationSummary,
  ProjectDetail,
  Task,
  WorkspaceResponse,
} from "../../types";
import type { NavItem, OrganizationSection, ProjectSection } from "../../view-models";

type UseWorkspaceDerivedStateParams = {
  branchTaskId: number | null;
  selectedBugId: number | null;
  selectedOrganizationId: number | null;
  selectedProject: ProjectDetail | null;
  selectedTaskId: number | null;
  workspace: WorkspaceResponse | null;
};

export function useWorkspaceDerivedState({
  branchTaskId,
  selectedBugId,
  selectedOrganizationId,
  selectedProject,
  selectedTaskId,
  workspace,
}: UseWorkspaceDerivedStateParams) {
  const user = workspace?.user ?? null;
  const githubRepoErrorMessage =
    workspace?.githubRepoError === "Bad credentials" &&
    workspace?.user.githubConnected
      ? "GitHub connected, but repositories are still syncing. Please wait a moment and try again."
      : workspace?.githubRepoError ?? null;

  const currentOrganization = useMemo<OrganizationSummary | null>(() => {
    if (!workspace || selectedOrganizationId === null) {
      return null;
    }

    return (
      workspace.organizations.find(
        (organization) => organization.id === selectedOrganizationId,
      ) ?? null
    );
  }, [selectedOrganizationId, workspace]);

  const currentOrganizationProjects = useMemo(
    () =>
      workspace?.projects.filter(
        (project) => project.organizationId === currentOrganization?.id,
      ) ?? [],
    [currentOrganization?.id, workspace],
  );

  const endSprintUnfinishedTasks = useMemo(() => {
    if (!selectedProject?.activeSprint) {
      return [];
    }

    return selectedProject.tasks.filter(
      (task) =>
        task.sprintId === selectedProject.activeSprint?.id &&
        task.status !== "done",
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

  return {
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
  };
}
