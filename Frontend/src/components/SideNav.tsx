import type { ReactNode } from "react";

import { Box, Button, Stack, Text } from "@chakra-ui/react";

import type { NavItem } from "../view-models";

type SideNavProps<T extends string> = {
  items: NavItem<T>[];
  activeItem: T;
  onSelect: (item: T) => void;
  topSlot?: ReactNode;
  footerSlot?: ReactNode;
};

export function SideNav<T extends string>({
  items,
  activeItem,
  onSelect,
  topSlot,
  footerSlot,
}: SideNavProps<T>) {
  return (
    <Stack gap="6" h="full">
      {topSlot}

      <Stack gap="1">
        {items.map((item) => (
          <Button
            key={item.id}
            justifyContent="flex-start"
            h="auto"
            py="3"
            px="0"
            borderRadius="0"
            variant="ghost"
            borderWidth="0px"
            borderBottomWidth="2px"
            borderColor={activeItem === item.id ? "#f5f7fb" : "transparent"}
            color={activeItem === item.id ? "#f5f7fb" : "#90a0b7"}
            whiteSpace="normal"
            textAlign="left"
            _hover={{
              bg: "transparent",
              color: "#eef3fb",
              borderColor: activeItem === item.id ? "#f5f7fb" : "#728198",
            }}
            onClick={() => onSelect(item.id)}
          >
            <Stack align="flex-start" gap="0" w="full">
              <Text>{item.label}</Text>
              <Text fontSize="xs" color="#728198">
                {item.description}
              </Text>
            </Stack>
          </Button>
        ))}
      </Stack>

      {footerSlot ? <Box mt="auto">{footerSlot}</Box> : null}
    </Stack>
  );
}
