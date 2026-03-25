import type { ReactNode } from "react";

import { Box, Button, Flex, Text } from "@chakra-ui/react";

export function HeaderActionButton({
  isActive,
  label,
  onClick,
  children,
}: {
  isActive?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      aria-label={label}
      minW="11"
      h="11"
      px="0"
      borderRadius="12px"
      borderWidth="1px"
      borderColor={
        isActive ? "var(--color-accent-border)" : "var(--color-border-default)"
      }
      bg={isActive ? "var(--color-accent-surface)" : "var(--color-bg-muted)"}
      color="var(--color-text-primary)"
      _hover={{
        bg: isActive
          ? "var(--color-accent-surface-strong)"
          : "var(--color-bg-hover)",
        borderColor: isActive
          ? "var(--color-accent-border)"
          : "var(--color-border-strong)",
      }}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function BrandWordmark({
  size = "default",
}: {
  size?: "default" | "small";
}) {
  const words = [
    { initial: "T", rest: "eam" },
    { initial: "P", rest: "roject" },
    { initial: "M", rest: "anager" },
  ];
  const isSmall = size === "small";

  return (
    <Flex
      align="baseline"
      wrap="wrap"
      columnGap={isSmall ? { base: "1.5", md: "1.5" } : { base: "2", md: "2" }}
      rowGap="1"
      aria-label="Team Project Manager"
    >
      {words.map((word) => (
        <Text
          key={word.initial}
          display="inline-flex"
          alignItems="baseline"
          color="var(--color-text-primary)"
          lineHeight="1"
        >
          <Box
            as="span"
            fontSize={
              isSmall ? { base: "lg", md: "lg" } : { base: "3xl", md: "3xl" }
            }
            fontWeight="500"
            lineHeight="0.8"
          >
            {word.initial}
          </Box>
          <Box
            as="span"
            fontSize={
              isSmall ? { base: "xs", md: "sm" } : { base: "sm", md: "2xl" }
            }
            fontWeight="500"
          >
            {word.rest}
          </Box>
        </Text>
      ))}
    </Flex>
  );
}
