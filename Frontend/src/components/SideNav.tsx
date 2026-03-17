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

      <Stack gap="2">
        {items.map((item) => (
          <Button
            key={item.id}
            justifyContent="flex-start"
            h="auto"
            py="3"
            px="4"
            borderRadius="0"
            borderWidth="1px"
            borderColor={activeItem === item.id ? "#4b7ee8" : "#273140"}
            bg={activeItem === item.id ? "#15233b" : "#0f141b"}
            color="#eef3fb"
            onClick={() => onSelect(item.id)}
          >
            <Stack align="flex-start" gap="1">
              <Text>{item.label}</Text>
              <Text fontSize="xs" color="#90a0b7">
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
