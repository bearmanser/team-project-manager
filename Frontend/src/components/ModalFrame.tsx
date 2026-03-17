import type { ReactNode } from "react";

import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "./ActionIcon";
import { CloseIcon } from "./icons";
import { SurfaceCard } from "./SurfaceCard";

type ModalFrameProps = {
    title: string;
    description?: string;
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
};

export function ModalFrame({
    title,
    description,
    isOpen,
    onClose,
    children,
}: ModalFrameProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <Box position="fixed" inset="0" zIndex="40" bg="rgba(4, 7, 12, 0.82)" px="4" py="10" onClick={onClose}>
            <Flex align="center" justify="center" minH="full">
                <SurfaceCard w="full" maxW="640px" p={{ base: "5", lg: "6" }} onClick={(event) => event.stopPropagation()}>
                    <Stack gap="5">
                        <Flex align="flex-start" justify="space-between" gap="4">
                            <Stack gap="1">
                                <Heading size="lg" color="#f5f7fb">
                                    {title}
                                </Heading>
                                {description ? <Text color="#90a0b7">{description}</Text> : null}
                            </Stack>
                            <Button
                                minW="10"
                                h="10"
                                borderRadius="lg"
                                variant="ghost"
                                color="#eef3fb"
                                onClick={onClose}
                            >
                                <ActionIcon>
                                    <CloseIcon />
                                </ActionIcon>
                            </Button>
                        </Flex>
                        {children}
                    </Stack>
                </SurfaceCard>
            </Flex>
        </Box>
    );
}
