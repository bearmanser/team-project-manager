export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type BugStatus = "open" | "investigating" | "monitoring" | "closed";
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
    description: string;
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

export type CommentEntry = {
    id: number;
    body: string;
    author: User;
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

export type Task = {
    id: number;
    title: string;
    description: string;
    status: TaskStatus;
    creator: User;
    assignees: User[];
    bugReportId: number | null;
    bugReportTitle: string;
    isResolutionTask: boolean;
    branchName: string;
    branchUrl: string;
    branchRepositoryId: number | null;
    directGitHubIssues: IssueLink[];
    inheritedGitHubIssues: IssueLink[];
    comments: CommentEntry[];
    activity: ActivityEntry[];
    createdAt: string;
    updatedAt: string;
};

export type BugTaskSummary = {
    id: number;
    title: string;
    status: TaskStatus;
    assigneeCount: number;
    isResolutionTask: boolean;
};

export type BugReport = {
    id: number;
    title: string;
    description: string;
    status: BugStatus;
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

export type OrganizationResponse = {
    organization: OrganizationSummary;
};

export type NotificationResponse = {
    notification: Notification;
};

export type DeleteProjectResponse = {
    success: boolean;
    projectId: number;
};
