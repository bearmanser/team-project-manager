import { Button, Grid, Heading, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import { StatusPill } from "../components/StatusPill";
import type { User } from "../types";
import type { OrganizationSummary } from "../view-models";

type ProfilePageProps = {
    organization: OrganizationSummary;
    user: User;
    onConnectGitHub: () => void;
    onLogout: () => void;
};

export function ProfilePage({ organization, user, onConnectGitHub, onLogout }: ProfilePageProps) {
    return (
        <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap="6">
            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Stack gap="4">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Profile
                    </Text>
                    <Heading size="2xl" color="#f5f7fb">
                        {user.username}
                    </Heading>
                    <Text color="#d8e1ee">{user.email}</Text>
                    <Stack direction="row" wrap="wrap">
                        <StatusPill label={user.githubConnected ? "GitHub linked" : "GitHub not linked"} />
                        <StatusPill label={organization.name} />
                    </Stack>
                    <Text color="#b0bccf">
                        Use this space to reconnect GitHub, review your workspace context, or sign out.
                    </Text>
                    <Stack direction={{ base: "column", md: "row" }}>
                        <Button borderRadius="0" bg="#2d6cdf" color="#f8fbff" onClick={onConnectGitHub}>
                            {user.githubConnected ? "Reconnect GitHub" : "Connect GitHub"}
                        </Button>
                        <Button
                            borderRadius="0"
                            variant="outline"
                            borderColor="#8c3a46"
                            color="#ffc6ce"
                            onClick={onLogout}
                        >
                            Log out
                        </Button>
                    </Stack>
                </Stack>
            </SurfaceCard>

            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Stack gap="4">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Workspace snapshot
                    </Text>
                    <Heading size="lg" color="#f5f7fb">
                        {organization.projectCount} projects across {organization.repoCount} repositories
                    </Heading>
                    <Text color="#b0bccf">
                        The app now centers around organization membership and a cleaner project hierarchy so teams can
                        move faster across multiple delivery tracks.
                    </Text>
                </Stack>
            </SurfaceCard>
        </Grid>
    );
}
