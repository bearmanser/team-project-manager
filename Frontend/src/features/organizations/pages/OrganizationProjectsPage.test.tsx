import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OrganizationProjectsPage } from "./OrganizationProjectsPage";
import { buildOrganizationSummary, buildProjectSummary, buildRepo } from "../../../test/fixtures";
import { renderWithProviders } from "../../../test/renderWithProviders";

function OrganizationProjectsHarness({
  onCreateProject,
  onOpenProject,
}: {
  onCreateProject: () => void;
  onOpenProject: (projectId: number) => void;
}) {
  const [createProjectForm, setCreateProjectForm] = useState({
    name: "",
    description: "",
    repositoryId: "",
  });

  return (
    <OrganizationProjectsPage
      organization={buildOrganizationSummary()}
      projects={[buildProjectSummary()]}
      availableRepos={[buildRepo()]}
      canCreateProject
      createProjectForm={createProjectForm}
      githubRepoError={null}
      isGitHubConnected
      isCreatingProject={false}
      showCreateForm
      onConnectGitHub={vi.fn()}
      onCreateProject={onCreateProject}
      onCreateProjectFormChange={(field, value) =>
        setCreateProjectForm((current) => ({ ...current, [field]: value }))
      }
      onOpenProject={onOpenProject}
      onToggleCreateForm={vi.fn()}
    />
  );
}

describe("OrganizationProjectsPage", () => {
  it("submits a new project with the selected repository", async () => {
    const onCreateProject = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <OrganizationProjectsHarness
        onCreateProject={onCreateProject}
        onOpenProject={vi.fn()}
      />,
    );

    await user.type(
      screen.getByPlaceholderText("Client portal"),
      "Release dashboard",
    );
    await user.type(
      screen.getByPlaceholderText("What this project is responsible for."),
      "Tracks rollout work for the release team.",
    );
    await user.selectOptions(
      screen.getByRole("combobox"),
      String(buildRepo().id),
    );

    await user.click(screen.getByRole("button", { name: "Add project" }));

    expect(onCreateProject).toHaveBeenCalledOnce();
  });

  it("opens an existing project from the project list", async () => {
    const onOpenProject = vi.fn();
    const user = userEvent.setup();
    const project = buildProjectSummary({ id: 99, name: "Core API" });

    renderWithProviders(
      <OrganizationProjectsPage
        organization={buildOrganizationSummary()}
        projects={[project]}
        availableRepos={[]}
        canCreateProject
        createProjectForm={{ name: "", description: "", repositoryId: "" }}
        githubRepoError={null}
        isGitHubConnected={false}
        isCreatingProject={false}
        showCreateForm={false}
        onConnectGitHub={vi.fn()}
        onCreateProject={vi.fn()}
        onCreateProjectFormChange={vi.fn()}
        onOpenProject={onOpenProject}
        onToggleCreateForm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(onOpenProject).toHaveBeenCalledOnce();
    expect(onOpenProject).toHaveBeenCalledWith(99);
  });
});
