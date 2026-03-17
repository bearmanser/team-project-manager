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
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                    Organization settings
                </Text>
                <Heading size="2xl" color="#f5f7fb">
                    {organization.name}
                </Heading>
                <Text color="#b0bccf" maxW="2xl">
                    Keep GitHub connected here and treat the organization as the parent container for every project underneath it.
                </Text>
            </Stack>

            <Stack gap="4">
                <SurfaceCard p="5" bg="#0f141b">
                    <Stack gap="3">
                        <Text color="#90a0b7" textTransform="uppercase" fontSize="xs" letterSpacing="0.14em">
                            GitHub
                        </Text>
                        <Heading size="md" color="#f5f7fb">
                            Repository source of truth
                        </Heading>
                        <Text color="#b0bccf">
                            {isGitHubConnected
                                ? "GitHub is connected, so you can add projects from available repositories."
                                : "Connect GitHub to unlock organization-backed project creation."}
                        </Text>
                        <Button borderRadius="lg" bg="#2d6cdf" color="#f8fbff" alignSelf="flex-start" onClick={onConnectGitHub}>
                            {isGitHubConnected ? "Reconnect GitHub" : "Connect GitHub"}
                        </Button>
                        {githubRepoError ? <Text color="#ffc6ce">{githubRepoError}</Text> : null}
                    </Stack>
                </SurfaceCard>

                <SurfaceCard p="5" bg="#0f141b">
                    <Stack gap="3">
                        <Text color="#90a0b7" textTransform="uppercase" fontSize="xs" letterSpacing="0.14em">
                            Structure
                        </Text>
                        <Heading size="md" color="#f5f7fb">
                            Current rules
                        </Heading>
                        <Text color="#d8e1ee">Projects belong to this organization.</Text>
                        <Text color="#d8e1ee">Boards, bugs, tasks, and settings stay inside each project.</Text>
                        <Text color="#d8e1ee">Users can span multiple projects without being duplicated.</Text>
                    </Stack>
                </SurfaceCard>
            </Stack>
        </Stack>
    );
}
