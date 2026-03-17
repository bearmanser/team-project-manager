import { Button, Flex, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { ModalFrame } from "../components/ModalFrame";
import { SurfaceCard } from "../components/SurfaceCard";
import type { OrganizationSummary, ProjectSummary, Repo } from "../types";
import { formatShortDate, nativeSelectStyle } from "../utils";

type OrganizationProjectsPageProps = {
    organization: OrganizationSummary;
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
        value: string,
    ) => void;
    onOpenProject: (projectId: number) => void;
    onToggleCreateForm: () => void;
};

export function OrganizationProjectsPage({
    organization,
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
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Projects
                    </Text>
                    <Heading size="2xl" color="#f5f7fb">
                        {organization.name}
                    </Heading>
                    <Text color="#b0bccf" maxW="2xl">
                        Keep projects lightweight inside this organization and jump straight into the board, bugs, or tasks without extra summary chrome.
                    </Text>
                </Stack>
                <Button
                    minW="12"
                    h="12"
                    borderRadius="full"
                    bg="#2d6cdf"
                    color="#f8fbff"
                    fontSize="2xl"
                    lineHeight="1"
                    onClick={onToggleCreateForm}
                >
                    +
                </Button>
            </Flex>

            {githubRepoError ? (
                <SurfaceCard p="4" bg="#2a1317" borderColor="#8c3a46">
                    <Text color="#ffc6ce">{githubRepoError}</Text>
                </SurfaceCard>
            ) : null}

            <SurfaceCard p="0" overflow="hidden">
                {projects.length ? (
                    projects.map((project) => (
                        <Flex
                            key={project.id}
                            px={{ base: "4", lg: "5" }}
                            py="4"
                            align={{ base: "flex-start", lg: "center" }}
                            justify="space-between"
                            gap="4"
                            wrap="wrap"
                            borderBottomWidth="1px"
                            borderColor="#273140"
                            _last={{ borderBottomWidth: "0" }}
                        >
                            <Stack gap="1" flex="1" minW="260px">
                                <Heading size="md" color="#f5f7fb">
                                    {project.name}
                                </Heading>
                                <Text color="#90a0b7">
                                    {project.description || "No description yet."}
                                </Text>
                                <Text color="#728198" fontSize="sm">
                                    {project.repoCount} repo · {project.memberCount} people · {project.openBugCount} open bugs · updated {formatShortDate(project.updatedAt)}
                                </Text>
                            </Stack>
                            <Button
                                borderRadius="full"
                                variant="outline"
                                borderColor="#2b3544"
                                color="#eef3fb"
                                onClick={() => onOpenProject(project.id)}
                            >
                                Open
                            </Button>
                        </Flex>
                    ))
                ) : (
                    <Stack p="6" gap="2">
                        <Text color="#f5f7fb" fontWeight="600">
                            No projects in this organization yet.
                        </Text>
                        <Text color="#90a0b7">Use the + button to add one.</Text>
                    </Stack>
                )}
            </SurfaceCard>

            <ModalFrame
                title="Add project"
                description="Each project still maps to a single GitHub repository."
                isOpen={showCreateForm}
                onClose={onToggleCreateForm}
            >
                {!isGitHubConnected ? (
                    <Stack gap="4">
                        <Text color="#d8e1ee">
                            Connect GitHub first so this project can point at a repository from day one.
                        </Text>
                        <Button borderRadius="full" bg="#2d6cdf" color="#f8fbff" onClick={onConnectGitHub}>
                            Connect GitHub
                        </Button>
                    </Stack>
                ) : (
                    <Stack
                        as="form"
                        gap="4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onCreateProject();
                        }}
                    >
                        <Input
                            value={createProjectForm.name}
                            onChange={(event) => onCreateProjectFormChange("name", event.target.value)}
                            placeholder="Client portal"
                            bg="#0f141b"
                            borderColor="#2b3544"
                            borderRadius="0"
                            color="#f5f7fb"
                        />
                        <select
                            value={createProjectForm.repositoryId}
                            style={nativeSelectStyle}
                            onChange={(event) => onCreateProjectFormChange("repositoryId", event.target.value)}
                        >
                            <option value="">Choose one repository</option>
                            {availableRepos.map((repo) => (
                                <option key={repo.id} value={repo.id}>
                                    {repo.fullName}
                                </option>
                            ))}
                        </select>
                        <Textarea
                            value={createProjectForm.description}
                            onChange={(event) => onCreateProjectFormChange("description", event.target.value)}
                            placeholder="What this project is responsible for."
                            bg="#0f141b"
                            borderColor="#2b3544"
                            borderRadius="0"
                            color="#f5f7fb"
                            minH="120px"
                        />
                        <Button
                            type="submit"
                            borderRadius="full"
                            bg="#2d6cdf"
                            color="#f8fbff"
                            disabled={isCreatingProject || !createProjectForm.repositoryId}
                        >
                            {isCreatingProject ? "Adding..." : "Add project"}
                        </Button>
                    </Stack>
                )}
            </ModalFrame>
        </Stack>
    );
}
