import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { ORGANIZATIONS_PATH } from "../../../app/constants";
import { getFriendlyError } from "../../../app/errors";
import {
  getOrganizationSettingsForm,
  initialOrganizationForm,
  initialProjectForm,
} from "../../../app/forms";
import { getOrganizationPath, getProjectPath } from "../../../app/routing";
import type {
  OrganizationMember,
  OrganizationRole,
  OrganizationSummary,
  ProjectDetail,
} from "../../../types";
import type { OrganizationSection } from "../../../view-models";
import {
  cancelOrganizationInvite,
  createOrganization,
  deleteOrganization,
  getOrganizationMembers,
  inviteOrganizationMember,
  leaveOrganization,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  updateOrganizationSettings,
} from "../api";
import { createProject } from "../../projects/api";

type UseOrganizationControllerParams = {
  token: string | null;
  currentOrganization: OrganizationSummary | null;
  organizationSection: OrganizationSection;
  selectedProject: ProjectDetail | null;
  setOrganizationSection: Dispatch<SetStateAction<OrganizationSection>>;
  setBusyLabel: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  syncFromPath: (
    sessionToken: string,
    options?: { quiet?: boolean },
  ) => Promise<void>;
  clearProjectSelection: () => void;
  rememberOrganizationSelection: (organizationId: number | null) => void;
  navigateToPath: (path: string, replace?: boolean) => void;
};

const organizationMembersRequests = new Map<
  string,
  Promise<OrganizationMember[]>
>();

function getOrganizationMembersRequestKey(
  token: string,
  organizationId: number,
): string {
  return `${organizationId}:${token}`;
}

