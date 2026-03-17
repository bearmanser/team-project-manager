import type { ReactNode } from "react";

import { Box, Flex } from "@chakra-ui/react";

type AppShellProps = {
  topNav: ReactNode;
  sidebar?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
};

export function AppShell({ topNav, sidebar, banner, children }: AppShellProps) {
  return (
    <Flex direction="column" minH="100vh" bg="#090d12">
      {topNav}
      {banner ? (
        <Box px={{ base: "4", lg: "8" }} py="4">
          {banner}
        </Box>
      ) : null}
      <Flex flex="1" minH="0" direction={{ base: "column", lg: "row" }}>
        {sidebar ? (
          <Box
            w={{ base: "100%", lg: "280px" }}
            borderRightWidth={{ base: "0", lg: "1px" }}
            borderBottomWidth={{ base: "1px", lg: "0" }}
            borderColor="#273140"
            bg="#0c1117"
            px={"4"}
            py="6"
          >
            {sidebar}
          </Box>
        ) : null}
        <Box
          flex="1"
          minW="0"
          px={{ base: "4", lg: "8" }}
          py="6"
          display="flex"
          flexDirection="column"
        >
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
