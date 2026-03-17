import { Flex, Heading, Stack, Text } from "@chakra-ui/react";

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
            <Stack gap="1">
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                    Organization users
                </Text>
                <Heading size="2xl" color="#f5f7fb">
                    Shared team directory
                </Heading>
                <Text color="#b0bccf" maxW="2xl">
                    People show up once here and can still participate across multiple projects underneath the same organization.
                </Text>
            </Stack>

            {isLoading ? (
                <SurfaceCard p="6" bg="#0f141b">
                    <Text color="#90a0b7">Loading people from project memberships...</Text>
                </SurfaceCard>
            ) : null}

            {!isLoading ? (
                <SurfaceCard p="0" overflow="hidden">
                    {users.length ? (
                        users.map((entry) => (
                            <Flex
                                key={entry.id}
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
                                    <Heading size="sm" color="#f5f7fb">
                                        {entry.user.username}
                                    </Heading>
                                    <Text color="#90a0b7">
                                        {entry.user.email}
                                        {entry.user.githubConnected && entry.user.githubUsername
                                            ? ` · GitHub @${entry.user.githubUsername}`
                                            : " · GitHub not connected"}
                                        {entry.projectNames.length
                                            ? ` · ${entry.projectNames.join(", ")}`
                                            : " · No projects yet"}
                                    </Text>
                                </Stack>
                                <Flex gap="2" wrap="wrap">
                                    {[...new Set(entry.roles)].map((role) => (
                                        <StatusPill key={role} label={role} />
                                    ))}
                                </Flex>
                            </Flex>
                        ))
                    ) : (
                        <Stack p="6" gap="2">
                            <Text color="#f5f7fb" fontWeight="600">
                                No people discovered yet.
                            </Text>
                            <Text color="#90a0b7">Once projects exist, their members will appear here.</Text>
                        </Stack>
                    )}
                </SurfaceCard>
            ) : null}
        </Stack>
    );
}
