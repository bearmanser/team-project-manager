import {
  Button,
  Grid,
  Heading,
  Input,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";

import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { ProjectSummary, Repo } from "../types";
import { formatShortDate, nativeSelectStyle } from "../utils";

type OrganizationProjectsPageProps = {
  projects: ProjectSummary[];
  availableRepos: Repo[];
  createProjectForm: {
    name: string;
    description: string;
    repositoryId: string;
  };
  githubRepoError: string | null;
  isGitHubConnected: boolean;
  isCreatingProject: boolean;
  showCreateForm: boolean;
  onConnectGitHub: () => void;
  onCreateProject: () => void;
  onCreateProjectFormChange: (
    field: "name" | "description" | "repositoryId",
    value: string
  ) => void;
  onOpenProject: (projectId: number) => void;
  onToggleCreateForm: () => void;
};

export function OrganizationProjectsPage({
  projects,
  availableRepos,
  createProjectForm,
  githubRepoError,
  isGitHubConnected,
  isCreatingProject,
  showCreateForm,
  onConnectGitHub,
  onCreateProject,
  onCreateProjectFormChange,
  onOpenProject,
  onToggleCreateForm,
}: OrganizationProjectsPageProps) {
  return (
    <Stack gap="6">
      <SurfaceCard p={{ base: "6", lg: "8" }}>
        <Stack gap="5">
          <Stack
            direction={{ base: "column", md: "row" }}
            justify="space-between"
            align={{ base: "stretch", md: "center" }}
          >
            <Stack gap="1">
              <Text
                fontSize="xs"
                textTransform="uppercase"
                letterSpacing="0.16em"
                color="#90a0b7"
              >
                Create project
              </Text>
              <Heading size="lg" color="#f5f7fb">
                Launch a new repository-backed project
              </Heading>
            </Stack>
            <Button
              borderRadius="0"
              borderWidth="1px"
              borderColor="#2b3544"
              bg={showCreateForm ? "#15233b" : "#0f141b"}
              color="#eef3fb"
              onClick={onToggleCreateForm}
            >
              {showCreateForm ? "Hide form" : "Create project"}
            </Button>
          </Stack>

          {githubRepoError ? (
            <SurfaceCard p="4" bg="#2a1317" borderColor="#8c3a46">
              <Text color="#ffc6ce">{githubRepoError}</Text>
            </SurfaceCard>
          ) : null}

          {showCreateForm ? (
            !isGitHubConnected ? (
              <SurfaceCard p="5" bg="#0f141b">
                <Stack gap="4">
                  <Text color="#d8e1ee">
                    Connect GitHub first. A project now maps to a single
                    repository from day one.
                  </Text>
                  <Button
                    borderRadius="0"
                    bg="#2d6cdf"
                    color="#f8fbff"
                    onClick={onConnectGitHub}
                  >
                    Connect GitHub
                  </Button>
                </Stack>
              </SurfaceCard>
            ) : (
              <Grid
                as="form"
                templateColumns={{ base: "1fr", xl: "1fr 1fr" }}
                gap="4"
                onSubmit={(event) => {
                  event.preventDefault();
                  onCreateProject();
                }}
              >
                <Stack gap="2">
                  <Text color="#d8e1ee">Project name</Text>
                  <Input
                    value={createProjectForm.name}
                    onChange={(event) =>
                      onCreateProjectFormChange("name", event.target.value)
                    }
                    bg="#0f141b"
                    borderColor="#2b3544"
                    borderRadius="0"
                    color="#f5f7fb"
                  />
                </Stack>
                <Stack gap="2">
                  <Text color="#d8e1ee">GitHub repository</Text>
                  <select
                    value={createProjectForm.repositoryId}
                    style={nativeSelectStyle}
                    onChange={(event) =>
                      onCreateProjectFormChange(
                        "repositoryId",
                        event.target.value
                      )
                    }
                  >
                    <option value="">Choose one repository</option>
                    {availableRepos.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.fullName}
                      </option>
                    ))}
                  </select>
                </Stack>
                <Stack gap="2" gridColumn={{ base: "auto", xl: "1 / span 2" }}>
                  <Text color="#d8e1ee">Description</Text>
                  <Textarea
                    value={createProjectForm.description}
                    onChange={(event) =>
                      onCreateProjectFormChange(
                        "description",
                        event.target.value
                      )
                    }
                    bg="#0f141b"
                    borderColor="#2b3544"
                    borderRadius="0"
                    color="#f5f7fb"
                    minH="120px"
                  />
                </Stack>
                <Button
                  type="submit"
                  borderRadius="0"
                  bg="#2d6cdf"
                  color="#f8fbff"
                  disabled={
                    isCreatingProject || !createProjectForm.repositoryId
                  }
                >
                  {isCreatingProject ? "Creating project" : "Create project"}
                </Button>
              </Grid>
            )
          ) : null}
        </Stack>
      </SurfaceCard>

      <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap="4">
        {projects.length ? (
          projects.map((project) => (
            <SurfaceCard key={project.id} p="5" bg="#0f141b">
              <Stack gap="4">
                <Stack gap="2">
                  <Heading size="md" color="#f5f7fb">
                    {project.name}
                  </Heading>
                  <Text color="#90a0b7">
                    {project.description || "No description yet."}
                  </Text>
                </Stack>

                <Grid templateColumns="repeat(3, 1fr)" gap="3">
                  <SurfaceCard p="3" bg="#111720">
                    <Text
                      color="#90a0b7"
                      fontSize="xs"
                      textTransform="uppercase"
                    >
                      Repo
                    </Text>
                    <Text color="#f5f7fb" fontWeight="700">
                      {project.repoCount}
                    </Text>
                  </SurfaceCard>
                  <SurfaceCard p="3" bg="#111720">
                    <Text
                      color="#90a0b7"
                      fontSize="xs"
                      textTransform="uppercase"
                    >
                      Users
                    </Text>
                    <Text color="#f5f7fb" fontWeight="700">
                      {project.memberCount}
                    </Text>
                  </SurfaceCard>
                  <SurfaceCard p="3" bg="#111720">
                    <Text
                      color="#90a0b7"
                      fontSize="xs"
                      textTransform="uppercase"
                    >
                      Open bugs
                    </Text>
                    <Text color="#f5f7fb" fontWeight="700">
                      {project.openBugCount}
                    </Text>
                  </SurfaceCard>
                </Grid>

                <Stack
                  direction={{ base: "column", md: "row" }}
                  justify="space-between"
                  align={{ base: "stretch", md: "center" }}
                >
                  <StatusPill label={project.role} />
                  <Text color="#90a0b7" fontSize="sm">
                    Updated {formatShortDate(project.updatedAt)}
                  </Text>
                </Stack>

                <Button
                  borderRadius="0"
                  bg="#2d6cdf"
                  color="#f8fbff"
                  onClick={() => onOpenProject(project.id)}
                >
                  Open project
                </Button>
              </Stack>
            </SurfaceCard>
          ))
        ) : (
          <SurfaceCard p="6" bg="#0f141b">
            <Text color="#90a0b7">
              No projects yet. Create the first project to start planning work.
            </Text>
          </SurfaceCard>
        )}
      </Grid>
    </Stack>
  );
}
