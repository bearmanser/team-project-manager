import type { ReactNode } from "react";

import { Box, Button, Flex, HStack, Image, Stack, Text } from "@chakra-ui/react";

import type { Notification, User } from "../types";
import { getInitials } from "../utils";
import { ActionIcon } from "./ActionIcon";
import { DropdownMenu } from "./DropdownMenu";
import { NotificationPanel } from "./NotificationPanel";

type TopNavProps = {
    busyLabel: string | null;
    notifications: Notification[];
    notificationOpen: boolean;
    unreadCount: number;
    user: User | null;
    onLogout: () => void;
    onReadNotification: (notification: Notification) => void;
    onToggleNotifications: () => void;
    onCloseNotifications: () => void;
};

function NotificationIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3.75a4.25 4.25 0 0 0-4.25 4.25v2.14c0 .67-.2 1.33-.57 1.89L5.8 14.1a1.5 1.5 0 0 0 1.25 2.33h9.9a1.5 1.5 0 0 0 1.25-2.33l-1.38-2.07a3.4 3.4 0 0 1-.57-1.89V8A4.25 4.25 0 0 0 12 3.75Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.75 18.25a2.25 2.25 0 0 0 4.5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function HeaderActionButton({
    isActive,
    label,
    onClick,
    children,
}: {
    isActive?: boolean;
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Button
            aria-label={label}
            minW="11"
            h="11"
            px="0"
            borderRadius="12px"
            borderWidth="1px"
            borderColor={isActive ? "#4b7ee8" : "#273140"}
            bg={isActive ? "#13223a" : "#0f141b"}
            color="#eef3fb"
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

export function TopNav({
    busyLabel,
    notifications,
    notificationOpen,
    unreadCount,
    user,
    onLogout,
    onReadNotification,
    onToggleNotifications,
    onCloseNotifications,
}: TopNavProps) {
    return (
        <Box
            as="header"
            borderBottomWidth="1px"
            borderColor="#273140"
            bg="#0c1117"
            px={{ base: "4", lg: "8" }}
            py="4"
            position="sticky"
            top="0"
            zIndex="10"
        >
            <Flex justify="space-between" align="center" gap="4" wrap="wrap">
                <Stack gap="0">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" color="#90a0b7">
                        Team Project Manager
                    </Text>
                    <Text fontSize="xl" fontWeight="700" color="#f5f7fb">
                        Delivery control center
                    </Text>
                </Stack>

                <HStack gap="3" align="center">
                    {busyLabel ? (
                        <Text fontSize="sm" color="#90a0b7">
                            {busyLabel}
                        </Text>
                    ) : null}

                    <Box position="relative">
                        <HeaderActionButton label="Notifications" isActive={notificationOpen} onClick={onToggleNotifications}>
                            <Box position="relative" display="inline-flex">
                                <ActionIcon>
                                    <NotificationIcon />
                                </ActionIcon>
                                {unreadCount ? (
                                    <Box
                                        position="absolute"
                                        top="-6px"
                                        right="-8px"
                                        minW="5"
                                        h="5"
                                        px="1"
                                        borderRadius="full"
                                        bg="#2d6cdf"
                                        color="#f8fbff"
                                        fontSize="10px"
                                        fontWeight="700"
                                        display="grid"
                                        placeItems="center"
                                    >
                                        {unreadCount}
                                    </Box>
                                ) : null}
                            </Box>
                        </HeaderActionButton>
                        {notificationOpen ? (
                            <NotificationPanel
                                notifications={notifications}
                                onClose={onCloseNotifications}
                                onReadNotification={onReadNotification}
                            />
                        ) : null}
                    </Box>

                    <DropdownMenu
                        width="160px"
                        items={[
                            {
                                label: "Log out",
                                onClick: onLogout,
                                tone: "danger",
                            },
                        ]}
                        renderTrigger={({ toggle }) => (
                            <Button
                                aria-label="Profile menu"
                                minW="11"
                                h="11"
                                px="0"
                                borderRadius="full"
                                overflow="hidden"
                                borderWidth="1px"
                                borderColor="#273140"
                                bg="#0f141b"
                                onClick={toggle}
                            >
                                {user?.githubAvatarUrl ? (
                                    <Image src={user.githubAvatarUrl} alt={user.username} w="full" h="full" objectFit="cover" />
                                ) : (
                                    <Flex align="center" justify="center" w="full" h="full" color="#f5f7fb" fontWeight="700">
                                        {getInitials(user?.username ?? "TP")}
                                    </Flex>
                                )}
                            </Button>
                        )}
                    />
                </HStack>
            </Flex>
        </Box>
    );
}

