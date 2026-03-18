import { Box, Button, Heading, Image, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import { StatusPill } from "../components/StatusPill";
import type { OrganizationSummary, User } from "../types";

type ProfilePageProps = {
    organization: OrganizationSummary | null;
    user: User;
    onConnectGitHub: () => void;
    onLogout: () => void;
};

export function ProfilePage({ organization, user, onConnectGitHub, onLogout }: ProfilePageProps) {
    return (
        <SurfaceCard p={{ base: "6", lg: "8" }} maxW="720px">
            <Stack gap="5">
                <Stack direction={{ base: "column", md: "row" }} align={{ base: "flex-start", md: "center" }} gap="4">
                    <Box
                        w="20"
                        h="20"
                        borderRadius="full"
                        overflow="hidden"
                        borderWidth="1px"
                        borderColor="var(--color-border-default)"
                        bg="var(--color-bg-card)"
                    >
                        {user.githubAvatarUrl ? (
                            <Image src={user.githubAvatarUrl} alt={user.username} w="full" h="full" objectFit="cover" />
                        ) : null}
                    </Box>
                    <Stack gap="1">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                            Profile
                        </Text>
                        <Heading size="2xl" color="var(--color-text-primary)">
                            {user.username}
                        </Heading>
                        <Text color="var(--color-text-strong)">{user.email}</Text>
                    </Stack>
                </Stack>

                <Stack direction="row" wrap="wrap">
                    <StatusPill label={user.githubConnected ? "GitHub linked" : "GitHub not linked"} />
                    {organization ? <StatusPill label={organization.name} /> : null}
                </Stack>

                <Text color="var(--color-text-secondary)">
                    Use this page to reconnect GitHub or sign out. The header avatar mirrors your GitHub image so profile access stays one click away.
                </Text>

                <Stack direction={{ base: "column", md: "row" }}>
                    <Button borderRadius="lg" bg="var(--color-accent)" color="var(--color-text-inverse)" _hover={{ bg: "var(--color-accent-hover)" }} onClick={onConnectGitHub}>
                        {user.githubConnected ? "Reconnect GitHub" : "Connect GitHub"}
                    </Button>
                    <Button
                        borderRadius="lg"
                        variant="outline"
                        borderColor="var(--color-danger-border)"
                        color="var(--color-danger-text)"
                        _hover={{ bg: "var(--color-danger-bg-soft)", borderColor: "var(--color-danger-border)" }}
                        onClick={onLogout}
                    >
                        Log out
                    </Button>
                </Stack>
            </Stack>
        </SurfaceCard>
    );
}
