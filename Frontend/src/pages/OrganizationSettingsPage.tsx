import { Button, Heading, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import type { OrganizationSummary } from "../types";

type OrganizationSettingsPageProps = {
    githubRepoError: string | null;
    isGitHubConnected: boolean;
    organization: OrganizationSummary;
    onConnectGitHub: () => void;
};

export function OrganizationSettingsPage({
    githubRepoError,
    isGitHubConnected,
    organization,
    onConnectGitHub,
}: OrganizationSettingsPageProps) {
    return (
        <Stack gap="6">
            <Stack gap="1">
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                    Organization settings
                </Text>
                <Heading size="2xl" color="var(--color-text-primary)">
                    {organization.name}
                </Heading>
            </Stack>

            <Stack gap="4">
                <SurfaceCard p="5" bg="var(--color-bg-muted)">
                    <Stack gap="3">
                        <Text color="var(--color-text-muted)" textTransform="uppercase" fontSize="xs" letterSpacing="0.14em">
                            GitHub
                        </Text>
                        <Heading size="md" color="var(--color-text-primary)">
                            Repository source of truth
                        </Heading>
                        <Text color="var(--color-text-secondary)">
                            {isGitHubConnected
                                ? "GitHub is connected, so you can add projects from available repositories."
                                : "Connect GitHub to unlock organization-backed project creation."}
                        </Text>
                        <Button borderRadius="lg" bg="var(--color-accent)" color="var(--color-text-inverse)" alignSelf="flex-start" _hover={{ bg: "var(--color-accent-hover)" }} onClick={onConnectGitHub}>
                            {isGitHubConnected ? "Reconnect GitHub" : "Connect GitHub"}
                        </Button>
                        {githubRepoError ? <Text color="var(--color-danger-text)">{githubRepoError}</Text> : null}
                    </Stack>
                </SurfaceCard>

                <SurfaceCard p="5" bg="var(--color-bg-muted)">
                    <Stack gap="3">
                        <Text color="var(--color-text-muted)" textTransform="uppercase" fontSize="xs" letterSpacing="0.14em">
                            Structure
                        </Text>
                        <Heading size="md" color="var(--color-text-primary)">
                            Current rules
                        </Heading>
                        <Text color="var(--color-text-strong)">Projects belong to this organization.</Text>
                        <Text color="var(--color-text-strong)">Boards, bugs, tasks, and settings stay inside each project.</Text>
                        <Text color="var(--color-text-strong)">Users can span multiple projects without being duplicated.</Text>
                    </Stack>
                </SurfaceCard>
            </Stack>
        </Stack>
    );
}