async function loadOrganizationMembersOnce(
  token: string,
  organizationId: number,
): Promise<OrganizationMember[]> {
  const requestKey = getOrganizationMembersRequestKey(token, organizationId);
  const existingRequest = organizationMembersRequests.get(requestKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = getOrganizationMembers(token, organizationId)
    .then((response) => response.members)
    .finally(() => {
      organizationMembersRequests.delete(requestKey);
    });

  organizationMembersRequests.set(requestKey, request);
  return request;
}

export function useOrganizationController({
  token,
  currentOrganization,
  organizationSection,
  selectedProject,
  setOrganizationSection,
  setBusyLabel,
  setError,
  setNotice,
  syncFromPath,
  clearProjectSelection,
  rememberOrganizationSelection,
  navigateToPath,
}: UseOrganizationControllerParams) {
  const currentOrganizationId = currentOrganization?.id ?? null;
  const currentOrganizationIsPersonal = currentOrganization?.isPersonal ?? false;
  const [organizationUsers, setOrganizationUsers] = useState<
    OrganizationMember[]
  >([]);
  const [organizationUsersLoading, setOrganizationUsersLoading] =
    useState(false);
  const [showCreateOrganizationForm, setShowCreateOrganizationForm] =
    useState(false);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [createOrganizationForm, setCreateOrganizationForm] = useState(
    initialOrganizationForm,
  );
  const [organizationSettingsForm, setOrganizationSettingsForm] = useState({
    name: "",
  });
  const [createProjectForm, setCreateProjectForm] = useState(initialProjectForm);

  useEffect(() => {
    if (!currentOrganization) {
      setOrganizationSettingsForm({
        name: "",
      });
      return;
    }

    if (currentOrganization.isPersonal) {
      setOrganizationSettingsForm({
        name: "",
      });
      if (
        organizationSection === "users" ||
        organizationSection === "settings"
      ) {
        setOrganizationSection("projects");
        navigateToPath(getOrganizationPath(currentOrganization.id, "projects"), true);
      }
      return;
    }

    if (
      currentOrganization.role === "owner" ||
      currentOrganization.role === "admin"
    ) {
      setOrganizationSettingsForm(getOrganizationSettingsForm(currentOrganization));
      return;
    }

    setOrganizationSettingsForm({
      name: "",
    });
  }, [
    currentOrganization,
    navigateToPath,
    organizationSection,
    setOrganizationSection,
  ]);

  useEffect(() => {
    if (
      !token ||
      currentOrganizationId === null ||
      selectedProject ||
      organizationSection !== "users"
    ) {
      return;
    }
    if (currentOrganizationIsPersonal) {
      setOrganizationSection("projects");
      navigateToPath(getOrganizationPath(currentOrganizationId, "projects"), true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setOrganizationUsersLoading(true);
        const members = await loadOrganizationMembersOnce(
          token,
          currentOrganizationId,
        );
        if (cancelled) {
          return;
        }
        setOrganizationUsers(members);
      } catch (reason) {
        if (!cancelled) {
          setError(getFriendlyError(reason));
        }
      } finally {
        if (!cancelled) {
          setOrganizationUsersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    currentOrganizationId,
    currentOrganizationIsPersonal,
    navigateToPath,
    organizationSection,
    selectedProject,
    setError,
    setOrganizationSection,
    token,
  ]);

  async function handleCreateOrganization(): Promise<void> {
    if (!token) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Adding organization");

    try {
      const response = await createOrganization(token, {
        name: createOrganizationForm.name.trim(),
        description: createOrganizationForm.description.trim(),
      });
      setCreateOrganizationForm(initialOrganizationForm);
      setShowCreateOrganizationForm(false);
      navigateToPath(getOrganizationPath(response.organization.id), true);
      await syncFromPath(token, { quiet: true });
      setNotice("Organization added.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleSaveOrganizationSettings(): Promise<void> {
    if (
      !token ||
      !currentOrganization ||
      currentOrganization.isPersonal ||
      (currentOrganization.role !== "owner" &&
        currentOrganization.role !== "admin")
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Saving organization settings");

    try {
      await updateOrganizationSettings(token, currentOrganization.id, {
        name: organizationSettingsForm.name.trim(),
      });
      await syncFromPath(token, { quiet: true });
      setNotice("Organization settings saved.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleDeleteOrganization(): Promise<void> {
    if (
      !token ||
      !currentOrganization ||
      currentOrganization.isPersonal ||
      currentOrganization.role !== "owner"
    ) {
      return;
    }

    const organizationId = currentOrganization.id;
    setBusyLabel("Deleting organization");
    setError(null);
    setNotice(null);

    try {
      clearProjectSelection();
      rememberOrganizationSelection(null);
      await deleteOrganization(token, organizationId);
      navigateToPath(ORGANIZATIONS_PATH, true);
      await syncFromPath(token, { quiet: true });
      setNotice("Organization deleted.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleLeaveCurrentOrganization(): Promise<void> {
    if (
      !token ||
      !currentOrganization ||
      currentOrganization.isPersonal ||
      currentOrganization.role === "owner"
    ) {
      return;
    }

    const organizationId = currentOrganization.id;
    setBusyLabel("Leaving organization");
    setError(null);
    setNotice(null);

    try {
      clearProjectSelection();
      rememberOrganizationSelection(null);
      await leaveOrganization(token, organizationId);
      navigateToPath(ORGANIZATIONS_PATH, true);
      await syncFromPath(token, { quiet: true });
      setNotice("You left the organization.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleCreateProject(): Promise<void> {
    if (
      !token ||
      !currentOrganization ||
      (currentOrganization.role !== "owner" &&
        currentOrganization.role !== "admin")
    ) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyLabel("Adding project");

    try {
      const response = await createProject(token, {
        organizationId: currentOrganization.id,
        name: createProjectForm.name.trim(),
        description: createProjectForm.description.trim(),
        repositoryId: createProjectForm.repositoryId || undefined,
      });
      setCreateProjectForm(initialProjectForm);
      setShowCreateProjectForm(false);
      navigateToPath(getProjectPath(response.project.id), true);
      await syncFromPath(token, { quiet: true });
      setNotice("Project added.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleInviteOrganizationUser(
    identifier: string,
    role: OrganizationRole,
  ): Promise<void> {
    if (!token || !currentOrganization) {
      return;
    }

    setBusyLabel("Inviting user");
    setError(null);
    setNotice(null);

    try {
      const response = await inviteOrganizationMember(token, currentOrganization.id, {
        identifier,
        role,
      });
      setOrganizationUsers(response.members);
      await syncFromPath(token, { quiet: true });
      setNotice("User invited.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleChangeOrganizationUserRole(
    membershipId: number,
    role: OrganizationRole,
  ): Promise<void> {
    if (!token || !currentOrganization) {
      return;
    }

    setBusyLabel("Changing organization role");
    setError(null);
    setNotice(null);

    try {
      const response = await updateOrganizationMemberRole(
        token,
        currentOrganization.id,
        membershipId,
        { role },
      );
      setOrganizationUsers(response.members);
      await syncFromPath(token, { quiet: true });
      setNotice("Role updated.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleRemoveOrganizationUser(
    membershipId: number,
  ): Promise<void> {
    if (!token || !currentOrganization) {
      return;
    }

    setBusyLabel("Removing user");
    setError(null);
    setNotice(null);

    try {
      await removeOrganizationMember(token, currentOrganization.id, membershipId);
      const response = await getOrganizationMembers(token, currentOrganization.id);
      setOrganizationUsers(response.members);
      await syncFromPath(token, { quiet: true });
      setNotice("User removed.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleCancelOrganizationInvite(
    membershipId: number,
  ): Promise<void> {
    if (!token || !currentOrganization) {
      return;
    }

    setBusyLabel("Canceling invite");
    setError(null);
    setNotice(null);

    try {
      await cancelOrganizationInvite(token, currentOrganization.id, membershipId);
      const response = await getOrganizationMembers(token, currentOrganization.id);
      setOrganizationUsers(response.members);
      await syncFromPath(token, { quiet: true });
      setNotice("Invite canceled.");
    } catch (reason) {
      setError(getFriendlyError(reason));
      return;
    } finally {
      setBusyLabel(null);
    }
  }

  return {
    createOrganizationForm,
    createProjectForm,
    handleCancelOrganizationInvite,
    handleChangeOrganizationUserRole,
    handleCreateOrganization,
    handleCreateProject,
    handleDeleteOrganization,
    handleInviteOrganizationUser,
    handleLeaveCurrentOrganization,
    handleRemoveOrganizationUser,
    handleSaveOrganizationSettings,
    organizationSettingsForm,
    organizationUsers,
    organizationUsersLoading,
    setCreateOrganizationForm,
    setCreateProjectForm,
    setOrganizationSettingsForm,
    setShowCreateOrganizationForm,
    setShowCreateProjectForm,
    showCreateOrganizationForm,
    showCreateProjectForm,
  };
}
