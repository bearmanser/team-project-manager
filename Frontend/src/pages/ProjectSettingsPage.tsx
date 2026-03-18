import { Box, Button, Heading, Input, Link, Stack, Text, Textarea } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import type { ProjectDetail } from "../types";

type ProjectSettingsPageProps = {
    busyLabel: string | null;
    project: ProjectDetail;
    projectSettingsForm: {
        name: string;
        description: string;
        useSprints: boolean;
    };
    onDeleteProject: () => void;
    onProjectSettingsChange: (field: "name" | "description" | "useSprints", value: string | boolean) => void;
    onSaveProjectSettings: () => void;
};

export function ProjectSettingsPage({
    busyLabel,
    project,
    projectSettingsForm,
    onDeleteProject,
    onProjectSettingsChange,
    onSaveProjectSettings,
}: ProjectSettingsPageProps) {
    const primaryRepo = project.repositories[0] ?? null;

    return (
        <Stack gap="6">
            <Stack gap="1">
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                    Project settings
                </Text>
                <Heading size="2xl" color="var(--color-text-primary)">
                    {project.name}
                </Heading>
                <Text color="var(--color-text-secondary)" maxW="2xl">
                    Keep the essentials here: naming, description, sprint mode, repository reference, and deletion when the project no longer belongs in this organization.
                </Text>
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
                        />
                        <Textarea
                            value={projectSettingsForm.description}
                            onChange={(event) => onProjectSettingsChange("description", event.target.value)}
                            bg="var(--color-bg-card)"
                            borderColor="var(--color-border-strong)"
                            borderRadius="lg"
                            color="var(--color-text-primary)"
                            minH="140px"
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
                                    />
                                    <Text>Use sprints for scrumban planning</Text>
                                </Box>
                                <Text color="var(--color-text-muted)" fontSize="sm">
                                    When enabled, the board focuses on the active sprint and the tasks page splits sprint backlog from product backlog.
                                </Text>
                            </Stack>
                        </SurfaceCard>
                        <Button type="submit" borderRadius="lg" bg="var(--color-accent)" color="var(--color-text-inverse)" alignSelf="flex-start" _hover={{ bg: "var(--color-accent-hover)" }}>
                            {busyLabel === "Saving project settings" ? busyLabel : "Save changes"}
                        </Button>
                    </Stack>
                </SurfaceCard>

                <SurfaceCard p="5" bg="var(--color-bg-muted)">
                    <Stack gap="3">
                        <Heading size="md" color="var(--color-text-primary)">
                            Connected repository
                        </Heading>
                        {primaryRepo ? (
                            <>
                                <Text color="var(--color-text-strong)">{primaryRepo.fullName}</Text>
                                <Text color="var(--color-text-muted)">
                                    Default branch: {primaryRepo.defaultBranch} - {primaryRepo.visibility}
                                </Text>
                                <Link href={primaryRepo.htmlUrl} color="var(--color-link)" target="_blank" rel="noreferrer">
                                    Open GitHub repository
                                </Link>
                            </>
                        ) : (
                            <Text color="var(--color-text-muted)">No repository connected.</Text>
                        )}
                        {project.repositories.length > 1 ? (
                            <Text color="var(--color-danger-text)">
                                This project still has legacy multi-repo data. The interface now treats the first repo as the primary one.
                            </Text>
                        ) : null}
                    </Stack>
                </SurfaceCard>

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
                            onClick={onDeleteProject}
                        >
                            Delete project
                        </Button>
                    </Stack>
                </SurfaceCard>
            </Stack>
        </Stack>
    );
}
