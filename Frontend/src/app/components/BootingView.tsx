import { Box, Heading, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../../components/SurfaceCard";

type BootingViewProps = {
  busyLabel: string | null;
};

export function BootingView({ busyLabel }: BootingViewProps) {
  return (
    <Box
      minH="100vh"
      bg="var(--color-bg-app)"
      display="grid"
      placeItems="center"
      px="4"
    >
      <SurfaceCard p={{ base: "6", lg: "10" }} w="full" maxW="640px">
        <Stack gap="3">
          <Text
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="0.18em"
            color="var(--color-text-muted)"
          >
            Team Project Manager
          </Text>
          <Heading size="2xl" color="var(--color-text-primary)">
            Preparing your workspace
          </Heading>
          <Text color="var(--color-text-secondary)">
            {busyLabel ?? "Loading authentication state..."}
          </Text>
        </Stack>
      </SurfaceCard>
    </Box>
  );
}
