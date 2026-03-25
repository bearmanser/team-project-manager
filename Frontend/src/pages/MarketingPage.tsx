import { useRef } from "react";

import { Box, Button, Grid, Heading, HStack, Stack, Text } from "@chakra-ui/react";

import { PublicFooter } from "../components/PublicFooter";
import { PublicPageHeader } from "../components/PublicPageHeader";
import { SurfaceCard } from "../components/SurfaceCard";

type MarketingPageProps = {
  busyLabel: string | null;
  error: string | null;
  notice: string | null;
  loginForm: {
    identifier: string;
    password: string;
  };
  themeMode: "light" | "dark";
  onLoginFormChange: (field: "identifier" | "password", value: string) => void;
  onNavigateHome: () => void;
  onNavigateToSignup: () => void;
  onSubmitLogin: () => void;
  onToggleThemeMode: () => void;
};

const featureHighlights = [
  {
    title: "One place for delivery work",
    body: "Run planning, active delivery, bug tracking, sprint history, and project settings from one shared workspace.",
  },
  {
    title: "Organizations stay in control",
    body: "Users belong to organizations, which makes access cleaner across multiple products and teams.",
  },
  {
    title: "GitHub stays connected",
    body: "Projects map to repositories so your team can tie backlog items to real engineering work without extra glue.",
  },
];

const spotlights = [
  {
    eyebrow: "Best feature",
    title: "Project views that match how teams actually work",
    body: "Switch between board, task, bug, sprint history, and settings views without losing the thread of the project. The app keeps organization context and project detail close together, so planning and execution happen in the same rhythm.",
    points: [
      "Kanban-style board for active work",
      "Dedicated bugs workspace alongside tasks",
      "Sprint history and project settings in the same flow",
    ],
  },
  {
    eyebrow: "Why teams use it",
    title: "Clear ownership from org to repo",
    body: "Every project belongs to one organization and can be tied to one GitHub repository. That structure makes responsibility obvious, reduces setup noise, and gives teams a cleaner path from idea to shipped work.",
    points: [
      "Organization-first user management",
      "Single-repository project ownership",
      "Notifications visible across the workspace",
    ],
  },
];

export function MarketingPage({
  busyLabel,
  error,
  notice,
  loginForm,
  themeMode,
  onLoginFormChange,
  onNavigateHome,
  onNavigateToSignup,
  onSubmitLogin,
  onToggleThemeMode,
}: MarketingPageProps) {
  const featureSectionRef = useRef<HTMLDivElement | null>(null);
  const proofSectionRef = useRef<HTMLDivElement | null>(null);

  function scrollToSection(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Box minH="100vh" bg="var(--color-bg-app)" position="relative" overflow="hidden">
      <Box position="absolute" inset="0" pointerEvents="none" aria-hidden="true">
        <Box
          position="absolute"
          top="-180px"
          left="-120px"
          w="420px"
          h="420px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(45,108,223,0.22) 0%, rgba(45,108,223,0) 72%)"
        />
        <Box
          position="absolute"
          top="120px"
          right="-120px"
          w="380px"
          h="380px"
          borderRadius="full"
          bg="radial-gradient(circle, rgba(89,155,255,0.12) 0%, rgba(89,155,255,0) 72%)"
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
            bg="var(--color-accent)"
            color="var(--color-text-inverse)"
            _hover={{ bg: "var(--color-accent-hover)" }}
            onClick={onNavigateToSignup}
          >
            Sign up
          </Button>
        }
      />

      <Box px={{ base: "4", lg: "8" }} py={{ base: "8", lg: "10" }} position="relative">
        <Stack gap={{ base: "6", lg: "8" }}>
          <SurfaceCard
            p={{ base: "6", lg: "10" }}
            bg="linear-gradient(180deg, color-mix(in srgb, var(--color-bg-card) 94%, var(--color-accent) 6%), var(--color-bg-card))"
          >
            <Stack gap="8">
              <Stack gap="5" maxW="3xl">
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="0.18em"
                  color="var(--color-text-muted)"
                >
                  Delivery workspace for product teams
                </Text>
                <Heading
                  size="4xl"
                  color="var(--color-text-primary)"
                  lineHeight={{ base: "1.02", lg: "0.96" }}
                >
                  Plan, ship, and track work without splitting your team across five tools.
                </Heading>
                <Text color="var(--color-text-secondary)" fontSize="lg" maxW="2xl">
                  Team Project Manager keeps organizations, projects, boards, bugs,
                  sprint history, and GitHub-aware delivery in one calm workspace so
                  teams can move faster with less overhead.
                </Text>
                <HStack gap="3" wrap="wrap">
                  <Button
                    borderRadius="12px"
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
                    _hover={{ bg: "var(--color-accent-hover)" }}
                    onClick={() => scrollToSection(featureSectionRef)}
                  >
                    Explore features
                  </Button>
                  <Button
                    borderRadius="12px"
                    variant="outline"
                    borderColor="var(--color-border-strong)"
                    color="var(--color-text-primary)"
                    _hover={{
                      bg: "var(--color-bg-hover)",
                      borderColor: "var(--color-accent-border)",
                    }}
                    onClick={() => scrollToSection(proofSectionRef)}
                  >
                    Why teams use it
                  </Button>
                </HStack>
              </Stack>

              <Grid
                ref={featureSectionRef}
                templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
                gap="4"
              >
                {featureHighlights.map((feature) => (
                  <SurfaceCard
                    key={feature.title}
                    p="5"
                    bg="color-mix(in srgb, var(--color-bg-muted) 92%, transparent)"
                  >
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

          <Grid
            ref={proofSectionRef}
            templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }}
            gap="6"
          >
            {spotlights.map((spotlight) => (
              <SurfaceCard key={spotlight.title} p={{ base: "6", lg: "8" }}>
                <Stack gap="5">
                  <Text
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="0.18em"
                    color="var(--color-text-muted)"
                  >
                    {spotlight.eyebrow}
                  </Text>
                  <Heading size="xl" color="var(--color-text-primary)">
                    {spotlight.title}
                  </Heading>
                  <Text color="var(--color-text-secondary)">
                    {spotlight.body}
                  </Text>
                  <Stack gap="3">
                    {spotlight.points.map((point) => (
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
            ))}
          </Grid>
        </Stack>
      </Box>

      <PublicFooter />
    </Box>
  );
}
