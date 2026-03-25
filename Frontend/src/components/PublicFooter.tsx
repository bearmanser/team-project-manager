import { Box, Flex, Stack, Text } from "@chakra-ui/react";

import { BrandWordmark } from "./HeaderElements";

export function PublicFooter() {
  return (
    <Box
      as="footer"
      borderTopWidth="1px"
      borderColor="var(--color-border-default)"
      px={{ base: "4", lg: "8" }}
      py="5"
    >
      <Flex justify="space-between" align="center" gap="4" wrap="wrap">
        <Stack gap="1">
          <BrandWordmark size="small" />
          <Text color="var(--color-text-muted)" fontSize="sm">
            Crafted by Grinder Studio
          </Text>
        </Stack>
        <Stack gap="0" textAlign={{ base: "left", md: "right" }}>
          <Text
            color="var(--color-text-primary)"
            fontSize="sm"
            fontWeight="600"
          >
            Grinder Studio
          </Text>
          <Text color="var(--color-text-subtle)" fontSize="sm">
            Copyright {new Date().getFullYear()} Team Project Manager. All
            rights reserved.
          </Text>
        </Stack>
      </Flex>
    </Box>
  );
}
