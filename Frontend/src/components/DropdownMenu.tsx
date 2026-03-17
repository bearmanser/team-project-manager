import { useEffect, useRef, useState, type ReactNode } from "react";

import { Box, Button, Stack } from "@chakra-ui/react";

export type DropdownItem = {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    tone?: "default" | "danger";
};

type DropdownMenuProps = {
    items: DropdownItem[];
    width?: string;
    align?: "left" | "right";
    renderTrigger: (args: { isOpen: boolean; toggle: () => void; close: () => void }) => ReactNode;
};

export function DropdownMenu({
    items,
    width = "220px",
    align = "right",
    renderTrigger,
}: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function handlePointerDown(event: MouseEvent): void {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function handleEscape(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [isOpen]);

    function close(): void {
        setIsOpen(false);
    }

    function toggle(): void {
        setIsOpen((current) => !current);
    }

    return (
        <Box position="relative" ref={containerRef}>
            {renderTrigger({ isOpen, toggle, close })}
            {isOpen ? (
                <Box
                    position="absolute"
                    top="calc(100% + 8px)"
                    right={align === "right" ? "0" : undefined}
                    left={align === "left" ? "0" : undefined}
                    w={width}
                    borderWidth="1px"
                    borderColor="#273140"
                    borderRadius="12px"
                    bg="#0f141b"
                    boxShadow="0 18px 40px rgba(3, 8, 18, 0.45)"
                    p="1.5"
                    zIndex="20"
                >
                    <Stack gap="1">
                        {items.map((item) => (
                            <Button
                                key={item.label}
                                justifyContent="flex-start"
                                borderRadius="10px"
                                variant="ghost"
                                color={item.tone === "danger" ? "#ffb8c6" : "#eef3fb"}
                                _hover={{
                                    bg: item.tone === "danger" ? "#34161b" : "#161e2a",
                                }}
                                disabled={item.disabled}
                                onClick={() => {
                                    item.onClick();
                                    close();
                                }}
                            >
                                {item.label}
                            </Button>
                        ))}
                    </Stack>
                </Box>
            ) : null}
        </Box>
    );
}
