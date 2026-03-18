import type { ComponentProps } from "react";

import { Box, Flex, Spinner, Text } from "@chakra-ui/react";

type StatusAlertTone = "neutral" | "success" | "error";

type StatusAlertProps = Omit<
  ComponentProps<typeof Box>,
  "children" | "title"
> & {
  loading?: boolean;
  status: StatusAlertTone;
  title: string;
};

const toneStyles: Record<
  StatusAlertTone,
  {
    bg: string;
    borderColor: string;
    borderStartColor: string;
    color: string;
  }
> = {
  neutral: {
    bg: "var(--color-bg-muted)",
    borderColor: "var(--color-border-strong)",
    borderStartColor: "var(--color-border-soft)",
    color: "var(--color-text-primary)",
  },
  success: {
    bg: "var(--color-success-bg)",
    borderColor: "var(--color-success-border)",
    borderStartColor: "var(--color-success-border)",
    color: "var(--color-success-text)",
  },
  error: {
    bg: "var(--color-danger-bg)",
    borderColor: "var(--color-danger-border)",
    borderStartColor: "var(--color-danger-border)",
    color: "var(--color-danger-text)",
  },
};

export function StatusAlert({
  loading = false,
  status,
  title,
  ...rootProps
}: StatusAlertProps) {
  const tone = toneStyles[status];

  return (
    <Box
      borderWidth="1px"
      borderStartWidth="3px"
      borderColor={tone.borderColor}
      borderStartColor={tone.borderStartColor}
      borderRadius="lg"
      bg={tone.bg}
      color={tone.color}
      py="2.5"
      px="3"
      {...rootProps}
    >
      <Flex align="center" gap="3">
        <Flex
          align="center"
          justify="center"
          boxSize="5"
          color="inherit"
          flexShrink={0}
          aria-hidden="true"
        >
          {loading ? (
            <Spinner size="sm" color="inherit" />
          ) : (
            <Box
              boxSize="2.5"
              borderRadius="full"
              bg="currentColor"
              opacity={0.85}
            />
          )}
        </Flex>
        <Text flex="1" minW="0" fontSize="sm" fontWeight="600" color="inherit">
          {title}
        </Text>
      </Flex>
    </Box>
  );
}
