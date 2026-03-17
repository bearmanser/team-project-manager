import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";

import type { Notification } from "../types";
import { formatDateTime } from "../utils";
import { ActionIcon } from "./ActionIcon";
import { CloseIcon } from "./icons";
import { SurfaceCard } from "./SurfaceCard";

type NotificationPanelProps = {
    notifications: Notification[];
    onClose: () => void;
    onReadNotification: (notification: Notification) => void;
};

export function NotificationPanel({
    notifications,
    onClose,
    onReadNotification,
}: NotificationPanelProps) {
    return (
        <SurfaceCard
            position="absolute"
            top="calc(100% + 12px)"
            right="0"
            zIndex="20"
            w={{ base: "calc(100vw - 32px)", md: "380px" }}
            p="4"
        >
            <Stack gap="3">
                <Flex align="center" justify="space-between" gap="3">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Notifications
                    </Text>
                    <Button variant="ghost" color="#eef3fb" minW="8" h="8" px="0" borderRadius="lg" onClick={onClose}>
                        <ActionIcon>
                            <CloseIcon size={16} />
                        </ActionIcon>
                    </Button>
                </Flex>

                {notifications.length ? (
                    notifications.map((notification) => (
                        <Box
                            key={notification.id}
                            borderBottomWidth="1px"
                            borderColor="#273140"
                            pb="3"
                            _last={{ borderBottomWidth: "0", pb: "0" }}
                        >
                            <Stack gap="2">
                                <Text color="#f5f7fb" fontWeight={notification.isRead ? "500" : "700"}>
                                    {notification.message}
                                </Text>
                                <Flex align="center" justify="space-between" gap="3" wrap="wrap">
                                    <Text fontSize="sm" color="#90a0b7">
                                        {formatDateTime(notification.createdAt)}
                                    </Text>
                                    {!notification.isRead ? (
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            borderRadius="md"
                                            borderColor="#3a74d8"
                                            color="#dfe9ff"
                                            bg="transparent"
                                            onClick={() => onReadNotification(notification)}
                                        >
                                            Mark read
                                        </Button>
                                    ) : null}
                                </Flex>
                            </Stack>
                        </Box>
                    ))
                ) : (
                    <Text color="#90a0b7">No notifications yet.</Text>
                )}
            </Stack>
        </SurfaceCard>
    );
}
