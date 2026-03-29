import { startTransition, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import { buildApiUrl, getProject } from "../../api";
import type { ProjectDetail, WorkspaceResponse } from "../../types";
import type { ProjectSection } from "../../view-models";
import { ORGANIZATIONS_PATH } from "../constants";
import { getOrganizationPath, getProjectPath } from "../routing";
import { mergeProjectIntoWorkspace } from "../workspace";

type UseProjectLiveSyncParams = {
  applyProjectSettingsFromProject: (
    project: ProjectDetail,
    options?: { resetDirty?: boolean },
  ) => void;
  navigateToPath: (path: string, replace?: boolean) => void;
  projectSection: ProjectSection;
  selectedOrganizationId: number | null;
  selectedProject: ProjectDetail | null;
  selectedProjectId: number | null;
  setProjectSection: Dispatch<SetStateAction<ProjectSection>>;
  setSelectedProject: Dispatch<SetStateAction<ProjectDetail | null>>;
  setWorkspace: Dispatch<SetStateAction<WorkspaceResponse | null>>;
  syncFromPath: (
    sessionToken: string,
    options?: { quiet?: boolean },
  ) => Promise<void>;
  token: string | null;
  workspace: WorkspaceResponse | null;
};

export function useProjectLiveSync({
  applyProjectSettingsFromProject,
  navigateToPath,
  projectSection,
  selectedOrganizationId,
  selectedProject,
  selectedProjectId,
  setProjectSection,
  setSelectedProject,
  setWorkspace,
  syncFromPath,
  token,
  workspace,
}: UseProjectLiveSyncParams) {
  const selectedProjectUpdatedAtRef = useRef<string | null>(null);
  const isRefreshingProjectFromEventsRef = useRef(false);
  const githubRepoRetryCountRef = useRef(0);
  const navigateToPathRef = useRef(navigateToPath);
  const syncFromPathRef = useRef(syncFromPath);

  useEffect(() => {
    navigateToPathRef.current = navigateToPath;
    syncFromPathRef.current = syncFromPath;
  }, [navigateToPath, syncFromPath]);

  useEffect(() => {
    if (
      !selectedProject ||
      selectedProject.useSprints ||
      projectSection !== "history"
    ) {
      return;
    }

    setProjectSection("board");
    navigateToPathRef.current(getProjectPath(selectedProject.id, "board"), true);
  }, [projectSection, selectedProject, setProjectSection]);

  useEffect(() => {
    selectedProjectUpdatedAtRef.current = selectedProject?.updatedAt ?? null;
  }, [selectedProject?.id, selectedProject?.updatedAt]);

  useEffect(() => {
    if (
      !token ||
      !workspace?.user.githubConnected ||
      workspace.githubRepoError !== "Bad credentials"
    ) {
      githubRepoRetryCountRef.current = 0;
      return;
    }

    if (githubRepoRetryCountRef.current >= 2) {
      return;
    }

    githubRepoRetryCountRef.current += 1;
    const retryDelayMs = 1200 * githubRepoRetryCountRef.current;
    const timeoutId = window.setTimeout(() => {
      void syncFromPathRef.current(token, { quiet: true });
    }, retryDelayMs);

    return () => window.clearTimeout(timeoutId);
  }, [token, workspace?.githubRepoError, workspace?.user.githubConnected]);

  useEffect(() => {
    if (!token || !selectedProjectId) {
      return;
    }

    const stream = new EventSource(
      buildApiUrl(`/api/projects/${selectedProjectId}/events/`),
      { withCredentials: true },
    );

    const parseUpdatedAt = (event: Event): string | null => {
      if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
        return null;
      }

      try {
        const payload = JSON.parse(event.data) as { updatedAt?: unknown };
        return typeof payload.updatedAt === "string" ? payload.updatedAt : null;
      } catch {
        return null;
      }
    };

    const refreshProject = (updatedAt: string | null = null) => {
      if (updatedAt && updatedAt === selectedProjectUpdatedAtRef.current) {
        return;
      }
      if (isRefreshingProjectFromEventsRef.current) {
        return;
      }

      isRefreshingProjectFromEventsRef.current = true;
      void (async () => {
        try {
          const projectResponse = await getProject(token, selectedProjectId);
          selectedProjectUpdatedAtRef.current =
            projectResponse.project.updatedAt;
          startTransition(() => {
            setSelectedProject(projectResponse.project);
            applyProjectSettingsFromProject(projectResponse.project);
            setWorkspace((current) =>
              mergeProjectIntoWorkspace(current, projectResponse.project),
            );
          });
        } catch {
          // Manual refresh paths will recover the UI.
        } finally {
          isRefreshingProjectFromEventsRef.current = false;
        }
      })();
    };

    const handleUpdated = (event: Event) => {
      refreshProject(parseUpdatedAt(event));
    };

    const handleDeleted = () => {
      navigateToPathRef.current(
        selectedOrganizationId
          ? getOrganizationPath(selectedOrganizationId)
          : ORGANIZATIONS_PATH,
        true,
      );
      void syncFromPathRef.current(token, { quiet: true });
    };

    stream.addEventListener("project.updated", handleUpdated);
    stream.addEventListener("project.deleted", handleDeleted);

    return () => {
      stream.removeEventListener("project.updated", handleUpdated);
      stream.removeEventListener("project.deleted", handleDeleted);
      stream.close();
      isRefreshingProjectFromEventsRef.current = false;
    };
  }, [
    applyProjectSettingsFromProject,
    selectedOrganizationId,
    selectedProjectId,
    setSelectedProject,
    setWorkspace,
    token,
  ]);
}
