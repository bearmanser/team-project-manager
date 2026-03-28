import { useRef } from "react";

import {
  Box,
  Button,
  Grid,
  Heading,
  HStack,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react";

import { PublicFooter } from "../components/PublicFooter";
import { PublicPageHeader } from "../components/PublicPageHeader";
import { SurfaceCard } from "../../../components/SurfaceCard";
import example_image from "/example-image.png";

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
    title: "Save time",
    body: "Stop bouncing between chat, docs, boards, bug trackers, and admin pages just to move one project forward.",
  },
  {
    title: "Reduce cost",
    body: "Every feature is free, so you can organize real delivery work without adding another monthly software bill.",
  },
  {
    title: "Increase speed",
    body: "Keep planning, bugs, sprint history, and project context together so decisions happen faster and work keeps moving.",
  },
  {
    title: "Avoid headaches",
    body: "Give your team one clear place to see what is happening, who owns it, and what needs attention next.",
  },
];

const painPoints = [
  "Work is spread across too many tabs, so simple updates turn into scavenger hunts.",
  "Bugs, tasks, and sprint planning live in different places, which makes priorities fuzzy.",
  "Teams end up paying for overlapping tools and still feel disorganized.",
];

const solutionPoints = [
  "Put projects, tasks, bugs, sprint history, and settings into one shared workspace.",
  "Keep organizations and repositories connected so ownership stays obvious.",
  "Start using every feature for free, with no hidden limits waiting later.",
];

