import { Box, Button, Grid, Heading, HStack, Input, Stack, Text } from "@chakra-ui/react";

import { PublicFooter } from "../components/PublicFooter";
import { PublicPageHeader } from "../components/PublicPageHeader";
import { SurfaceCard } from "../../../components/SurfaceCard";

type SignupPageProps = {
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
  themeMode: "light" | "dark";
  onLoginFormChange: (field: "identifier" | "password", value: string) => void;
  onSignupFormChange: (
    field: "username" | "email" | "password" | "confirmPassword",
    value: string
  ) => void;
  onNavigateHome: () => void;
  onSubmitLogin: () => void;
  onSubmitSignup: (connectGitHub: boolean) => void;
  onToggleThemeMode: () => void;
};

export function SignupPage({
  busyLabel,
  error,
  notice,
  loginForm,
  signupForm,
  themeMode,
  onLoginFormChange,
  onSignupFormChange,
  onNavigateHome,
  onSubmitLogin,
  onSubmitSignup,
  onToggleThemeMode,
}: SignupPageProps) {
  return (
    <Box
      minH="100vh"
      bg="var(--color-bg-app)"
      position="relative"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      <Box position="absolute" inset="0" pointerEvents="none" aria-hidden="true">
        <Box
          position="absolute"
          top="-160px"
          right="-120px"
          w="420px"
          h="420px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(45,108,223,0.18) 0%, rgba(45,108,223,0) 72%)"
        />
      </Box>

      <PublicPageHeader
        busyLabel={busyLabel}
        error={error}
        notice={notice}
        loginForm={loginForm}
        themeMode={themeMode}
        onLoginFormChange={onLoginFormChange}
        onNavigateHome={onNavigateHome}
        onSubmitLogin={onSubmitLogin}
        onToggleThemeMode={onToggleThemeMode}
        rightAction={
          <Button
            borderRadius="12px"
            h="11"
            px="4"
            borderWidth="1px"
            borderColor="var(--color-border-default)"
            bg="var(--color-bg-muted)"
            color="var(--color-text-primary)"
            _hover={{
              bg: "var(--color-bg-hover)",
              borderColor: "var(--color-accent-border)",
            }}
            onClick={onNavigateHome}
          >
            Home
          </Button>
        }
      />

      <Box px={{ base: "4", lg: "8" }} py={{ base: "8", lg: "10" }} flex="1">
        <Grid templateColumns={{ base: "1fr", xl: "1fr 1fr" }} gap="6" alignItems="stretch">
          <SurfaceCard p={{ base: "6", lg: "8" }}>
            <Stack gap="5">
              <Text
                fontSize="xs"
                textTransform="uppercase"
                letterSpacing="0.18em"
                color="var(--color-text-muted)"
              >
                Create your account
              </Text>
              <Heading size="2xl" color="var(--color-text-primary)">
                Start your workspace with a dedicated signup page
              </Heading>
              <Text color="var(--color-text-secondary)">
                Set up your account first, then bring your organization, projects,
                boards, bug tracking, and GitHub workflow together in one place.
              </Text>

              <Stack gap="3">
                {[
                  "Create or join an organization after signup",
                  "Keep delivery views, sprint history, and bugs connected",
                  "Connect GitHub during signup or any time afterward",
                ].map((point) => (
                  <HStack key={point} align="flex-start" gap="3">
                    <Box
                      mt="1.5"
                      w="2"
                      h="2"
                      borderRadius="full"
                      bg="var(--color-accent)"
                      flexShrink={0}
                    />
                    <Text color="var(--color-text-primary)">{point}</Text>
                  </HStack>
                ))}
              </Stack>
            </Stack>
          </SurfaceCard>

          <SurfaceCard p={{ base: "6", lg: "8" }}>
            <Stack gap="6">
              <Stack gap="2">
                <Heading size="xl" color="var(--color-text-primary)">
                  Create your team workspace
                </Heading>
                <Text color="var(--color-text-secondary)">
                  Start with account setup, then connect GitHub whenever it fits
                  your rollout.
                </Text>
              </Stack>

              {error ? (
                <Box
                  borderWidth="1px"
                  borderColor="var(--color-danger-border)"
                  bg="var(--color-danger-bg)"
                  p="2.5"
                  borderRadius="lg"
                  color="var(--color-danger-text)"
                  fontSize="sm"
                >
                  {error}
                </Box>
              ) : null}

              {notice ? (
                <Box
                  borderWidth="1px"
                  borderColor="var(--color-success-border)"
                  bg="var(--color-success-bg)"
                  p="2.5"
                  borderRadius="lg"
                  color="var(--color-success-text)"
                  fontSize="sm"
                >
                  {notice}
                </Box>
              ) : null}

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
                    onChange={(event) =>
                      onSignupFormChange("username", event.target.value)
                    }
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
                    onChange={(event) =>
                      onSignupFormChange("email", event.target.value)
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
                    value={signupForm.password}
                    onChange={(event) =>
                      onSignupFormChange("password", event.target.value)
                    }
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
                <HStack gap="3" wrap="wrap">
                  <Button
                    type="submit"
                    borderRadius="lg"
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
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
                    disabled={Boolean(busyLabel)}
                    _hover={{
                      bg: "var(--color-bg-hover)",
                      borderColor: "var(--color-accent-border)",
                    }}
                    onClick={() => onSubmitSignup(true)}
                  >
                    Create account and connect GitHub
                  </Button>
                </HStack>
              </Stack>
            </Stack>
          </SurfaceCard>
        </Grid>
      </Box>

      <PublicFooter />
    </Box>
  );
}
