import { Box, Button, Flex, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "../../../components/ActionIcon";
import { CloseIcon } from "../../../components/icons";
import { SurfaceCard } from "../../../components/SurfaceCard";
import type { Notification } from "../../../types";
import { formatDateTime } from "../../../utils";

type NotificationPanelProps = {
    notifications: Notification[];
    onAcceptNotification: (notification: Notification) => void;
    onClose: () => void;
    onOpenNotification: (notification: Notification) => void;
    onReadNotification: (notification: Notification) => void;
};

export function NotificationPanel({
    notifications,
    onAcceptNotification,
    onClose,
    onOpenNotification,
    onReadNotification,
}: NotificationPanelProps) {
    return (
        <SurfaceCard
            position="absolute"
            top="calc(100% + 12px)"
            right="0"
            zIndex="50"
            w={{ base: "calc(100vw - 32px)", md: "380px" }}
            p="4"
        >
            <Stack gap="3">
                <Flex align="center" justify="space-between" gap="3">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Notifications
                    </Text>
                    <Button
                        variant="ghost"
                        color="var(--color-text-primary)"
                        minW="8"
                        h="8"
                        px="0"
                        borderRadius="lg"
                        _hover={{ bg: "var(--color-bg-hover)" }}
                        onClick={onClose}
                    >
                        <ActionIcon>
                            <CloseIcon size={16} />
                        </ActionIcon>
                    </Button>
                </Flex>

                {notifications.length ? (
                    notifications.map((notification) => {
                        const isOpenable =
                            notification.projectId !== null &&
                            (notification.taskId !== null || notification.bugReportId !== null);

                        return (
                        <Box
                            key={notification.id}
                            borderBottomWidth="1px"
                            borderColor="var(--color-border-default)"
                            pb="3"
                            _last={{ borderBottomWidth: "0", pb: "0" }}
                            cursor={isOpenable ? "pointer" : "default"}
                            borderRadius="lg"
                            px="2"
                            mx="-2"
                            transition="background-color 0.2s ease"
                            _hover={
                                isOpenable
                                    ? { bg: "var(--color-bg-hover)" }
                                    : undefined
                            }
                            onClick={
                                isOpenable
                                    ? () => onOpenNotification(notification)
                                    : undefined
                            }
                            onKeyDown={
                                isOpenable
                                    ? (event) => {
                                          if (event.key === "Enter" || event.key === " ") {
                                              event.preventDefault();
                                              onOpenNotification(notification);
                                          }
                                      }
                                    : undefined
                            }
                            role={isOpenable ? "button" : undefined}
                            tabIndex={isOpenable ? 0 : undefined}
                        >
                            <Stack gap="2">
                                <Text color="var(--color-text-primary)" fontWeight={notification.isRead ? "500" : "700"}>
                                    {notification.message}
                                </Text>
                                <Flex align="center" justify="space-between" gap="3" wrap="wrap">
                                    <Text fontSize="sm" color="var(--color-text-muted)">
                                        {formatDateTime(notification.createdAt)}
                                    </Text>
                                    <Flex gap="2" wrap="wrap">
                                        {notification.action ? (
                                            <Button
                                                size="xs"
                                                borderRadius="md"
                                                bg="var(--color-accent)"
                                                color="var(--color-text-inverse)"
                                                _hover={{ bg: "var(--color-accent-hover)" }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onAcceptNotification(notification);
                                                }}
                                            >
                                                {notification.action.label}
                                            </Button>
                                        ) : null}
                                        {!notification.isRead ? (
                                            <Button
                                                size="xs"
                                                variant="outline"
                                                borderRadius="md"
                                                borderColor="var(--color-accent-border)"
                                                color="var(--color-text-primary)"
                                                bg="transparent"
                                                _hover={{ bg: "var(--color-accent-surface)", borderColor: "var(--color-accent-border)" }}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onReadNotification(notification);
                                                }}
                                            >
                                                Mark read
                                            </Button>
                                        ) : null}
                                    </Flex>
                                </Flex>
                            </Stack>
                        </Box>
                    );
                    })
                ) : (
                    <Text color="var(--color-text-muted)">No notifications yet.</Text>
                )}
            </Stack>
        </SurfaceCard>
    );
}
