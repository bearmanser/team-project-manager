import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
    ApiError,
    completeGitHubOauth,
    getCurrentUser,
    getRepos,
    login,
    signup,
    startGitHubOauth,
} from "./api";
import type { Repo, User } from "./types";

const TOKEN_STORAGE_KEY = "team-project-manager.jwt";

const initialSignupForm = {
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
};

const initialLoginForm = {
    identifier: "",
    password: "",
};

function formatUpdatedDate(value: string): string {
    if (!value) {
        return "Recently updated";
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
    }).format(new Date(value));
}

function getFriendlyError(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong. Please try again.";
}

function App() {
    const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
    const [signupForm, setSignupForm] = useState(initialSignupForm);
    const [loginForm, setLoginForm] = useState(initialLoginForm);
    const [token, setToken] = useState<string | null>(() =>
        window.localStorage.getItem(TOKEN_STORAGE_KEY),
    );
    const [user, setUser] = useState<User | null>(null);
    const [repos, setRepos] = useState<Repo[]>([]);
    const [busyLabel, setBusyLabel] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isBooting, setIsBooting] = useState(true);

    const isWorking = busyLabel !== null;

    function storeToken(nextToken: string | null): void {
        if (nextToken) {
            window.localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
        } else {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }

        setToken(nextToken);
    }

    function clearSession(): void {
        storeToken(null);
        setUser(null);
        setRepos([]);
    }

    async function hydrateSession(sessionToken: string): Promise<void> {
        const meResponse = await getCurrentUser(sessionToken);
        setUser(meResponse.user);

        if (meResponse.user.githubConnected) {
            const repoResponse = await getRepos(sessionToken);
            setRepos(repoResponse.repos);
        } else {
            setRepos([]);
        }

        storeToken(sessionToken);
    }

    useEffect(() => {
        async function bootstrap(): Promise<void> {
            const sessionToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
            const isGitHubCallback = window.location.pathname === "/oauth/github/callback";
            const params = new URLSearchParams(window.location.search);

            if (isGitHubCallback) {
                const providerError = params.get("error_description") ?? params.get("error");
                if (providerError) {
                    setError(providerError);
                    window.history.replaceState({}, document.title, "/");
                    setIsBooting(false);
                    return;
                }

                const code = params.get("code");
                const state = params.get("state");
                if (!sessionToken || !code || !state) {
                    clearSession();
                    setError("Finish signup or log in before connecting GitHub.");
                    window.history.replaceState({}, document.title, "/");
                    setIsBooting(false);
                    return;
                }

                setBusyLabel("Connecting GitHub");
                try {
                    const response = await completeGitHubOauth(sessionToken, { code, state });
                    setUser(response.user);
                    setRepos(response.repos);
                    setNotice("GitHub connected. Your repositories are ready.");
                } catch (reason) {
                    setError(getFriendlyError(reason));
                } finally {
                    window.history.replaceState({}, document.title, "/");
                    setBusyLabel(null);
                    setIsBooting(false);
                }
                return;
            }

            if (!sessionToken) {
                setIsBooting(false);
                return;
            }

            setBusyLabel("Restoring your workspace");
            try {
                await hydrateSession(sessionToken);
            } catch (reason) {
                clearSession();
                setError(getFriendlyError(reason));
            } finally {
                setBusyLabel(null);
                setIsBooting(false);
            }
        }

        void bootstrap();
    }, []);

    async function beginGitHubConnection(sessionToken: string): Promise<void> {
        const response = await startGitHubOauth(sessionToken);
        window.location.assign(response.authorizationUrl);
    }

    async function submitSignup(connectGitHub: boolean): Promise<void> {
        if (signupForm.password !== signupForm.confirmPassword) {
            setError("Passwords must match before creating the account.");
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel(connectGitHub ? "Creating account and preparing GitHub" : "Creating account");

        try {
            const response = await signup({
                username: signupForm.username.trim(),
                email: signupForm.email.trim(),
                password: signupForm.password,
            });

            storeToken(response.accessToken);
            setUser(response.user);
            setRepos([]);
            setSignupForm(initialSignupForm);
            setLoginForm({ identifier: response.user.email, password: "" });

            if (connectGitHub) {
                setBusyLabel("Opening GitHub");
                await beginGitHubConnection(response.accessToken);
                return;
            }

            setNotice("Account created. Connect GitHub whenever you are ready.");
        } catch (reason) {
            clearSession();
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    async function submitLogin(): Promise<void> {
        setError(null);
        setNotice(null);
        setBusyLabel("Signing in");

        try {
            const response = await login({
                identifier: loginForm.identifier.trim(),
                password: loginForm.password,
            });

            await hydrateSession(response.accessToken);
            setLoginForm(initialLoginForm);
            setNotice("Welcome back.");
        } catch (reason) {
            clearSession();
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    async function refreshRepos(): Promise<void> {
        if (!token) {
            return;
        }

        setError(null);
        setNotice(null);
        setBusyLabel(user?.githubConnected ? "Refreshing repositories" : "Opening GitHub");

        try {
            if (!user?.githubConnected) {
                await beginGitHubConnection(token);
                return;
            }

            const repoResponse = await getRepos(token);
            setRepos(repoResponse.repos);
            setNotice("Repository list refreshed.");
        } catch (reason) {
            setError(getFriendlyError(reason));
        } finally {
            setBusyLabel(null);
        }
    }

    function handleSignupSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        void submitSignup(false);
    }

    function handleLoginSubmit(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        void submitLogin();
    }

    function handleLogout(): void {
        clearSession();
        setAuthMode("login");
        setNotice("You have been signed out.");
        setError(null);
    }

    if (isBooting) {
        return (
            <main className="loading-shell">
                <div className="loading-card">
                    <span className="eyebrow">Team Project Manager</span>
                    <h1>Preparing your workspace</h1>
                    <p>{busyLabel ?? "Loading authentication state..."}</p>
                </div>
            </main>
        );
    }

    if (!user) {
        return (
            <main className="auth-shell">
                <section className="hero-panel">
                    <span className="eyebrow">Launch-ready starter</span>
                    <h1>JWT auth, GitHub linking, and repo visibility in one place.</h1>
                    <p>
                        Create an account, connect GitHub during signup if you want to, and land in a
                        simple dashboard that lists repositories for the authenticated user.
                    </p>
                    <div className="feature-list">
                        <article>
                            <strong>Secure sign-in</strong>
                            <span>Django-backed signup and login with JWT-based API access.</span>
                        </article>
                        <article>
                            <strong>GitHub OAuth</strong>
                            <span>Connect right after signup or from the dashboard with one click.</span>
                        </article>
                        <article>
                            <strong>Repo dashboard</strong>
                            <span>Pull and display the user&apos;s repositories with live metadata.</span>
                        </article>
                    </div>
                </section>

                <section className="auth-card">
                    <div className="auth-card-header">
                        <span className="eyebrow">Access</span>
                        <h2>{authMode === "signup" ? "Create your account" : "Welcome back"}</h2>
                        <p>
                            {authMode === "signup"
                                ? "Start with email and password, then connect GitHub immediately if you want the full flow."
                                : "Sign in with your username or email to continue."}
                        </p>
                    </div>

                    <div className="mode-toggle" role="tablist" aria-label="Authentication mode">
                        <button
                            type="button"
                            className={authMode === "signup" ? "mode-toggle-button active" : "mode-toggle-button"}
                            onClick={() => setAuthMode("signup")}
                        >
                            Sign up
                        </button>
                        <button
                            type="button"
                            className={authMode === "login" ? "mode-toggle-button active" : "mode-toggle-button"}
                            onClick={() => setAuthMode("login")}
                        >
                            Log in
                        </button>
                    </div>

                    {error ? <div className="message error">{error}</div> : null}
                    {notice ? <div className="message success">{notice}</div> : null}

                    {authMode === "signup" ? (
                        <form className="auth-form" onSubmit={handleSignupSubmit}>
                            <label>
                                <span>Username</span>
                                <input
                                    value={signupForm.username}
                                    onChange={(event) =>
                                        setSignupForm((current) => ({
                                            ...current,
                                            username: event.target.value,
                                        }))
                                    }
                                    placeholder="magnus"
                                    autoComplete="username"
                                    required
                                />
                            </label>
                            <label>
                                <span>Email</span>
                                <input
                                    type="email"
                                    value={signupForm.email}
                                    onChange={(event) =>
                                        setSignupForm((current) => ({
                                            ...current,
                                            email: event.target.value,
                                        }))
                                    }
                                    placeholder="magnus@example.com"
                                    autoComplete="email"
                                    required
                                />
                            </label>
                            <label>
                                <span>Password</span>
                                <input
                                    type="password"
                                    value={signupForm.password}
                                    onChange={(event) =>
                                        setSignupForm((current) => ({
                                            ...current,
                                            password: event.target.value,
                                        }))
                                    }
                                    placeholder="Choose a strong password"
                                    autoComplete="new-password"
                                    required
                                />
                            </label>
                            <label>
                                <span>Confirm password</span>
                                <input
                                    type="password"
                                    value={signupForm.confirmPassword}
                                    onChange={(event) =>
                                        setSignupForm((current) => ({
                                            ...current,
                                            confirmPassword: event.target.value,
                                        }))
                                    }
                                    placeholder="Repeat your password"
                                    autoComplete="new-password"
                                    required
                                />
                            </label>
                            <div className="button-row">
                                <button type="submit" className="button-primary" disabled={isWorking}>
                                    {isWorking ? busyLabel : "Create account"}
                                </button>
                                <button
                                    type="button"
                                    className="button-secondary"
                                    disabled={isWorking}
                                    onClick={() => void submitSignup(true)}
                                >
                                    Create and connect GitHub
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form className="auth-form" onSubmit={handleLoginSubmit}>
                            <label>
                                <span>Username or email</span>
                                <input
                                    value={loginForm.identifier}
                                    onChange={(event) =>
                                        setLoginForm((current) => ({
                                            ...current,
                                            identifier: event.target.value,
                                        }))
                                    }
                                    placeholder="magnus or magnus@example.com"
                                    autoComplete="username"
                                    required
                                />
                            </label>
                            <label>
                                <span>Password</span>
                                <input
                                    type="password"
                                    value={loginForm.password}
                                    onChange={(event) =>
                                        setLoginForm((current) => ({
                                            ...current,
                                            password: event.target.value,
                                        }))
                                    }
                                    placeholder="Your password"
                                    autoComplete="current-password"
                                    required
                                />
                            </label>
                            <button type="submit" className="button-primary" disabled={isWorking}>
                                {isWorking ? busyLabel : "Log in"}
                            </button>
                        </form>
                    )}
                </section>
            </main>
        );
    }

    const avatar = user.githubAvatarUrl || "";
    const repoCountLabel = `${repos.length} repo${repos.length === 1 ? "" : "s"}`;

    return (
        <main className="workspace-shell">
            <header className="workspace-header">
                <div className="profile-block">
                    {avatar ? (
                        <img className="avatar" src={avatar} alt={`${user.username} GitHub avatar`} />
                    ) : (
                        <div className="avatar avatar-fallback">{user.username.slice(0, 1).toUpperCase()}</div>
                    )}
                    <div>
                        <span className="eyebrow">Signed in</span>
                        <h1>{user.username}</h1>
                        <p>
                            {user.email}
                            {user.githubConnected && user.githubUsername
                                ? ` · GitHub @${user.githubUsername}`
                                : " · GitHub not connected yet"}
                        </p>
                    </div>
                </div>

                <div className="button-row compact">
                    <button
                        type="button"
                        className="button-secondary"
                        onClick={() => void refreshRepos()}
                        disabled={isWorking}
                    >
                        {isWorking ? busyLabel : user.githubConnected ? "Refresh repos" : "Connect GitHub"}
                    </button>
                    <button type="button" className="button-ghost" onClick={handleLogout}>
                        Log out
                    </button>
                </div>
            </header>

            {error ? <div className="message error">{error}</div> : null}
            {notice ? <div className="message success">{notice}</div> : null}

            <section className="summary-grid">
                <article className="summary-card accent">
                    <span className="eyebrow">Authentication</span>
                    <h2>JWT-secured session</h2>
                    <p>
                        The frontend stores the issued access token locally and uses it to authenticate
                        all protected backend requests.
                    </p>
                </article>
                <article className="summary-card">
                    <span className="eyebrow">GitHub status</span>
                    <h2>{user.githubConnected ? "Connected" : "Waiting for link"}</h2>
                    <p>
                        {user.githubConnected
                            ? `Repositories are being fetched from @${user.githubUsername}.`
                            : "Connect GitHub to fetch the authenticated user&apos;s repositories."}
                    </p>
                </article>
                <article className="summary-card">
                    <span className="eyebrow">Repositories</span>
                    <h2>{repoCountLabel}</h2>
                    <p>
                        {user.githubConnected
                            ? "Refresh anytime to pull the latest repository metadata from GitHub."
                            : "No repositories are shown until GitHub is connected."}
                    </p>
                </article>
            </section>

            <section className="repo-section">
                <div className="section-header">
                    <div>
                        <span className="eyebrow">Repository list</span>
                        <h2>Your GitHub repositories</h2>
                    </div>
                </div>

                {!user.githubConnected ? (
                    <div className="empty-state">
                        <h3>Connect GitHub to unlock the repo view</h3>
                        <p>
                            Use the connect button above to complete the OAuth flow and populate this
                            dashboard with repository data.
                        </p>
                    </div>
                ) : repos.length === 0 ? (
                    <div className="empty-state">
                        <h3>No repositories found</h3>
                        <p>
                            The account is connected, but GitHub did not return any repositories for this
                            user.
                        </p>
                    </div>
                ) : (
                    <div className="repo-grid">
                        {repos.map((repo) => (
                            <article key={repo.id} className="repo-card">
                                <div className="repo-card-top">
                                    <span className="repo-visibility">{repo.visibility}</span>
                                    <span className="repo-language">{repo.language}</span>
                                </div>
                                <div>
                                    <h3>{repo.name}</h3>
                                    <p>{repo.description || "No description provided for this repository."}</p>
                                </div>
                                <div className="repo-meta">
                                    <span>{repo.stargazersCount} stars</span>
                                    <span>Updated {formatUpdatedDate(repo.updatedAt)}</span>
                                </div>
                                <a href={repo.htmlUrl} target="_blank" rel="noreferrer">
                                    Open on GitHub
                                </a>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default App;

