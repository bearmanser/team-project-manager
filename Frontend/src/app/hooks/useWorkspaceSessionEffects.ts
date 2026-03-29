import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import { AUTH_TOKEN_INVALID_EVENT, ApiError, getWorkspace } from "../../api";
import type { User, WorkspaceResponse } from "../../types";
import { MARKETING_PATH, ORGANIZATIONS_PATH } from "../constants";
import { getFriendlyError } from "../errors";
import { parseRoute } from "../routing";

type UseWorkspaceSessionEffectsParams = {
  clearSession: () => void;
  completeGitHubOauthOnce: (
    code: string,
    state: string,
  ) => Promise<{
    user: User;
    repos: WorkspaceResponse["availableRepos"];
    githubRepoError: string | null;
  }>;
  navigateToPath: (path: string, replace?: boolean) => void;
  setBusyLabel: Dispatch<SetStateAction<string | null>>;
  setCurrentPath: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsBooting: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setToken: Dispatch<SetStateAction<string | null>>;
  setWorkspace: Dispatch<SetStateAction<WorkspaceResponse | null>>;
  syncFromPath: (
    sessionToken: string,
    options?: { quiet?: boolean },
  ) => Promise<void>;
  token: string | null;
};

const AUTHENTICATED_SESSION_MARKER = "authenticated-session";

export function useWorkspaceSessionEffects({
  clearSession,
  completeGitHubOauthOnce,
  navigateToPath,
  setBusyLabel,
  setCurrentPath,
  setError,
  setIsBooting,
  setNotice,
  setToken,
  setWorkspace,
  syncFromPath,
  token,
}: UseWorkspaceSessionEffectsParams) {
  const syncFromPathRef = useRef(syncFromPath);

  useEffect(() => {
    syncFromPathRef.current = syncFromPath;
  }, [syncFromPath]);

  useEffect(() => {
    function handleAuthTokenInvalid(event: Event): void {
      if (!token) {
        return;
      }

      const message =
        event instanceof CustomEvent &&
        typeof event.detail?.message === "string"
          ? event.detail.message
          : "Your session has expired. Please sign in again.";

      clearSession();
      setError(message);
    }

    window.addEventListener(AUTH_TOKEN_INVALID_EVENT, handleAuthTokenInvalid);
    return () =>
      window.removeEventListener(
        AUTH_TOKEN_INVALID_EVENT,
        handleAuthTokenInvalid,
      );
  }, [clearSession, setError, token]);

  useEffect(() => {
    async function bootstrapWorkspace(): Promise<void> {
      const route = parseRoute(window.location.pathname);
      const params = new URLSearchParams(window.location.search);
      const isPublicRoute =
        route.kind === "marketing" || route.kind === "signup";

      if (route.kind === "githubCallback") {
        const providerError =
          params.get("error_description") ?? params.get("error");
        if (providerError) {
          setError(providerError);
          navigateToPath(ORGANIZATIONS_PATH, true);
          setIsBooting(false);
          return;
        }

        const code = params.get("code");
        const state = params.get("state");

        if (!code || !state) {
          clearSession();
          setError("Finish signing in before connecting GitHub.");
          navigateToPath(MARKETING_PATH, true);
          setIsBooting(false);
          return;
        }

        setBusyLabel("Connecting GitHub");
        try {
          const response = await completeGitHubOauthOnce(code, state);
          setToken(AUTHENTICATED_SESSION_MARKER);
          setWorkspace((current) =>
            current
              ? {
                  ...current,
                  user: response.user,
                  availableRepos: response.repos,
                  githubRepoError: response.githubRepoError,
                }
              : current,
          );
          navigateToPath(ORGANIZATIONS_PATH, true);
          try {
            await syncFromPathRef.current(AUTHENTICATED_SESSION_MARKER, {
              quiet: true,
            });
          } catch (reason) {
            setError(getFriendlyError(reason));
          }
          setNotice("GitHub connected.");
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 401) {
            clearSession();
            navigateToPath(MARKETING_PATH, true);
          } else {
            setToken(AUTHENTICATED_SESSION_MARKER);
            navigateToPath(ORGANIZATIONS_PATH, true);
          }
          setError(getFriendlyError(reason));
        } finally {
          setBusyLabel(null);
          setIsBooting(false);
        }
        return;
      }

      try {
        if (isPublicRoute) {
          await getWorkspace(AUTHENTICATED_SESSION_MARKER);
          setToken(AUTHENTICATED_SESSION_MARKER);
          navigateToPath(ORGANIZATIONS_PATH, true);
          await syncFromPathRef.current(AUTHENTICATED_SESSION_MARKER, {
            quiet: true,
          });
        } else {
          await syncFromPathRef.current(AUTHENTICATED_SESSION_MARKER, {
            quiet: true,
          });
          setToken(AUTHENTICATED_SESSION_MARKER);
        }
      } catch (reason) {
        setToken(null);
        if (!isPublicRoute) {
          clearSession();
          if (!(reason instanceof ApiError && reason.status === 401)) {
            setError(getFriendlyError(reason));
          }
        }
      } finally {
        setIsBooting(false);
      }
    }

    void bootstrapWorkspace();
  }, [
    clearSession,
    completeGitHubOauthOnce,
    navigateToPath,
    setBusyLabel,
    setError,
    setIsBooting,
    setNotice,
    setToken,
    setWorkspace,
  ]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const sessionToken = token;

    function handlePopState(): void {
      setCurrentPath(window.location.pathname);
      void syncFromPathRef.current(sessionToken, { quiet: true });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setCurrentPath, token]);
}
