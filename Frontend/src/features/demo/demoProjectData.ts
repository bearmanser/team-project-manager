import type {
  ActivityEntry,
  BugReport,
  BugTaskSummary,
  ProjectDetail,
  ProjectMember,
  ProjectSummary,
  Task,
  User,
} from "../../types";

export const demoUser: User = {
  id: 9001,
  username: "demo-employer",
  email: "demo@example.com",
  githubConnected: false,
  githubUsername: "",
  githubAvatarUrl: "",
};

const productLead: User = {
  id: 9002,
  username: "mina-product",
  email: "mina@example.com",
  githubConnected: true,
  githubUsername: "mina-product",
  githubAvatarUrl: "",
};

const engineer: User = {
  id: 9003,
  username: "sam-engineering",
  email: "sam@example.com",
  githubConnected: true,
  githubUsername: "sam-engineering",
  githubAvatarUrl: "",
};

const qaLead: User = {
  id: 9004,
  username: "riley-qa",
  email: "riley@example.com",
  githubConnected: false,
  githubUsername: "",
  githubAvatarUrl: "",
};

const createdAt = "2026-05-05T08:30:00.000Z";
const updatedAt = "2026-05-05T10:15:00.000Z";

const members: ProjectMember[] = [
  { id: 9101, role: "owner", user: demoUser, addedAt: createdAt },
  { id: 9102, role: "admin", user: productLead, addedAt: createdAt },
  { id: 9103, role: "member", user: engineer, addedAt: createdAt },
  { id: 9104, role: "member", user: qaLead, addedAt: createdAt },
];

const activity: ActivityEntry[] = [
  {
    id: 9301,
    action: "task.created",
    description: 'Created task "Tune employer onboarding narrative" in Sprint 12.',
    actor: productLead,
    taskId: 9401,
    bugReportId: null,
    metadata: {},
    createdAt: "2026-05-05T09:05:00.000Z",
  },
  {
    id: 9302,
    action: "bug.created",
    description: 'Reported bug "Candidate filter state resets after reload".',
    actor: qaLead,
    taskId: null,
    bugReportId: 9501,
    metadata: {},
    createdAt: "2026-05-05T09:18:00.000Z",
  },
  {
    id: 9303,
    action: "task.status_changed",
    description: 'Moved task "Instrument demo conversion events" from To Do to In Progress.',
    actor: engineer,
    taskId: 9402,
    bugReportId: null,
    metadata: {},
    createdAt: "2026-05-05T09:42:00.000Z",
  },
];

function bugSummary(bug: Pick<BugReport, "id" | "title" | "status" | "priority">) {
  return {
    id: bug.id,
    title: bug.title,
    status: bug.status,
    priority: bug.priority,
  };
}

