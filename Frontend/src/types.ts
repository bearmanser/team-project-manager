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
};

export type AuthResponse = {
    accessToken: string;
    user: User;
};

export type UserResponse = {
    user: User;
};

export type RepoResponse = {
    repos: Repo[];
};

export type GitHubOAuthStartResponse = {
    authorizationUrl: string;
};

export type GitHubConnectResponse = {
    user: User;
    repos: Repo[];
};
