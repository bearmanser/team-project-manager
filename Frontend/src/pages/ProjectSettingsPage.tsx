import { Button, Heading, Input, Link, Stack, Text, Textarea } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import type { ProjectDetail } from "../types";

type ProjectSettingsPageProps = {
    busyLabel: string | null;
    project: ProjectDetail;
    projectSettingsForm: {
        name: string;
        description: string;
    };
    onDeleteProject: () => void;
    onProjectSettingsChange: (field: "name" | "description", value: string) => void;
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
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                    Project settings
                </Text>
                <Heading size="2xl" color="#f5f7fb">
                    {project.name}
                </Heading>
                <Text color="#b0bccf" maxW="2xl">
                    Keep the essentials here: naming, description, repository reference, and deletion when the project no longer belongs in this organization.
                </Text>
            </Stack>

            <Stack gap="4">
                <SurfaceCard
                    as="form"
                    p="5"
                    bg="#0f141b"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSaveProjectSettings();
                    }}
                >
                    <Stack gap="4">
                        <Heading size="md" color="#f5f7fb">
                            Project details
                        </Heading>
                        <Input
                            value={projectSettingsForm.name}
                            onChange={(event) => onProjectSettingsChange("name", event.target.value)}
                            bg="#111720"
                            borderColor="#2b3544"
                            borderRadius="lg"
                            color="#f5f7fb"
                        />
                        <Textarea
                            value={projectSettingsForm.description}
                            onChange={(event) => onProjectSettingsChange("description", event.target.value)}
                            bg="#111720"
                            borderColor="#2b3544"
                            borderRadius="lg"
                            color="#f5f7fb"
                            minH="140px"
                        />
                        <Button type="submit" borderRadius="lg" bg="#2d6cdf" color="#f8fbff" alignSelf="flex-start">
                            {busyLabel === "Saving project settings" ? busyLabel : "Save changes"}
                        </Button>
                    </Stack>
                </SurfaceCard>

                <SurfaceCard p="5" bg="#0f141b">
                    <Stack gap="3">
                        <Heading size="md" color="#f5f7fb">
                            Connected repository
                        </Heading>
                        {primaryRepo ? (
                            <>
                                <Text color="#d8e1ee">{primaryRepo.fullName}</Text>
                                <Text color="#90a0b7">
                                    Default branch: {primaryRepo.defaultBranch} - {primaryRepo.visibility}
                                </Text>
                                <Link href={primaryRepo.htmlUrl} color="#8db4ff" target="_blank" rel="noreferrer">
                                    Open GitHub repository
                                </Link>
                            </>
                        ) : (
                            <Text color="#90a0b7">No repository connected.</Text>
                        )}
                        {project.repositories.length > 1 ? (
                            <Text color="#ffc6ce">
                                This project still has legacy multi-repo data. The interface now treats the first repo as the primary one.
                            </Text>
                        ) : null}
                    </Stack>
                </SurfaceCard>

                <SurfaceCard p="5" bg="#2a1317" borderColor="#8c3a46">
                    <Stack gap="3">
                        <Heading size="md" color="#ffe1e6">
                            Danger zone
                        </Heading>
                        <Text color="#ffc6ce">
                            Delete the entire project if it should no longer live inside this organization.
                        </Text>
                        <Button
                            borderRadius="lg"
                            variant="outline"
                            borderColor="#8c3a46"
                            color="#ffc6ce"
                            alignSelf="flex-start"
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
