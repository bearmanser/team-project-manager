export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type BugStatus = "open" | "investigating" | "monitoring" | "closed";
export type PriorityLevel = "low" | "medium" | "high" | "critical";
export type BacklogPlacement = "sprint" | "product";
export type EndSprintUnfinishedAction = "done" | "carryover" | "product";
export type ProjectRole = "owner" | "admin" | "member" | "viewer";
export type OrganizationRole = "owner" | "member";

export type User = {
    id: number;
    username: string;
    email: string;
    githubConnected: boolean;
    githubUsername: string;
    githubAvatarUrl: string;
};

export type Repo = {
    id: number;
    name: string;
    fullName: string;
    description: string;
    htmlUrl: string;
    language: string;
    stargazersCount: number;
    visibility: string;
    updatedAt: string;
    owner: string;
    defaultBranch: string;
};

export type Notification = {
    id: number;
    kind: string;
    message: string;
    isRead: boolean;
    actor: User | null;
    projectId: number | null;
    taskId: number | null;
    bugReportId: number | null;
    createdAt: string;
};

export type OrganizationSummary = {
    id: number;
    name: string;
    displayName: string;
    description: string;
    isPersonal: boolean;
    role: OrganizationRole;
    memberCount: number;
    projectCount: number;
    repoCount: number;
    openBugCount: number;
    updatedAt: string;
};

export type ProjectSummary = {
    id: number;
    organizationId: number | null;
    name: string;
    description: string;
    role: ProjectRole;
    memberCount: number;
    repoCount: number;
    openBugCount: number;
    taskCounts: Record<TaskStatus, number>;
    updatedAt: string;
};

export type ProjectPermissions = {
    canCreateTasks: boolean;
    canCreateBugReports: boolean;
    canMoveTasks: boolean;
    canAssignTasks: boolean;
    canComment: boolean;
    canEditTasks: boolean;
    canEditBugs: boolean;
    canManageUsers: boolean;
    canManageProject: boolean;
    canManageRepos: boolean;
    canDeleteProject: boolean;
    isReadOnly: boolean;
};

export type ProjectRepository = {
    id: number;
    githubRepoId: string;
    name: string;
    fullName: string;
    htmlUrl: string;
    defaultBranch: string;
    visibility: string;
    owner: string;
};

export type ProjectMember = {
    id: number;
    role: ProjectRole;
    user: User;
    addedAt: string;
};

export type IssueLink = {
    id: number;
    repositoryFullName: string;
    issueNumber: number;
    title: string;
    htmlUrl: string;
    state: string;
    createdAt: string;
};

export type GitHubIssueCandidate = {
    repositoryId: number;
    repositoryFullName: string;
    issueNumber: number;
    title: string;
    htmlUrl: string;
    state: string;
    authorLogin: string;
    labels: string[];
    bodyPreview: string;
    updatedAt: string;
};

export type CommentReactionSummary = {
    emoji: string;
    count: number;
    reactedByUser: boolean;
};

export type CommentEntry = {
    id: number;
    body: string;
    author: User;
    anchorType: string;
    anchorId: string;
    anchorLabel: string;
    reactions: CommentReactionSummary[];
    createdAt: string;
    updatedAt: string;
};
export type ActivityEntry = {
    id: number;
    action: string;
    description: string;
    actor: User | null;
    taskId: number | null;
    bugReportId: number | null;
    metadata: Record<string, unknown>;
    createdAt: string;
};

export type SprintTaskSnapshot = {
    id: number;
    title: string;
    status: TaskStatus;
    priority: PriorityLevel;
};

export type SprintSummary = {
    totalCount?: number;
    completedCount?: number;
    carryoverCount?: number;
    returnedToProductCount?: number;
    completedTasks?: SprintTaskSnapshot[];
    carryoverTasks?: SprintTaskSnapshot[];
    returnedToProductTasks?: SprintTaskSnapshot[];
    unfinishedAction?: EndSprintUnfinishedAction;
};

export type Sprint = {
    id: number;
    number: number;
    name: string;
    status: "active" | "completed";
    reviewText: string;
    summary: SprintSummary;
    startedAt: string;
    endedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type Task = {
    id: number;
    title: string;
    description: string;
    status: TaskStatus;
    priority: PriorityLevel;
    creator: User;
    assignees: User[];
    sprintId: number | null;
    sprintName: string;
    bugReportId: number | null;
    bugReportTitle: string;
    isResolutionTask: boolean;
    branchName: string;
    branchUrl: string;
    branchRepositoryId: number | null;
    resolvedBugs: ResolvedBugSummary[];
    directGitHubIssues: IssueLink[];
    inheritedGitHubIssues: IssueLink[];
    comments: CommentEntry[];
    activity: ActivityEntry[];
    createdAt: string;
    updatedAt: string;
};

export type ResolvedBugSummary = {
    id: number;
    title: string;
    status: BugStatus;
    priority: PriorityLevel;
};

export type BugTaskSummary = {
    id: number;
    title: string;
    status: TaskStatus;
    priority: PriorityLevel;
    assigneeCount: number;
    sprintId: number | null;
    sprintName: string;
    isResolutionTask: boolean;
};

export type BugReport = {
    id: number;
    title: string;
    description: string;
    status: BugStatus;
    priority: PriorityLevel;
    reporter: User;
    resolutionTaskId: number | null;
    resolutionTaskTitle: string;
    linkedGitHubIssues: IssueLink[];
    tasks: BugTaskSummary[];
    comments: CommentEntry[];
    activity: ActivityEntry[];
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type BoardColumn = {
    id: TaskStatus;
    label: string;
};

export type ProjectDetail = {
    id: number;
    organizationId: number | null;
    organizationName: string;
    name: string;
    description: string;
    useSprints: boolean;
    activeSprint: Sprint | null;
    sprintHistory: Sprint[];
    ownerId: number;
    role: ProjectRole;
    permissions: ProjectPermissions;
    repositories: ProjectRepository[];
    members: ProjectMember[];
    boardColumns: BoardColumn[];
    taskStatusLabels: Record<TaskStatus, string>;
    bugStatusLabels: Record<BugStatus, string>;
    tasks: Task[];
    bugReports: BugReport[];
    recentActivity: ActivityEntry[];
    createdAt: string;
    updatedAt: string;
};

export type AuthResponse = {
    accessToken: string;
    user: User;
};

export type UserResponse = {
    user: User;
};

export type GitHubOAuthStartResponse = {
    authorizationUrl: string;
};

export type GitHubConnectResponse = {
    user: User;
    repos: Repo[];
};

export type WorkspaceResponse = {
    user: User;
    organizations: OrganizationSummary[];
    projects: ProjectSummary[];
    notifications: Notification[];
    availableRepos: Repo[];
    githubRepoError: string | null;
};

export type ProjectResponse = {
    project: ProjectDetail;
};

export type ProjectGitHubIssuesResponse = {
    issues: GitHubIssueCandidate[];
};

export type OrganizationResponse = {
    organization: OrganizationSummary;
};

export type DeleteOrganizationResponse = {
    success: boolean;
    organizationId: number;
};

export type NotificationResponse = {
    notification: Notification;
};

export type DeleteProjectResponse = {
    success: boolean;
    projectId: number;
};



