import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import { AUTH_TOKEN_INVALID_EVENT } from "../../api";
import type { User, WorkspaceResponse } from "../../types";
import { MARKETING_PATH, ORGANIZATIONS_PATH, TOKEN_STORAGE_KEY } from "../constants";
import { getFriendlyError } from "../errors";
import { parseRoute } from "../routing";

type UseWorkspaceSessionEffectsParams = {
  clearSession: () => void;
  completeGitHubOauthOnce: (
    sessionToken: string,
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
  setWorkspace: Dispatch<SetStateAction<WorkspaceResponse | null>>;
  syncFromPath: (
    sessionToken: string,
    options?: { quiet?: boolean },
  ) => Promise<void>;
  token: string | null;
};

export function useWorkspaceSessionEffects({
  clearSession,
  completeGitHubOauthOnce,
  navigateToPath,
  setBusyLabel,
  setCurrentPath,
  setError,
  setIsBooting,
  setNotice,
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
  }, [clearSession, setError]);

  useEffect(() => {
    async function bootstrapWorkspace(): Promise<void> {
      const sessionToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      const route = parseRoute(window.location.pathname);
      const params = new URLSearchParams(window.location.search);

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

        if (!sessionToken || !code || !state) {
          clearSession();
          setError("Finish signing in before connecting GitHub.");
          navigateToPath(MARKETING_PATH, true);
          setIsBooting(false);
          return;
        }

        setBusyLabel("Connecting GitHub");
        try {
          const response = await completeGitHubOauthOnce(sessionToken, code, state);
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
            await syncFromPathRef.current(sessionToken, { quiet: true });
          } catch (reason) {
            setError(getFriendlyError(reason));
          }
          setNotice("GitHub connected.");
        } catch (reason) {
          navigateToPath(ORGANIZATIONS_PATH, true);
          setError(getFriendlyError(reason));
        } finally {
          setBusyLabel(null);
          setIsBooting(false);
        }
        return;
      }

      if (!sessionToken) {
        if (route.kind !== "marketing" && route.kind !== "signup") {
          navigateToPath(MARKETING_PATH, true);
        }
        setIsBooting(false);
        return;
      }

      try {
        if (route.kind === "marketing" || route.kind === "signup") {
          navigateToPath(ORGANIZATIONS_PATH, true);
        }
        await syncFromPathRef.current(sessionToken, { quiet: true });
      } catch (reason) {
        clearSession();
        setError(getFriendlyError(reason));
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
