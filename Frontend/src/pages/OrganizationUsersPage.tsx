import { Grid, Heading, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import { StatusPill } from "../components/StatusPill";
import type { OrganizationUser } from "../view-models";

type OrganizationUsersPageProps = {
    isLoading: boolean;
    users: OrganizationUser[];
};

export function OrganizationUsersPage({ isLoading, users }: OrganizationUsersPageProps) {
    return (
        <Stack gap="6">
            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Stack gap="3">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Organization users
                    </Text>
                    <Heading size="2xl" color="#f5f7fb">
                        Shared team directory
                    </Heading>
                    <Text color="#b0bccf" maxW="2xl">
                        Users are managed at the organization layer so the same people can collaborate across multiple
                        projects without being re-modeled per project.
                    </Text>
                </Stack>
            </SurfaceCard>

            {isLoading ? (
                <SurfaceCard p="6" bg="#0f141b">
                    <Text color="#90a0b7">Loading organization members from project access lists...</Text>
                </SurfaceCard>
            ) : null}

            <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap="4">
                {users.map((entry) => (
                    <SurfaceCard key={entry.id} p="5" bg="#0f141b">
                        <Stack gap="4">
                            <Stack gap="2">
                                <Heading size="md" color="#f5f7fb">
                                    {entry.user.username}
                                </Heading>
                                <Text color="#d8e1ee">{entry.user.email}</Text>
                                <Text color="#90a0b7">
                                    {entry.user.githubConnected
                                        ? `GitHub connected as @${entry.user.githubUsername}`
                                        : "GitHub not connected"}
                                </Text>
                            </Stack>
                            <Stack direction="row" wrap="wrap">
                                {[...new Set(entry.roles)].map((role) => (
                                    <StatusPill key={role} label={role} />
                                ))}
                            </Stack>
                            <Stack gap="2">
                                <Text color="#90a0b7" textTransform="uppercase" fontSize="xs" letterSpacing="0.14em">
                                    Active projects
                                </Text>
                                {entry.projectNames.map((projectName) => (
                                    <Text key={projectName} color="#f5f7fb">
                                        {projectName}
                                    </Text>
                                ))}
                            </Stack>
                        </Stack>
                    </SurfaceCard>
                ))}
            </Grid>

            {!isLoading && !users.length ? (
                <SurfaceCard p="6" bg="#0f141b">
                    <Text color="#90a0b7">No organization users were discovered yet.</Text>
                </SurfaceCard>
            ) : null}
        </Stack>
    );
}
