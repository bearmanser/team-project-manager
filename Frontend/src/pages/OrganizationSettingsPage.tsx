import { Button, Grid, Heading, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import type { OrganizationSummary } from "../view-models";

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
            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Stack gap="3">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Organization settings
                    </Text>
                    <Heading size="2xl" color="#f5f7fb">
                        {organization.name}
                    </Heading>
                    <Text color="#b0bccf" maxW="2xl">
                        This frontend now treats the organization as the owner of people and the parent of projects.
                        Project access stays lean, and repository ownership remains one project to one repo.
                    </Text>
                </Stack>
            </SurfaceCard>

            <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap="4">
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
                                ? "GitHub is connected. New projects can be created from your available repositories."
                                : "Connect GitHub to unlock project creation and repository-backed delivery flows."}
                        </Text>
                        <Button borderRadius="0" bg="#2d6cdf" color="#f8fbff" onClick={onConnectGitHub}>
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
                            Current workspace rules
                        </Heading>
                        <Text color="#d8e1ee">Users belong to the organization.</Text>
                        <Text color="#d8e1ee">Projects live inside the organization.</Text>
                        <Text color="#d8e1ee">Each project is connected to one GitHub repository.</Text>
                        <Text color="#d8e1ee">Boards, bugs, tasks, and project settings stay inside the project.</Text>
                    </Stack>
                </SurfaceCard>
            </Grid>
        </Stack>
    );
}
