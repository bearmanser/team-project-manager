import { useEffect, useMemo, useState } from "react";

import { Box, Button, Heading, Input, Link, Stack, Text, Textarea } from "@chakra-ui/react";

import { NameConfirmModal } from "../../../components/NameConfirmModal";
import { SurfaceCard } from "../../../components/SurfaceCard";
import type { ProjectDetail, Repo } from "../../../types";
import { nativeSelectStyle } from "../../../utils";

type ProjectSettingsPageProps = {
    availableRepos: Repo[];
    busyLabel: string | null;
    githubRepoError: string | null;
    isGitHubConnected: boolean;
    project: ProjectDetail;
    projectSettingsForm: {
        name: string;
        description: string;
        useSprints: boolean;
    };
    onAddRepository: (repositoryId: string) => void;
    onConnectGitHub: () => void;
    onDeleteProject: () => void;
    onProjectSettingsChange: (field: "name" | "description" | "useSprints", value: string | boolean) => void;
    onRemoveRepository: (repositoryId: number) => void;
    onSaveProjectSettings: () => void;
};

export function ProjectSettingsPage({
    availableRepos,
    busyLabel,
    githubRepoError,
    isGitHubConnected,
    project,
    projectSettingsForm,
    onAddRepository,
    onConnectGitHub,
    onDeleteProject,
    onProjectSettingsChange,
    onRemoveRepository,
    onSaveProjectSettings,
}: ProjectSettingsPageProps) {
    const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const isOwner = project.role === "owner";
    const canManageProject = project.permissions.canManageProject;

    const connectedRepoIds = useMemo(
        () => new Set(project.repositories.map((repository) => repository.githubRepoId)),
        [project.repositories],
    );
    const connectableRepos = useMemo(
        () => availableRepos.filter((repo) => !connectedRepoIds.has(String(repo.id))),
        [availableRepos, connectedRepoIds],
    );
    const isManagingRepos = busyLabel === "Connecting repository" || busyLabel === "Disconnecting repository";

    useEffect(() => {
        setSelectedRepositoryId(connectableRepos[0] ? String(connectableRepos[0].id) : "");
    }, [connectableRepos]);

    return (
        <>
            <Stack gap="6">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Project settings
                    </Text>
                    <Heading size="2xl" color="var(--color-text-primary)">
                        {project.name}
                    </Heading>
                </Stack>

                <Stack gap="4">
                    <SurfaceCard
                        as="form"
                        p="5"
                        bg="var(--color-bg-muted)"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onSaveProjectSettings();
                        }}
                    >
                        <Stack gap="4">
                            <Heading size="md" color="var(--color-text-primary)">
                                Project details
                            </Heading>
                            <Input
                                value={projectSettingsForm.name}
                                onChange={(event) => onProjectSettingsChange("name", event.target.value)}
                                bg="var(--color-bg-card)"
                                borderColor="var(--color-border-strong)"
                                borderRadius="lg"
                                color="var(--color-text-primary)"
                                disabled={!canManageProject}
                            />
                            <Textarea
                                value={projectSettingsForm.description}
                                onChange={(event) => onProjectSettingsChange("description", event.target.value)}
                                bg="var(--color-bg-card)"
                                borderColor="var(--color-border-strong)"
                                borderRadius="lg"
                                color="var(--color-text-primary)"
                                minH="140px"
                                disabled={!canManageProject}
                            />
                            <SurfaceCard p="4" bg="var(--color-bg-card)">
                                <Stack gap="3">
                                    <Heading size="sm" color="var(--color-text-primary)">
                                        Workflow mode
                                    </Heading>
                                    <Box
                                        as="label"
                                        display="flex"
                                        alignItems="center"
                                        gap="3"
                                        color="var(--color-text-primary)"
                                        cursor="pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={projectSettingsForm.useSprints}
                                            onChange={(event) => onProjectSettingsChange("useSprints", event.target.checked)}
                                            disabled={!canManageProject}
                                        />
                                        <Text>Use sprints for scrumban planning</Text>
                                    </Box>
                                    <Text color="var(--color-text-muted)" fontSize="sm">
                                        When enabled, the board focuses on the active sprint and the tasks page splits sprint backlog from product backlog.
                                    </Text>
                                    {!canManageProject ? (
                                        <Text color="var(--color-text-muted)" fontSize="sm">
                                            Project admins and owners can update these settings.
                                        </Text>
                                    ) : null}
                                </Stack>
                            </SurfaceCard>
                            <Button type="submit" borderRadius="lg" bg="var(--color-accent)" color="var(--color-text-inverse)" alignSelf="flex-start" _hover={{ bg: "var(--color-accent-hover)" }} disabled={!canManageProject}>
                                {busyLabel === "Saving project settings" ? busyLabel : "Save changes"}
                            </Button>
                        </Stack>
                    </SurfaceCard>

                    {isOwner && githubRepoError ? (
                        <SurfaceCard p="3" bg="var(--color-danger-bg)" borderColor="var(--color-danger-border)">
                            <Text fontSize="sm" color="var(--color-danger-text)">{githubRepoError}</Text>
                        </SurfaceCard>
                    ) : null}

                    {isOwner ? (
                        <SurfaceCard p="5" bg="var(--color-bg-muted)">
                            <Stack gap="4">
                                <Stack gap="1">
                                    <Heading size="md" color="var(--color-text-primary)">
                                        Connected repository
                                    </Heading>
                                    <Text color="var(--color-text-muted)">
                                        GitHub is optional for this project. Each project can connect up to one repository for issue import and branch creation.
                                    </Text>
                                </Stack>

                                {project.repositories.length ? (
                                    project.repositories.map((repository) => (
                                        <SurfaceCard key={repository.id} p="4" bg="var(--color-bg-card)">
                                            <Stack gap="2">
                                                <Text color="var(--color-text-primary)" fontWeight="700">{repository.fullName}</Text>
                                                <Text color="var(--color-text-muted)">
                                                    Default branch: {repository.defaultBranch} - {repository.visibility}
                                                </Text>
                                                <Link href={repository.htmlUrl} color="var(--color-link)" target="_blank" rel="noreferrer">
                                                    Open GitHub repository
                                                </Link>
                                                {project.permissions.canManageRepos ? (
                                                    <Button
                                                        borderRadius="lg"
                                                        variant="outline"
                                                        borderColor="var(--color-border-strong)"
                                                        color="var(--color-text-primary)"
                                                        alignSelf="flex-start"
                                                        disabled={isManagingRepos}
                                                        _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                                        onClick={() => onRemoveRepository(repository.id)}
                                                    >
                                                        Remove repository
                                                    </Button>
                                                ) : null}
                                            </Stack>
                                        </SurfaceCard>
                                    ))
                                ) : (
                                    <Text color="var(--color-text-muted)">No repository connected yet.</Text>
                                )}

                                {project.permissions.canManageRepos && !project.repositories.length ? (
                                    <SurfaceCard p="4" bg="var(--color-bg-card)">
                                        <Stack gap="3">
                                            <Heading size="sm" color="var(--color-text-primary)">
                                                Connect repository
                                            </Heading>
                                            {!isGitHubConnected ? (
                                                <>
                                                    <Text color="var(--color-text-muted)">
                                                        Connect GitHub on your account to attach a repository to this project.
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
                                            ) : connectableRepos.length ? (
                                                <>
                                                    <select
                                                        value={selectedRepositoryId}
                                                        style={nativeSelectStyle}
                                                        onChange={(event) => setSelectedRepositoryId(event.target.value)}
                                                    >
                                                        {connectableRepos.map((repo) => (
                                                            <option key={repo.id} value={repo.id}>
                                                                {repo.fullName}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <Button
                                                        borderRadius="lg"
                                                        bg="var(--color-accent)"
                                                        color="var(--color-text-inverse)"
                                                        alignSelf="flex-start"
                                                        disabled={isManagingRepos || !selectedRepositoryId}
                                                        _hover={{ bg: "var(--color-accent-hover)" }}
                                                        onClick={() => onAddRepository(selectedRepositoryId)}
                                                    >
                                                        {busyLabel === "Connecting repository" ? busyLabel : "Connect repository"}
                                                    </Button>
                                                </>
                                            ) : (
                                                <Text color="var(--color-text-muted)">
                                                    No repositories are available from your GitHub account right now.
                                                </Text>
                                            )}
                                        </Stack>
                                    </SurfaceCard>
                                ) : null}
                            </Stack>
                        </SurfaceCard>
                    ) : null}

                    {isOwner ? (
                        <SurfaceCard p="5" bg="var(--color-danger-bg)" borderColor="var(--color-danger-border)">
                            <Stack gap="3">
                                <Heading size="md" color="var(--color-danger-heading)">
                                    Danger zone
                                </Heading>
                                <Text color="var(--color-danger-text)">
                                    Delete the entire project if it should no longer live inside this organization.
                                </Text>
                                <Button
                                    borderRadius="lg"
                                    variant="outline"
                                    borderColor="var(--color-danger-border)"
                                    color="var(--color-danger-text)"
                                    alignSelf="flex-start"
                                    _hover={{ bg: "var(--color-danger-bg-soft)", borderColor: "var(--color-danger-border)" }}
                                    onClick={() => setIsDeleteModalOpen(true)}
                                >
                                    Delete project
                                </Button>
                            </Stack>
                        </SurfaceCard>
                    ) : null}
                </Stack>
            </Stack>

            {isOwner ? (
                <NameConfirmModal
                    entityLabel="project"
                    isDeleting={busyLabel === "Deleting project"}
                    isOpen={isDeleteModalOpen}
                    name={project.name}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={onDeleteProject}
                />
            ) : null}
        </>
    );
}

