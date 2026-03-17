import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";

import type { Notification } from "../types";
import { formatDateTime } from "../utils";
import { SurfaceCard } from "./SurfaceCard";

type NotificationPanelProps = {
    notifications: Notification[];
    onReadNotification: (notification: Notification) => void;
};

export function NotificationPanel({ notifications, onReadNotification }: NotificationPanelProps) {
    return (
        <SurfaceCard
            position="absolute"
            top="calc(100% + 12px)"
            right="0"
            zIndex="20"
            w={{ base: "calc(100vw - 32px)", md: "360px" }}
            p="4"
        >
            <Stack gap="3">
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                    Notifications
                </Text>
                {notifications.length ? (
                    notifications.map((notification) => (
                        <Box
                            key={notification.id}
                            borderWidth="1px"
                            borderColor={notification.isRead ? "#273140" : "#3a74d8"}
                            bg={notification.isRead ? "#0f141b" : "#111e34"}
                            p="3"
                        >
                            <Stack gap="2">
                                <Text fontWeight="600" color="#f5f7fb">
                                    {notification.message}
                                </Text>
                                <Flex align="center" justify="space-between" gap="3">
                                    <Text fontSize="sm" color="#90a0b7">
                                        {formatDateTime(notification.createdAt)}
                                    </Text>
                                    {!notification.isRead ? (
                                        <Button
                                            size="xs"
                                            variant="outline"
                                            borderRadius="0"
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
