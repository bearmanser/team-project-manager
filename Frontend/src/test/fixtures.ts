import type {
  OrganizationSummary,
  ProjectDetail,
  ProjectSummary,
  Repo,
  Sprint,
  Task,
  User,
} from "../types";

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: "alex",
    email: "alex@example.com",
    githubConnected: true,
    githubUsername: "alexhub",
    githubAvatarUrl: "https://example.com/avatar.png",
    ...overrides,
  };
}

export function buildRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 101,
    name: "team-project-manager",
    fullName: "acme/team-project-manager",
    description: "Primary delivery repo",
    htmlUrl: "https://github.com/acme/team-project-manager",
    language: "TypeScript",
    stargazersCount: 12,
    visibility: "private",
    updatedAt: "2026-03-28T10:00:00Z",
    owner: "acme",
    defaultBranch: "main",
    ...overrides,
  };
}

export function buildOrganizationSummary(
  overrides: Partial<OrganizationSummary> = {},
): OrganizationSummary {
  return {
    id: 11,
    name: "acme",
    displayName: "Acme",
    description: "Acme product group",
    isPersonal: false,
    role: "owner",
    memberCount: 4,
    projectCount: 2,
    repoCount: 1,
    openBugCount: 3,
    updatedAt: "2026-03-28T10:00:00Z",
    ...overrides,
  };
}

export function buildProjectSummary(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: 21,
    organizationId: 11,
    name: "Client Portal",
    description: "Customer-facing workspace",
    role: "owner",
    memberCount: 4,
    repoCount: 1,
    openBugCount: 2,
    taskCounts: {
      todo: 2,
      in_progress: 1,
      in_review: 0,
      done: 1,
    },
    updatedAt: "2026-03-28T10:00:00Z",
    ...overrides,
  };
}

export function buildSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 31,
    number: 7,
    name: "Sprint 7",
    status: "active",
    reviewText: "",
    summary: {},
    startedAt: "2026-03-20T09:00:00Z",
    endedAt: null,
    createdAt: "2026-03-20T09:00:00Z",
    updatedAt: "2026-03-28T10:00:00Z",
    ...overrides,
  };
}

export function buildTask(overrides: Partial<Task> = {}): Task {
  const creator = overrides.creator ?? buildUser();

  return {
    id: 41,
    title: "Ship dashboard refresh",
    description: "Update the dashboard cards",
    status: "todo",
    priority: "high",
    creator,
    assignees: [],
    sprintId: null,
    sprintName: "",
    bugReportId: null,
    bugReportTitle: "",
    isResolutionTask: false,
    branchName: "",
    branchUrl: "",
    branchRepositoryId: null,
    resolvedBugs: [],
    directGitHubIssues: [],
    inheritedGitHubIssues: [],
    comments: [],
    activity: [],
    createdAt: "2026-03-21T09:00:00Z",
    updatedAt: "2026-03-28T10:00:00Z",
    ...overrides,
  };
}

export function buildProjectDetail(
  overrides: Partial<ProjectDetail> = {},
): ProjectDetail {
  const activeSprint = overrides.activeSprint ?? buildSprint();

  return {
    id: 21,
    organizationId: 11,
    organizationName: "Acme",
    name: "Client Portal",
    description: "Customer-facing workspace",
    useSprints: true,
    activeSprint,
    sprintHistory: activeSprint ? [activeSprint] : [],
    ownerId: 1,
    role: "owner",
    permissions: {
      canCreateTasks: true,
      canCreateBugReports: true,
      canMoveTasks: true,
      canAssignTasks: true,
      canComment: true,
      canEditTasks: true,
      canEditBugs: true,
      canManageUsers: true,
      canManageProject: true,
      canManageRepos: true,
      canDeleteProject: true,
      isReadOnly: false,
    },
    repositories: [],
    members: [],
    boardColumns: [
      { id: "todo", label: "To do" },
      { id: "in_progress", label: "In progress" },
      { id: "in_review", label: "In review" },
      { id: "done", label: "Done" },
    ],
    taskStatusLabels: {
      todo: "To do",
      in_progress: "In progress",
      in_review: "In review",
      done: "Done",
    },
    bugStatusLabels: {
      open: "Open",
      investigating: "Investigating",
      monitoring: "Monitoring",
      closed: "Closed",
    },
    tasks: [],
    bugReports: [],
    recentActivity: [],
    createdAt: "2026-03-20T09:00:00Z",
    updatedAt: "2026-03-28T10:00:00Z",
    ...overrides,
  };
}
