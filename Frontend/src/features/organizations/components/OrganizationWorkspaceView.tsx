import type { ReactNode } from "react";

import { AppShell } from "../../../components/AppShell";
import { SideNav } from "../../../components/SideNav";
import { OrganizationProjectsPage } from "../pages/OrganizationProjectsPage";
import { OrganizationSettingsPage } from "../pages/OrganizationSettingsPage";
import { OrganizationUsersPage } from "../pages/OrganizationUsersPage";
import { OrganizationSelector } from "./OrganizationSelector";
import type {
  OrganizationMember,
  OrganizationRole,
  OrganizationSummary,
  ProjectSummary,
  Repo,
  User,
} from "../../../types";
import type { NavItem, OrganizationSection } from "../../../view-models";

type OrganizationWorkspaceViewProps = {
  topNav: ReactNode;
  organization: OrganizationSummary;
  projects: ProjectSummary[];
  organizations: OrganizationSummary[];
  organizationNavItems: NavItem<OrganizationSection>[];
  organizationSection: OrganizationSection;
  availableRepos: Repo[];
  user: User;
  busyLabel: string | null;
  githubRepoErrorMessage: string | null;
  showCreateOrganizationForm: boolean;
  showCreateProjectForm: boolean;
  createOrganizationForm: {
    name: string;
    description: string;
  };
  createProjectForm: {
    name: string;
    description: string;
    repositoryId: string;
  };
  organizationSettingsForm: {
    name: string;
  };
  organizationUsers: OrganizationMember[];
  organizationUsersLoading: boolean;
  onSelectSection: (section: OrganizationSection) => void;
  onOpenOrganization: (organizationId: number) => void;
  onOpenProject: (projectId: number) => void;
  onConnectGitHub: () => void;
  onCreateOrganization: () => void;
  onCreateProject: () => void;
  onCreateOrganizationFormChange: (
    field: "name" | "description",
    value: string,
  ) => void;
  onCreateProjectFormChange: (
    field: "name" | "description" | "repositoryId",
    value: string,
  ) => void;
  onOrganizationSettingsChange: (field: "name", value: string) => void;
  onToggleCreateOrganizationForm: () => void;
  onToggleCreateProjectForm: () => void;
  onDeleteOrganization: () => void;
  onLeaveOrganization: () => void;
  onSaveOrganizationSettings: () => void;
  onInviteUser: (identifier: string, role: OrganizationRole) => void;
  onChangeRole: (membershipId: number, role: OrganizationRole) => void;
  onRemoveUser: (membershipId: number) => void;
  onCancelInvite: (membershipId: number) => void;
};

export function OrganizationWorkspaceView({
  topNav,
  organization,
  projects,
  organizations,
  organizationNavItems,
  organizationSection,
  availableRepos,
  user,
  busyLabel,
  githubRepoErrorMessage,
  showCreateOrganizationForm,
  showCreateProjectForm,
  createOrganizationForm,
  createProjectForm,
  organizationSettingsForm,
  organizationUsers,
  organizationUsersLoading,
  onSelectSection,
  onOpenOrganization,
  onOpenProject,
  onConnectGitHub,
  onCreateOrganization,
  onCreateProject,
  onCreateOrganizationFormChange,
  onCreateProjectFormChange,
  onOrganizationSettingsChange,
  onToggleCreateOrganizationForm,
  onToggleCreateProjectForm,
  onDeleteOrganization,
  onLeaveOrganization,
  onSaveOrganizationSettings,
  onInviteUser,
  onChangeRole,
  onRemoveUser,
  onCancelInvite,
}: OrganizationWorkspaceViewProps) {
  const organizationSidebar = (
    <SideNav
      items={organizationNavItems}
      activeItem={organizationSection}
      onSelect={onSelectSection}
      topSlot={
        <OrganizationSelector
          createOrganizationForm={createOrganizationForm}
          currentOrganization={organization}
          isCreatingOrganization={busyLabel === "Adding organization"}
          organizations={organizations}
          showCreateForm={showCreateOrganizationForm}
          onCreateOrganization={onCreateOrganization}
          onCreateOrganizationFormChange={onCreateOrganizationFormChange}
          onOpenOrganization={onOpenOrganization}
          onToggleCreateForm={onToggleCreateOrganizationForm}
        />
      }
    />
  );

  let organizationContent = (
    <OrganizationProjectsPage
      organization={organization}
      projects={projects}
      availableRepos={availableRepos}
      canCreateProject={
        organization.role === "owner" || organization.role === "admin"
      }
      createProjectForm={createProjectForm}
      githubRepoError={githubRepoErrorMessage}
      isGitHubConnected={user.githubConnected}
      isCreatingProject={busyLabel === "Adding project"}
      showCreateForm={showCreateProjectForm}
      onConnectGitHub={onConnectGitHub}
      onCreateProject={onCreateProject}
      onCreateProjectFormChange={onCreateProjectFormChange}
      onOpenProject={onOpenProject}
      onToggleCreateForm={onToggleCreateProjectForm}
    />
  );

  if (!organization.isPersonal && organizationSection === "users") {
    organizationContent = (
      <OrganizationUsersPage
        isInviting={busyLabel === "Inviting user"}
        isLoading={organizationUsersLoading}
        members={organizationUsers}
        organizationRole={organization.role}
        onCancelInvite={onCancelInvite}
        onChangeRole={onChangeRole}
        onInviteUser={onInviteUser}
        onRemoveUser={onRemoveUser}
      />
    );
  }

  if (!organization.isPersonal && organizationSection === "settings") {
    organizationContent = (
      <OrganizationSettingsPage
        busyLabel={busyLabel}
        organization={organization}
        role={organization.role}
        organizationSettingsForm={organizationSettingsForm}
        onDeleteOrganization={onDeleteOrganization}
        onLeaveOrganization={onLeaveOrganization}
        onOrganizationSettingsChange={onOrganizationSettingsChange}
        onSaveOrganizationSettings={onSaveOrganizationSettings}
      />
    );
  }

  return (
    <AppShell topNav={topNav} sidebar={organizationSidebar}>
      {organizationContent}
    </AppShell>
  );
}