function taskSummary(task: Pick<Task, "id" | "title" | "status" | "priority" | "assignees" | "sprintId" | "sprintName" | "isResolutionTask">): BugTaskSummary {
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

const task9403: Task = {
  id: 9403,
  title: "Fix stale candidate filter persistence",
  description:
    "Keep the selected role, location, and stage filters stable after a refresh so hiring teams do not lose their review context.",
  status: "todo",
  priority: "high",
  creator: qaLead,
  assignees: [engineer],
  sprintId: 9201,
  sprintName: "Sprint 12",
  bugReportId: 9501,
  bugReportTitle: "Candidate filter state resets after reload",
  isResolutionTask: true,
  branchName: "task-9403-filter-persistence",
  branchUrl: "https://github.com/demo/talent-pipeline-demo/tree/task-9403-filter-persistence",
  branchRepositoryId: 9601,
  resolvedBugs: [],
  directGitHubIssues: [],
  inheritedGitHubIssues: [],
  comments: [],
  activity: [],
  createdAt: "2026-05-05T09:20:00.000Z",
  updatedAt,
};

const bug9501: BugReport = {
  id: 9501,
  title: "Candidate filter state resets after reload",
  description:
    "Recruiters lose the selected filters when returning to a candidate list. This slows down high-volume review sessions.",
  status: "investigating",
  priority: "high",
  reporter: qaLead,
  resolutionTaskId: task9403.id,
  resolutionTaskTitle: task9403.title,
  linkedGitHubIssues: [
    {
      id: 9701,
      repositoryFullName: "demo/talent-pipeline-demo",
      issueNumber: 128,
      title: "Persist candidate filters across reloads",
      htmlUrl: "https://github.com/demo/talent-pipeline-demo/issues/128",
      state: "open",
      createdAt,
    },
  ],
  tasks: [taskSummary(task9403)],
  comments: [],
  activity: [],
  closedAt: null,
  createdAt: "2026-05-05T09:18:00.000Z",
  updatedAt,
};

task9403.resolvedBugs = [bugSummary(bug9501)];

export function buildDemoProject(): ProjectDetail {
  const tasks: Task[] = [
    {
      id: 9401,
      title: "Tune employer onboarding narrative",
      description:
        "Tighten the first-run copy so a hiring manager understands project setup, tasks, bugs, and ownership in under two minutes.",
      status: "in_review",
      priority: "medium",
      creator: productLead,
      assignees: [productLead, demoUser],
      sprintId: 9201,
      sprintName: "Sprint 12",
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
      createdAt: "2026-05-05T09:05:00.000Z",
      updatedAt,
    },
    {
      id: 9402,
      title: "Instrument demo conversion events",
      description:
        "Track clicks from the marketing page into the no-login demo and measure whether visitors create a task or open a bug.",
      status: "in_progress",
      priority: "high",
      creator: engineer,
      assignees: [engineer],
      sprintId: 9201,
      sprintName: "Sprint 12",
      bugReportId: null,
      bugReportTitle: "",
      isResolutionTask: false,
      branchName: "task-9402-demo-events",
      branchUrl: "https://github.com/demo/talent-pipeline-demo/tree/task-9402-demo-events",
      branchRepositoryId: 9601,
      resolvedBugs: [],
      directGitHubIssues: [],
      inheritedGitHubIssues: [],
      comments: [],
      activity: [],
      createdAt: "2026-05-05T09:10:00.000Z",
      updatedAt,
    },
    task9403,
    {
      id: 9404,
      title: "Publish weekly hiring progress summary",
      description:
        "Create a short end-of-sprint summary for stakeholders: completed improvements, active risks, and next hiring workflow priorities.",
      status: "done",
      priority: "low",
      creator: demoUser,
      assignees: [demoUser],
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
      createdAt: "2026-05-04T14:25:00.000Z",
      updatedAt,
    },
  ];

  return {
    id: 9801,
    organizationId: 9800,
    organizationName: "Demo Hiring Team",
    name: "Talent Pipeline Launch",
    description:
      "A sample workspace for employers evaluating how Team Project Manager handles hiring platform delivery work.",
    useSprints: true,
    activeSprint: {
      id: 9201,
      number: 12,
      name: "Sprint 12",
      status: "active",
      reviewText: "",
      summary: {},
      startedAt: "2026-05-01T09:00:00.000Z",
      endedAt: null,
      createdAt: "2026-05-01T09:00:00.000Z",
      updatedAt,
    },
    sprintHistory: [
      {
        id: 9200,
        number: 11,
        name: "Sprint 11",
        status: "completed",
        reviewText:
          "Completed candidate note sharing and tightened the bug triage path before inviting hiring managers into the pilot.",
        summary: {
          totalCount: 5,
          completedCount: 4,
          carryoverCount: 1,
          returnedToProductCount: 0,
          unfinishedAction: "carryover",
          completedTasks: [
            { id: 9398, title: "Add candidate note sharing", status: "done", priority: "high" },
            { id: 9399, title: "Refine interview stage labels", status: "done", priority: "medium" },
          ],
          carryoverTasks: [
            { id: 9403, title: "Fix stale candidate filter persistence", status: "todo", priority: "high" },
          ],
          returnedToProductTasks: [],
        },
        startedAt: "2026-04-17T09:00:00.000Z",
        endedAt: "2026-04-30T16:30:00.000Z",
        createdAt: "2026-04-17T09:00:00.000Z",
        updatedAt: "2026-04-30T16:30:00.000Z",
      },
    ],
    ownerId: demoUser.id,
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
    repositories: [
      {
        id: 9601,
        githubRepoId: "demo-9601",
        name: "talent-pipeline-demo",
        fullName: "demo/talent-pipeline-demo",
        htmlUrl: "https://github.com/demo/talent-pipeline-demo",
        defaultBranch: "main",
        visibility: "private",
        owner: "demo",
      },
    ],
    members,
    boardColumns: [
      { id: "todo", label: "To Do" },
      { id: "in_progress", label: "In Progress" },
      { id: "in_review", label: "In Review" },
      { id: "done", label: "Done" },
    ],
    taskStatusLabels: {
      todo: "To Do",
      in_progress: "In Progress",
      in_review: "In Review",
      done: "Done",
    },
    bugStatusLabels: {
      open: "Open",
      investigating: "Investigating",
      monitoring: "Monitoring",
      closed: "Closed",
    },
    tasks,
    bugReports: [bug9501],
    recentActivity: activity,
    createdAt,
    updatedAt,
  };
}

export function buildDemoProjectSummary(project: ProjectDetail): ProjectSummary {
  return {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    description: project.description,
    role: project.role,
    memberCount: project.members.length,
    repoCount: project.repositories.length,
    openBugCount: project.bugReports.filter((bug) => bug.status !== "closed").length,
    taskCounts: {
      todo: project.tasks.filter((task) => task.status === "todo").length,
      in_progress: project.tasks.filter((task) => task.status === "in_progress").length,
      in_review: project.tasks.filter((task) => task.status === "in_review").length,
      done: project.tasks.filter((task) => task.status === "done").length,
    },
    updatedAt: project.updatedAt,
  };
}
