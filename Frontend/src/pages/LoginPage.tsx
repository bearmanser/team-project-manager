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
        <Box minH="100vh" bg="var(--color-bg-app)" px={{ base: "4", lg: "8" }} py="8">
            <Grid templateColumns={{ base: "1fr", xl: "1.2fr 0.8fr" }} gap="6">
                <SurfaceCard p={{ base: "6", lg: "10" }}>
                    <Stack gap="8">
                        <Stack gap="3" maxW="2xl">
                            <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" color="var(--color-text-muted)">
                                Workspace mode
                            </Text>
                            <Heading size="4xl" color="var(--color-text-primary)" lineHeight="0.95">
                                Manage organizations, projects, boards, bugs, and GitHub delivery in one place.
                            </Heading>
                            <Text color="var(--color-text-secondary)" fontSize="lg">
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
                                <SurfaceCard key={feature.title} p="5" bg="var(--color-bg-muted)">
                                    <Stack gap="3">
                                        <Text color="var(--color-text-primary)" fontWeight="700">
                                            {feature.title}
                                        </Text>
                                        <Text color="var(--color-text-muted)">{feature.body}</Text>
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
                                borderColor={authMode === "login" ? "var(--color-accent-border)" : "var(--color-border-default)"}
                                bg={authMode === "login" ? "var(--color-accent-surface-strong)" : "var(--color-bg-muted)"}
                                color="var(--color-text-primary)"
                                _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                onClick={() => onAuthModeChange("login")}
                            >
                                Login
                            </Button>
                            <Button
                                flex="1"
                                borderRadius="lg"
                                borderWidth="1px"
                                borderColor={authMode === "signup" ? "var(--color-accent-border)" : "var(--color-border-default)"}
                                bg={authMode === "signup" ? "var(--color-accent-surface-strong)" : "var(--color-bg-muted)"}
                                color="var(--color-text-primary)"
                                _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                onClick={() => onAuthModeChange("signup")}
                            >
                                Create account
                            </Button>
                        </Flex>

                        {error ? (
                            <Box borderWidth="1px" borderColor="var(--color-danger-border)" bg="var(--color-danger-bg)" p="2.5" borderRadius="lg" color="var(--color-danger-text)" fontSize="sm">
                                {error}
                            </Box>
                        ) : null}
                        {notice ? (
                            <Box borderWidth="1px" borderColor="var(--color-success-border)" bg="var(--color-success-bg)" p="2.5" borderRadius="lg" color="var(--color-success-text)" fontSize="sm">
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
                                    <Text color="var(--color-text-strong)">Email or username</Text>
                                    <Input
                                        value={loginForm.identifier}
                                        onChange={(event) =>
                                            onLoginFormChange("identifier", event.target.value)
                                        }
                                        bg="var(--color-bg-muted)"
                                        borderColor="var(--color-border-strong)"
                                        borderRadius="lg"
                                        color="var(--color-text-primary)"
                                    />
                                </Stack>
                                <Stack gap="2">
                                    <Text color="var(--color-text-strong)">Password</Text>
                                    <Input
                                        type="password"
                                        value={loginForm.password}
                                        onChange={(event) => onLoginFormChange("password", event.target.value)}
                                        bg="var(--color-bg-muted)"
                                        borderColor="var(--color-border-strong)"
                                        borderRadius="lg"
                                        color="var(--color-text-primary)"
                                    />
                                </Stack>
                                <Button
                                    type="submit"
                                    borderRadius="lg"
                                    bg="var(--color-accent)"
                                    color="var(--color-text-inverse)"
                                    alignSelf="flex-start"
                                    disabled={Boolean(busyLabel)}
                                    _hover={{ bg: "var(--color-accent-hover)" }}
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
                                    <Text color="var(--color-text-strong)">Username</Text>
                                    <Input
                                        value={signupForm.username}
                                        onChange={(event) => onSignupFormChange("username", event.target.value)}
                                        bg="var(--color-bg-muted)"
                                        borderColor="var(--color-border-strong)"
                                        borderRadius="lg"
                                        color="var(--color-text-primary)"
                                    />
                                </Stack>
                                <Stack gap="2">
                                    <Text color="var(--color-text-strong)">Email</Text>
                                    <Input
                                        type="email"
                                        value={signupForm.email}
                                        onChange={(event) => onSignupFormChange("email", event.target.value)}
                                        bg="var(--color-bg-muted)"
                                        borderColor="var(--color-border-strong)"
                                        borderRadius="lg"
                                        color="var(--color-text-primary)"
                                    />
                                </Stack>
                                <Stack gap="2">
                                    <Text color="var(--color-text-strong)">Password</Text>
                                    <Input
                                        type="password"
                                        value={signupForm.password}
                                        onChange={(event) => onSignupFormChange("password", event.target.value)}
                                        bg="var(--color-bg-muted)"
                                        borderColor="var(--color-border-strong)"
                                        borderRadius="lg"
                                        color="var(--color-text-primary)"
                                    />
                                </Stack>
                                <Stack gap="2">
                                    <Text color="var(--color-text-strong)">Confirm password</Text>
                                    <Input
                                        type="password"
                                        value={signupForm.confirmPassword}
                                        onChange={(event) =>
                                            onSignupFormChange("confirmPassword", event.target.value)
                                        }
                                        bg="var(--color-bg-muted)"
                                        borderColor="var(--color-border-strong)"
                                        borderRadius="lg"
                                        color="var(--color-text-primary)"
                                    />
                                </Stack>
                                <Button
                                    type="submit"
                                    borderRadius="lg"
                                    bg="var(--color-accent)"
                                    color="var(--color-text-inverse)"
                                    alignSelf="flex-start"
                                    disabled={Boolean(busyLabel)}
                                    _hover={{ bg: "var(--color-accent-hover)" }}
                                >
                                    Create account
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    borderRadius="lg"
                                    borderColor="var(--color-border-strong)"
                                    color="var(--color-text-primary)"
                                    alignSelf="flex-start"
                                    disabled={Boolean(busyLabel)}
                                    _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                    onClick={() => onSubmitSignup(true)}
                                >
                                    Create account and connect GitHub
                                </Button>
                            </Stack>
                        )}

                        <Textarea
                            readOnly
                            value="Organizations hold users. Projects belong to organizations. Each project connects to one GitHub repository."
                            bg="var(--color-bg-muted)"
                            borderColor="var(--color-border-strong)"
                            borderRadius="lg"
                            color="var(--color-text-muted)"
                            minH="88px"
                        />
                    </Stack>
                </SurfaceCard>
            </Grid>
        </Box>
    );
}