const gettingStartedSteps = [
  {
    title: "1. Create your workspace",
    body: "Sign up, add your organization, and set up a project in a few seconds.",
  },
  {
    title: "2. Organize the work",
    body: "Track tasks, bugs, and sprint progress in one place your whole team can understand.",
  },
  {
    title: "3. Keep shipping",
    body: "Move faster with one source of truth instead of stitching together multiple tools.",
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
  const benefitsSectionRef = useRef<HTMLDivElement | null>(null);
  const howItWorksSectionRef = useRef<HTMLDivElement | null>(null);

  function scrollToSection(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Box
      minH="100vh"
      bg="var(--color-bg-app)"
      position="relative"
      overflow="hidden"
    >
      <Box
        position="absolute"
        inset="0"
        pointerEvents="none"
        aria-hidden="true"
      >
        <Box
          position="absolute"
          top="-200px"
          left="-140px"
          w="1000px"
          h="1000px"
          borderRadius="full"
          filter="blur(160px)"
          bg="radial-gradient(circle, rgba(45,108,223,0.45) 0%, rgba(45,108,223,0) 85%)"
        />
        <Box
          position="absolute"
          top="-200px"
          right="-140px"
          w="1000px"
          h="1000px"
          borderRadius="full"
          filter="blur(160px)"
          bg="radial-gradient(circle, rgba(45,108,223,0.45) 0%, rgba(45,108,223,0) 85%)"
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

      <Box
        px={{ base: "4", lg: "8" }}
        py={{ base: "8", lg: "10" }}
        position="relative"
      >
        <Stack gap={{ base: "6", lg: "8" }}>
          <SurfaceCard
            p={{ base: "6", lg: "10" }}
            bg="linear-gradient(180deg, color-mix(in srgb, var(--color-bg-card) 94%, var(--color-accent) 6%), var(--color-bg-card))"
          >
            <Grid
              templateColumns={{
                base: "1fr",
                xl: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
              }}
              gap={{ base: "8", xl: "10" }}
              alignItems="center"
            >
              <Stack gap="6" maxW="3xl">
                <Stack gap="4">
                  <Text
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="0.18em"
                    color="var(--color-text-muted)"
                  >
                    Free project management for product teams
                  </Text>
                  <Heading
                    size="4xl"
                    color="var(--color-text-primary)"
                    lineHeight={{ base: "1.02", lg: "0.96" }}
                  >
                    Run projects, bugs, and sprint work in one place.
                  </Heading>
                  <Text
                    color="var(--color-text-secondary)"
                    fontSize="lg"
                    maxW="2xl"
                  >
                    Team Project Manager gives small product and engineering
                    teams one free workspace to stay organized, move faster, and
                    ship without the usual tool chaos.
                  </Text>
                </Stack>

                <SurfaceCard
                  p="4"
                  bg="color-mix(in srgb, var(--color-accent-surface) 76%, var(--color-bg-card))"
                  maxW="xl"
                >
                  <Text
                    color="var(--color-text-primary)"
                    fontWeight="700"
                    mb="1"
                  >
                    Completely free
                  </Text>
                  <Text color="var(--color-text-secondary)">
                    Every feature is available from day one, and there are no
                    hidden costs, upgrade traps, or surprise limits.
                  </Text>
                </SurfaceCard>

                <HStack gap="3" wrap="wrap">
                  <Button
                    borderRadius="12px"
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
                    _hover={{ bg: "var(--color-accent-hover)" }}
                    onClick={onNavigateToSignup}
                  >
                    Create your free workspace
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
                    onClick={() => scrollToSection(howItWorksSectionRef)}
                  >
                    See how it works
                  </Button>
                </HStack>
              </Stack>

              <SurfaceCard
                p={{ base: "4", lg: "5" }}
                bg="color-mix(in srgb, var(--color-bg-muted) 92%, transparent)"
              >
                <Stack gap="4">
                  <Text
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="0.18em"
                    color="var(--color-text-muted)"
                  >
                    Example project view
                  </Text>
                  <Image
                    src={example_image}
                    alt="Example project workspace in Team Project Manager"
                    w="full"
                    borderRadius="10px"
                    borderWidth="1px"
                    borderColor="var(--color-border-default)"
                    bg="var(--color-bg-panel)"
                  />
                  <Text color="var(--color-text-secondary)">
                    This is the kind of clean, shared project view your team
                    gets right away, with no paid tier required.
                  </Text>
                </Stack>
              </SurfaceCard>
            </Grid>
          </SurfaceCard>

          <Grid templateColumns={{ base: "1fr", xl: "repeat(2, 1fr)" }} gap="6">
            <SurfaceCard p={{ base: "6", lg: "8" }}>
              <Stack gap="5">
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="0.18em"
                  color="var(--color-text-muted)"
                >
                  What sucks right now
                </Text>
                <Heading size="xl" color="var(--color-text-primary)">
                  Managing projects should not feel like babysitting five tools.
                </Heading>
                <Stack gap="3">
                  {painPoints.map((point) => (
                    <HStack key={point} align="flex-start" gap="3">
                      <Box
                        mt="1.5"
                        w="2"
                        h="2"
                        borderRadius="full"
                        bg="var(--color-accent)"
                        flexShrink={0}
                      />
                      <Text color="var(--color-text-secondary)">{point}</Text>
                    </HStack>
                  ))}
                </Stack>
              </Stack>
            </SurfaceCard>

            <SurfaceCard p={{ base: "6", lg: "8" }}>
              <Stack gap="5">
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="0.18em"
                  color="var(--color-text-muted)"
                >
                  Here&apos;s how we fix it
                </Text>
                <Heading size="xl" color="var(--color-text-primary)">
                  One free workspace that keeps the whole delivery picture
                  together.
                </Heading>
                <Stack gap="3">
                  {solutionPoints.map((point) => (
                    <HStack key={point} align="flex-start" gap="3">
                      <Box
                        mt="1.5"
                        w="2"
                        h="2"
                        borderRadius="full"
                        bg="var(--color-accent)"
                        flexShrink={0}
                      />
                      <Text color="var(--color-text-secondary)">{point}</Text>
                    </HStack>
                  ))}
                </Stack>
              </Stack>
            </SurfaceCard>
          </Grid>

          <SurfaceCard
            ref={benefitsSectionRef}
            p={{ base: "6", lg: "8" }}
            bg="color-mix(in srgb, var(--color-bg-card) 96%, var(--color-accent) 4%)"
          >
            <Stack gap="6">
              <Stack gap="3" maxW="2xl">
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="0.18em"
                  color="var(--color-text-muted)"
                >
                  Why teams choose it
                </Text>
                <Heading size="xl" color="var(--color-text-primary)">
                  The payoff is simple.
                </Heading>
                <Text color="var(--color-text-secondary)">
                  Teams care about fewer delays, fewer subscriptions, and fewer
                  messy handoffs. That is the point.
                </Text>
              </Stack>

              <Grid
                templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
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
                      <Text color="var(--color-text-muted)">
                        {feature.body}
                      </Text>
                    </Stack>
                  </SurfaceCard>
                ))}
              </Grid>
            </Stack>
          </SurfaceCard>

          <SurfaceCard ref={howItWorksSectionRef} p={{ base: "6", lg: "8" }}>
            <Stack gap="6">
              <Stack gap="3" maxW="2xl">
                <Text
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="0.18em"
                  color="var(--color-text-muted)"
                >
                  How it works
                </Text>
                <Heading size="xl" color="var(--color-text-primary)">
                  Get started without overthinking it.
                </Heading>
                <Text color="var(--color-text-secondary)">
                  Set up the workspace, add the work, and keep shipping. That is
                  the mental model.
                </Text>
              </Stack>

              <Grid
                templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
                gap="4"
              >
                {gettingStartedSteps.map((step) => (
                  <SurfaceCard
                    key={step.title}
                    p="5"
                    bg="color-mix(in srgb, var(--color-bg-muted) 92%, transparent)"
                  >
                    <Stack gap="3">
                      <Text color="var(--color-text-primary)" fontWeight="700">
                        {step.title}
                      </Text>
                      <Text color="var(--color-text-secondary)">
                        {step.body}
                      </Text>
                    </Stack>
                  </SurfaceCard>
                ))}
              </Grid>
            </Stack>
          </SurfaceCard>

          <SurfaceCard p={{ base: "6", lg: "8" }}>
            <Stack gap="5" align={{ base: "stretch", md: "flex-start" }}>
              <Text
                fontSize="xs"
                textTransform="uppercase"
                letterSpacing="0.18em"
                color="var(--color-text-muted)"
              >
                Start free
              </Text>
              <Heading size="2xl" color="var(--color-text-primary)" maxW="2xl">
                Create your free workspace and keep every feature from day one.
              </Heading>
              <Text color="var(--color-text-secondary)" maxW="2xl">
                No hidden costs, no surprise upgrade wall, and no reason to wait
                until your process gets messier.
              </Text>
              <HStack gap="3" wrap="wrap">
                <Button
                  borderRadius="12px"
                  bg="var(--color-accent)"
                  color="var(--color-text-inverse)"
                  _hover={{ bg: "var(--color-accent-hover)" }}
                  onClick={onNavigateToSignup}
                >
                  Create your free workspace
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
                  onClick={() => scrollToSection(benefitsSectionRef)}
                >
                  Review the benefits
                </Button>
              </HStack>
            </Stack>
          </SurfaceCard>
        </Stack>
      </Box>

      <PublicFooter />
    </Box>
  );
}
