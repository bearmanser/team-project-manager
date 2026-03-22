import { Button, Flex, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { ModalFrame } from "../components/ModalFrame";
import { PlusIcon } from "../components/icons";
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
    const canCreateProject = Boolean(createProjectForm.name.trim()) && !isCreatingProject;

    return (
        <Stack gap="6">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Projects
                    </Text>
                    <Heading size="2xl" color="var(--color-text-primary)">
                        {organization.displayName}
                    </Heading>
                </Stack>
                <Button minW="11" h="11" borderRadius="lg" bg="var(--color-accent)" color="var(--color-text-inverse)" _hover={{ bg: "var(--color-accent-hover)" }} onClick={onToggleCreateForm}>
                    <ActionIcon>
                        <PlusIcon />
                    </ActionIcon>
                </Button>
            </Flex>

            {githubRepoError ? (
                <SurfaceCard p="3" bg="var(--color-danger-bg)" borderColor="var(--color-danger-border)">
                    <Text fontSize="sm" color="var(--color-danger-text)">{githubRepoError}</Text>
                </SurfaceCard>
            ) : null}

            <SurfaceCard p="0" overflow="hidden">
                {projects.length ? (
                    projects.map((project) => (
                        <Flex
                            key={project.id}
                            px={{ base: "4", lg: "5" }}
                            py="3"
                            align={{ base: "flex-start", lg: "center" }}
                            justify="space-between"
                            gap="4"
                            wrap="wrap"
                            borderBottomWidth="1px"
                            borderColor="var(--color-border-default)"
                            _last={{ borderBottomWidth: "0" }}
                        >
                            <Stack gap="1" flex="1" minW="260px">
                                <Heading size="md" color="var(--color-text-primary)">
                                    {project.name}
                                </Heading>
                                <Text color="var(--color-text-muted)">
                                    {project.description || "No description yet."}
                                </Text>
                                <Text color="var(--color-text-subtle)" fontSize="sm">
                                    {project.repoCount} repo - {project.memberCount} people - {project.openBugCount} open bugs - updated {formatShortDate(project.updatedAt)}
                                </Text>
                            </Stack>
                            <Button
                                borderRadius="lg"
                                variant="outline"
                                borderColor="var(--color-border-strong)"
                                color="var(--color-text-primary)"
                                _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                onClick={() => onOpenProject(project.id)}
                            >
                                Open
                            </Button>
                        </Flex>
                    ))
                ) : (
                    <Stack p="6" gap="2">
                        <Text color="var(--color-text-primary)" fontWeight="600">
                            {organization.isPersonal ? "No projects in your account yet." : "No projects in this organization yet."}
                        </Text>
                        <Text color="var(--color-text-muted)">Use the add button to create one.</Text>
                    </Stack>
                )}
            </SurfaceCard>

            <ModalFrame
                title="Add project"
                description="Create the project first, then optionally connect a GitHub repository now or later."
                isOpen={showCreateForm}
                onClose={onToggleCreateForm}
            >
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
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                    />
                    <Textarea
                        value={createProjectForm.description}
                        onChange={(event) => onCreateProjectFormChange("description", event.target.value)}
                        placeholder="What this project is responsible for."
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                        minH="120px"
                    />
                    <Stack gap="2" p="3" borderRadius="lg" bg="var(--color-bg-muted)">
                        <Text color="var(--color-text-primary)" fontWeight="600">
                            GitHub repository
                        </Text>
                        {isGitHubConnected ? (
                            <>
                                <select
                                    value={createProjectForm.repositoryId}
                                    style={nativeSelectStyle}
                                    onChange={(event) => onCreateProjectFormChange("repositoryId", event.target.value)}
                                >
                                    <option value="">No repository yet</option>
                                    {availableRepos.map((repo) => (
                                        <option key={repo.id} value={repo.id}>
                                            {repo.fullName}
                                        </option>
                                    ))}
                                </select>
                                <Text color="var(--color-text-muted)" fontSize="sm">
                                    Optional. You can connect one repository now or later in project settings.
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text color="var(--color-text-muted)">
                                    GitHub is not connected yet. You can still create the project now and connect a repository later.
                                </Text>
                                <Button
                                    borderRadius="lg"
                                    variant="outline"
                                    borderColor="var(--color-border-strong)"
                                    color="var(--color-text-primary)"
                                    alignSelf="flex-start"
                                    _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                    onClick={onConnectGitHub}
                                >
                                    Connect GitHub
                                </Button>
                            </>
                        )}
                    </Stack>
                    <Button
                        type="submit"
                        borderRadius="lg"
                        bg="var(--color-accent)"
                        color="var(--color-text-inverse)"
                        alignSelf="flex-start"
                        disabled={!canCreateProject}
                        _hover={{ bg: "var(--color-accent-hover)" }}
                    >
                        {isCreatingProject ? "Adding..." : "Add project"}
                    </Button>
                </Stack>
            </ModalFrame>
        </Stack>
    );
}

