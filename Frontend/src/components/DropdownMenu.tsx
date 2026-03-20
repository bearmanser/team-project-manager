import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Box, Button, Flex, Stack } from "@chakra-ui/react";

export type DropdownItem = {
    key?: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: "default" | "danger";
    trailingContent?: ReactNode;
    closeOnClick?: boolean;
};

type DropdownMenuProps = {
    items: DropdownItem[];
    width?: string;
    align?: "left" | "right";
    renderTrigger: (args: { isOpen: boolean; toggle: () => void; close: () => void }) => ReactNode;
};

type MenuPosition = {
    top: number;
    left?: number;
    right?: number;
};

export function DropdownMenu({
    items,
    width = "220px",
    align = "right",
    renderTrigger,
}: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function updatePosition(): void {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }

            setMenuPosition({
                top: rect.bottom + 8,
                left: align === "left" ? rect.left : undefined,
                right: align === "right" ? window.innerWidth - rect.right : undefined,
            });
        }

        function handlePointerDown(event: MouseEvent): void {
            const target = event.target as Node;
            if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
                setIsOpen(false);
            }
        }

        function handleEscape(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [align, isOpen]);

    function close(): void {
        setIsOpen(false);
    }

    function toggle(): void {
        setIsOpen((current) => !current);
    }

    const menu =
        isOpen && menuPosition
            ? createPortal(
                  <Box
                      ref={menuRef}
                      position="fixed"
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      top={`${menuPosition.top}px`}
                      right={menuPosition.right !== undefined ? `${menuPosition.right}px` : undefined}
                      left={menuPosition.left !== undefined ? `${menuPosition.left}px` : undefined}
                      w={width}
                      borderWidth="1px"
                      borderColor="var(--color-border-default)"
                      borderRadius="12px"
                      bg="var(--color-bg-muted)"
                      boxShadow="0 18px 40px rgba(3, 8, 18, 0.18)"
                      p="1.5"
                      zIndex="1400"
                  >
                      <Stack gap="1">
                          {items.map((item) => (
                              <Button
                                  key={item.key ?? item.label}
                                  justifyContent="flex-start"
                                  borderRadius="10px"
                                  variant="ghost"
                                  color={item.tone === "danger" ? "var(--color-danger-text)" : "var(--color-text-primary)"}
                                  _hover={{
                                      bg: item.tone === "danger" ? "var(--color-danger-bg-soft)" : "var(--color-bg-hover)",
                                  }}
                                  disabled={item.disabled}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                      event.stopPropagation();
                                      item.onClick();
                                      if (item.closeOnClick !== false) {
                                          close();
                                      }
                                  }}
                              >
                                  <Flex w="full" align="center" justify="space-between" gap="3">
                                      <Box as="span" flex="1" minW="0" textAlign="left" overflow="hidden" textOverflow="ellipsis">
                                          {item.label}
                                      </Box>
                                      {item.trailingContent}
                                  </Flex>
                              </Button>
                          ))}
                      </Stack>
                  </Box>,
                  document.body,
              )
            : null;

    return (
        <>
            <Box position="relative" ref={containerRef} zIndex={isOpen ? 30 : undefined}>
                {renderTrigger({ isOpen, toggle, close })}
            </Box>
            {menu}
        </>
    );
}