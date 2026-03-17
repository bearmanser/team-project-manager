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
                        borderColor="#273140"
                        bg="#111720"
                    >
                        {user.githubAvatarUrl ? (
                            <Image src={user.githubAvatarUrl} alt={user.username} w="full" h="full" objectFit="cover" />
                        ) : null}
                    </Box>
                    <Stack gap="1">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                            Profile
                        </Text>
                        <Heading size="2xl" color="#f5f7fb">
                            {user.username}
                        </Heading>
                        <Text color="#d8e1ee">{user.email}</Text>
                    </Stack>
                </Stack>

                <Stack direction="row" wrap="wrap">
                    <StatusPill label={user.githubConnected ? "GitHub linked" : "GitHub not linked"} />
                    {organization ? <StatusPill label={organization.name} /> : null}
                </Stack>

                <Text color="#b0bccf">
                    Use this page to reconnect GitHub or sign out. The header avatar mirrors your GitHub image so profile access stays one click away.
                </Text>

                <Stack direction={{ base: "column", md: "row" }}>
                    <Button borderRadius="lg" bg="#2d6cdf" color="#f8fbff" onClick={onConnectGitHub}>
                        {user.githubConnected ? "Reconnect GitHub" : "Connect GitHub"}
                    </Button>
                    <Button
                        borderRadius="lg"
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
    );
}
