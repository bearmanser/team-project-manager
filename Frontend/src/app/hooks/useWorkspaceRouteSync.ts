import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

import { ApiError, getProject, getWorkspace } from "../../api";
import type { ProjectDetail, WorkspaceResponse } from "../../types";
import type { OrganizationSection, ProjectSection } from "../../view-models";
import { ORGANIZATIONS_PATH } from "../constants";
import { getFriendlyError } from "../errors";
import { getOrganizationPath, parseRoute } from "../routing";
import {
  mergeProjectIntoWorkspace,
  resolveOrganizationSelection,
} from "../workspace";

type UseWorkspaceRouteSyncParams = {
  applyProjectSettingsFromProject: (
    project: ProjectDetail,
    options?: { resetDirty?: boolean },
  ) => void;
  clearProjectSelection: () => void;
  navigateToPath: (path: string, replace?: boolean) => void;
  rememberOrganizationSelection: (organizationId: number | null) => void;
  rememberProjectSelection: (projectId: number | null) => void;
  selectedOrganizationId: number | null;
  selectedProject: ProjectDetail | null;
  selectedProjectId: number | null;
  setBusyLabel: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setNotificationOpen: Dispatch<SetStateAction<boolean>>;
  setOrganizationSection: Dispatch<SetStateAction<OrganizationSection>>;
  setProjectSection: Dispatch<SetStateAction<ProjectSection>>;
  setSelectedProject: Dispatch<SetStateAction<ProjectDetail | null>>;
  setWorkspace: Dispatch<SetStateAction<WorkspaceResponse | null>>;
  token: string | null;
  workspace: WorkspaceResponse | null;
};

