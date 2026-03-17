import { Box, Button, Flex, Grid, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";

type AuthMode = "signup" | "login";

type LoginPageProps = {
    authMode: AuthMode;
    busyLabel: string | null;
    error: string | null;
    notice: string | null;
    loginForm: {
        identifier: string;
        password: string;
    };
    signupForm: {
        username: string;
        email: string;
        password: string;
        confirmPassword: string;
    };
    onAuthModeChange: (mode: AuthMode) => void;
    onLoginFormChange: (field: "identifier" | "password", value: string) => void;
    onSignupFormChange: (
        field: "username" | "email" | "password" | "confirmPassword",
        value: string,
    ) => void;
    onSubmitLogin: () => void;
    onSubmitSignup: (connectGitHub: boolean) => void;
};

export function LoginPage({
    authMode,
    busyLabel,
    error,
    notice,
    loginForm,
    signupForm,
    onAuthModeChange,
    onLoginFormChange,
    onSignupFormChange,
    onSubmitLogin,
    onSubmitSignup,
}: LoginPageProps) {
    return (
        <Box minH="100vh" bg="#090d12" px={{ base: "4", lg: "8" }} py="8">
            <Grid templateColumns={{ base: "1fr", xl: "1.2fr 0.8fr" }} gap="6">
                <SurfaceCard p={{ base: "6", lg: "10" }}>
                    <Stack gap="8">
                        <Stack gap="3" maxW="2xl">
                            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" color="#90a0b7">
                                Dark workspace
                            </Text>
                            <Heading size="4xl" color="#f5f7fb" lineHeight="0.95">
                                Manage organizations, projects, boards, bugs, and GitHub delivery in one place.
                            </Heading>
                            <Text color="#b0bccf" fontSize="lg">
                                Teams live at the organization level, every project stays tied to one GitHub repository, and notifications stay visible across the whole workspace.
                            </Text>
                        </Stack>

                        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap="4">
                            {[
                                {
                                    title: "Organization-first access",
                                    body: "Users belong to the org so teams can move cleanly across multiple projects.",
                                },
                                {
                                    title: "Single-repo projects",
                                    body: "Each project maps to one GitHub repository for simpler ownership and traceability.",
                                },
                                {
                                    title: "Focused navigation",
                                    body: "Top-level organization views and project-specific sidebars keep the app predictable.",
                                },
                            ].map((feature) => (
                                <SurfaceCard key={feature.title} p="5" bg="#0f141b">
                                    <Stack gap="3">
                                        <Text color="#f5f7fb" fontWeight="700">
                                            {feature.title}
                                        </Text>
                                        <Text color="#90a0b7">{feature.body}</Text>
                                    </Stack>
                                </SurfaceCard>
                            ))}
                        </Grid>
                    </Stack>
                </SurfaceCard>

                <SurfaceCard p={{ base: "6", lg: "8" }}>
                    <Stack gap="6">
                        <Flex gap="2">
                            <Button
                                flex="1"
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor={authMode === "login" ? "#4b7ee8" : "#273140"}
                                bg={authMode === "login" ? "#15233b" : "#0f141b"}
                                onClick={() => onAuthModeChange("login")}
                            >
                                Login
                            </Button>
                            <Button
                                flex="1"
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor={authMode === "signup" ? "#4b7ee8" : "#273140"}
                                bg={authMode === "signup" ? "#15233b" : "#0f141b"}
                                onClick={() => onAuthModeChange("signup")}
                            >
                                Create account
                            </Button>
                        </Flex>

                        {error ? (
                            <Box borderWidth="1px" borderColor="#8c3a46" bg="#2a1317" p="2.5" borderRadius="lg" color="#ffc6ce" fontSize="sm">
                                {error}
                            </Box>
                        ) : null}
                        {notice ? (
                            <Box borderWidth="1px" borderColor="#2f6c58" bg="#0f211d" p="2.5" borderRadius="lg" color="#b7f5de" fontSize="sm">
                                {notice}
                            </Box>
                        ) : null}

                        {authMode === "login" ? (
                            <Stack
                                as="form"
                                gap="4"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    onSubmitLogin();
                                }}
                            >
                                <Stack gap="2">
                                    <Text color="#d8e1ee">Email or username</Text>
                                    <Input
                                        value={loginForm.identifier}
                                        onChange={(event) =>
                                            onLoginFormChange("identifier", event.target.value)
                                        }
                                        bg="#0f141b"
                                        borderColor="#2b3544"
                                        borderRadius="lg"
                                        color="#f5f7fb"
                                    />
                                </Stack>
                                <Stack gap="2">
                                    <Text color="#d8e1ee">Password</Text>
                                    <Input
                                        type="password"
                                        value={loginForm.password}
                                        onChange={(event) => onLoginFormChange("password", event.target.value)}
                                        bg="#0f141b"
                                        borderColor="#2b3544"
                                        borderRadius="lg"
                                        color="#f5f7fb"
                                    />
                                </Stack>
                                <Button
                                    type="submit"
                                    borderRadius="lg"
                                    bg="#2d6cdf"
                                    color="#f8fbff"
                                    alignSelf="flex-start"
                                    disabled={Boolean(busyLabel)}
                                >
                                    {busyLabel ?? "Sign in"}
                                </Button>
                            </Stack>
                        ) : (
                            <Stack
                                as="form"
                                gap="4"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    onSubmitSignup(false);
                                }}
                            >
                                <Stack gap="2">
                                    <Text color="#d8e1ee">Username</Text>
                                    <Input
                                        value={signupForm.username}
                                        onChange={(event) => onSignupFormChange("username", event.target.value)}
                                        bg="#0f141b"
                                        borderColor="#2b3544"
                                        borderRadius="lg"
                                        color="#f5f7fb"
                                    />
                                </Stack>
                                <Stack gap="2">
                                    <Text color="#d8e1ee">Email</Text>
                                    <Input
                                        type="email"
                                        value={signupForm.email}
                                        onChange={(event) => onSignupFormChange("email", event.target.value)}
                                        bg="#0f141b"
                                        borderColor="#2b3544"
                                        borderRadius="lg"
                                        color="#f5f7fb"
                                    />
                                </Stack>
                                <Stack gap="2">
                                    <Text color="#d8e1ee">Password</Text>
                                    <Input
                                        type="password"
                                        value={signupForm.password}
                                        onChange={(event) => onSignupFormChange("password", event.target.value)}
                                        bg="#0f141b"
                                        borderColor="#2b3544"
                                        borderRadius="lg"
                                        color="#f5f7fb"
                                    />
                                </Stack>
                                <Stack gap="2">
                                    <Text color="#d8e1ee">Confirm password</Text>
                                    <Input
                                        type="password"
                                        value={signupForm.confirmPassword}
                                        onChange={(event) =>
                                            onSignupFormChange("confirmPassword", event.target.value)
                                        }
                                        bg="#0f141b"
                                        borderColor="#2b3544"
                                        borderRadius="lg"
                                        color="#f5f7fb"
                                    />
                                </Stack>
                                <Button
                                    type="submit"
                                    borderRadius="lg"
                                    bg="#2d6cdf"
                                    color="#f8fbff"
                                    alignSelf="flex-start"
                                    disabled={Boolean(busyLabel)}
                                >
                                    Create account
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    borderRadius="lg"
                                    borderColor="#2b3544"
                                    color="#eef3fb"
                                    alignSelf="flex-start"
                                    disabled={Boolean(busyLabel)}
                                    onClick={() => onSubmitSignup(true)}
                                >
                                    Create account and connect GitHub
                                </Button>
                            </Stack>
                        )}

                        <Textarea
                            readOnly
                            value="Organizations hold users. Projects belong to organizations. Each project connects to one GitHub repository."
                            bg="#0f141b"
                            borderColor="#2b3544"
                            borderRadius="lg"
                            color="#90a0b7"
                            minH="88px"
                        />
                    </Stack>
                </SurfaceCard>
            </Grid>
        </Box>
    );
}