export function useWorkspaceRouteSync({
  applyProjectSettingsFromProject,
  clearProjectSelection,
  navigateToPath,
  rememberOrganizationSelection,
  rememberProjectSelection,
  selectedOrganizationId,
  selectedProject,
  selectedProjectId,
  setBusyLabel,
  setError,
  setNotice,
  setNotificationOpen,
  setOrganizationSection,
  setProjectSection,
  setSelectedProject,
  setWorkspace,
  token,
  workspace,
}: UseWorkspaceRouteSyncParams) {
  const routeSyncRequestIdRef = useRef(0);

  const isActiveRouteSyncRequest = useCallback(
    (routeSyncRequestId?: number): boolean =>
      routeSyncRequestId === undefined ||
      routeSyncRequestId === routeSyncRequestIdRef.current,
    [],
  );

  const loadProjectDetail = useCallback(
    async (
      sessionToken: string,
      projectId: number,
      routeSyncRequestId?: number,
    ): Promise<ProjectDetail> => {
      const response = await getProject(sessionToken, projectId);
      if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
        return response.project;
      }
      setSelectedProject(response.project);
      applyProjectSettingsFromProject(response.project);
      setWorkspace((current) =>
        mergeProjectIntoWorkspace(current, response.project),
      );
      rememberProjectSelection(projectId);
      rememberOrganizationSelection(response.project.organizationId);
      return response.project;
    },
    [
      applyProjectSettingsFromProject,
      isActiveRouteSyncRequest,
      rememberOrganizationSelection,
      rememberProjectSelection,
      setSelectedProject,
      setWorkspace,
    ],
  );

  const hydrateWorkspace = useCallback(
    async (
      sessionToken: string,
      options: {
        preferredOrganizationId?: number | null;
        preferredProjectId?: number | null;
        projectOverride?: ProjectDetail | null;
        quiet?: boolean;
      } = {},
      routeSyncRequestId?: number,
    ): Promise<{
      resolvedOrganizationId: number | null;
      resolvedProjectId: number | null;
    }> => {
      if (!options.quiet && isActiveRouteSyncRequest(routeSyncRequestId)) {
        setBusyLabel("Loading workspace");
      }

      const workspaceData = await getWorkspace(sessionToken);
      if (isActiveRouteSyncRequest(routeSyncRequestId)) {
        setWorkspace(workspaceData);
      }

      const requestedProjectId = Object.prototype.hasOwnProperty.call(
        options,
        "preferredProjectId",
      )
        ? options.preferredProjectId ?? null
        : selectedProjectId;
      const resolvedProjectId = workspaceData.projects.some(
        (project) => project.id === requestedProjectId,
      )
        ? requestedProjectId
        : null;

      if (resolvedProjectId !== null) {
        const projectOverride = options.projectOverride;
        if (projectOverride && projectOverride.id === resolvedProjectId) {
          if (isActiveRouteSyncRequest(routeSyncRequestId)) {
            rememberProjectSelection(resolvedProjectId);
            rememberOrganizationSelection(projectOverride.organizationId);
            setSelectedProject(projectOverride);
            applyProjectSettingsFromProject(projectOverride);
          }
        } else {
          await loadProjectDetail(
            sessionToken,
            resolvedProjectId,
            routeSyncRequestId,
          );
        }

        if (!options.quiet && isActiveRouteSyncRequest(routeSyncRequestId)) {
          setBusyLabel(null);
        }

        return {
          resolvedOrganizationId:
            options.projectOverride?.id === resolvedProjectId
              ? options.projectOverride.organizationId
              : workspaceData.projects.find(
                    (project) => project.id === resolvedProjectId,
                  )?.organizationId ?? null,
          resolvedProjectId,
        };
      }

      if (isActiveRouteSyncRequest(routeSyncRequestId)) {
        rememberProjectSelection(null);
        setSelectedProject(null);
      }

      const requestedOrganizationId = Object.prototype.hasOwnProperty.call(
        options,
        "preferredOrganizationId",
      )
        ? options.preferredOrganizationId ?? null
        : selectedOrganizationId;
      const resolvedOrganizationId = resolveOrganizationSelection(
        workspaceData.organizations,
        requestedOrganizationId,
      );

      if (isActiveRouteSyncRequest(routeSyncRequestId)) {
        rememberOrganizationSelection(resolvedOrganizationId);
      }

      if (!options.quiet && isActiveRouteSyncRequest(routeSyncRequestId)) {
        setBusyLabel(null);
      }

      return {
        resolvedOrganizationId,
        resolvedProjectId: null,
      };
    },
    [
      applyProjectSettingsFromProject,
      isActiveRouteSyncRequest,
      loadProjectDetail,
      rememberOrganizationSelection,
      rememberProjectSelection,
      selectedOrganizationId,
      selectedProjectId,
      setBusyLabel,
      setSelectedProject,
      setWorkspace,
    ],
  );

  const syncFromPath = useCallback(
    async (
      sessionToken: string,
      options: { quiet?: boolean } = {},
    ): Promise<void> => {
      const routeSyncRequestId = ++routeSyncRequestIdRef.current;
      const route = parseRoute(window.location.pathname);
      setNotificationOpen(false);

      if (route.kind === "marketing" || route.kind === "signup") {
        navigateToPath(ORGANIZATIONS_PATH, true);
        await syncFromPath(sessionToken, options);
        return;
      }

      if (route.kind === "organizations") {
        setOrganizationSection("projects");
        clearProjectSelection();
        const result = await hydrateWorkspace(
          sessionToken,
          {
            preferredProjectId: null,
            quiet: options.quiet,
          },
          routeSyncRequestId,
        );
        if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
          return;
        }
        if (result.resolvedOrganizationId !== null) {
          navigateToPath(getOrganizationPath(result.resolvedOrganizationId), true);
        }
        return;
      }

      if (route.kind === "organization") {
        setOrganizationSection(route.section);
        clearProjectSelection();
        const result = await hydrateWorkspace(
          sessionToken,
          {
            preferredOrganizationId: route.organizationId,
            preferredProjectId: null,
            quiet: options.quiet,
          },
          routeSyncRequestId,
        );
        if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
          return;
        }
        if (result.resolvedOrganizationId !== route.organizationId) {
          navigateToPath(
            result.resolvedOrganizationId
              ? getOrganizationPath(result.resolvedOrganizationId)
              : ORGANIZATIONS_PATH,
            true,
          );
        }
        return;
      }

      if (route.kind === "project") {
        setProjectSection(route.section);

        if (selectedProject?.id === route.projectId) {
          rememberProjectSelection(route.projectId);
          rememberOrganizationSelection(selectedProject.organizationId);
          return;
        }

        const knownProject =
          workspace?.projects.some((project) => project.id === route.projectId) ??
          false;
        if (knownProject) {
          try {
            await loadProjectDetail(
              sessionToken,
              route.projectId,
              routeSyncRequestId,
            );
            if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
              return;
            }
            return;
          } catch (reason) {
            if (!(reason instanceof ApiError) || reason.status !== 404) {
              throw reason;
            }
          }
        }

        const result = await hydrateWorkspace(
          sessionToken,
          {
            preferredOrganizationId: null,
            preferredProjectId: route.projectId,
            quiet: options.quiet,
          },
          routeSyncRequestId,
        );
        if (!isActiveRouteSyncRequest(routeSyncRequestId)) {
          return;
        }
        if (result.resolvedProjectId !== route.projectId) {
          navigateToPath(
            result.resolvedOrganizationId
              ? getOrganizationPath(result.resolvedOrganizationId)
              : ORGANIZATIONS_PATH,
            true,
          );
        }
      }
    },
    [
      clearProjectSelection,
      hydrateWorkspace,
      isActiveRouteSyncRequest,
      loadProjectDetail,
      navigateToPath,
      rememberOrganizationSelection,
      rememberProjectSelection,
      selectedProject,
      setNotificationOpen,
      setOrganizationSection,
      setProjectSection,
      workspace?.projects,
    ],
  );

  const runProjectMutation = useCallback(
    async (
      label: string,
      action: () => Promise<{ project: ProjectDetail }>,
      successNotice: string,
    ): Promise<boolean> => {
      if (!token) {
        return false;
      }

      setBusyLabel(label);
      setError(null);
      setNotice(null);

      try {
        const response = await action();
        setSelectedProject(response.project);
        applyProjectSettingsFromProject(response.project, { resetDirty: true });
        rememberProjectSelection(response.project.id);
        rememberOrganizationSelection(response.project.organizationId);
        await hydrateWorkspace(token, {
          preferredOrganizationId: response.project.organizationId,
          preferredProjectId: response.project.id,
          projectOverride: response.project,
          quiet: true,
        });
        setNotice(successNotice);
        return true;
      } catch (reason) {
        setError(getFriendlyError(reason));
        return false;
      } finally {
        setBusyLabel(null);
      }
    },
    [
      applyProjectSettingsFromProject,
      hydrateWorkspace,
      rememberOrganizationSelection,
      rememberProjectSelection,
      setBusyLabel,
      setError,
      setNotice,
      setSelectedProject,
      token,
    ],
  );

  return {
    runProjectMutation,
    syncFromPath,
  };
}
