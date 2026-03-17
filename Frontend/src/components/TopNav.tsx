import { Box, Button, Flex, HStack, Stack, Text } from "@chakra-ui/react";

import type { Notification, User } from "../types";
import type { TopView } from "../view-models";
import { getInitials } from "../utils";
import { NotificationPanel } from "./NotificationPanel";

type TopNavProps = {
    activeView: TopView;
    busyLabel: string | null;
    notifications: Notification[];
    notificationOpen: boolean;
    unreadCount: number;
    user: User | null;
    onReadNotification: (notification: Notification) => void;
    onToggleNotifications: () => void;
    onViewChange: (view: TopView) => void;
};

const topItems: Array<{ id: TopView; label: string }> = [
    { id: "organizations", label: "Organizations" },
    { id: "settings", label: "Settings" },
    { id: "profile", label: "Profile" },
];

export function TopNav({
    activeView,
    busyLabel,
    notifications,
    notificationOpen,
    unreadCount,
    user,
    onReadNotification,
    onToggleNotifications,
    onViewChange,
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

                <HStack gap="2" align="stretch" flexWrap="wrap">
                    {topItems.map((item) => (
                        <Button
                            key={item.id}
                            variant="outline"
                            borderRadius="0"
                            borderColor={activeView === item.id ? "#4b7ee8" : "#273140"}
                            bg={activeView === item.id ? "#15233b" : "transparent"}
                            color="#eef3fb"
                            onClick={() => onViewChange(item.id)}
                        >
                            {item.label}
                        </Button>
                    ))}

                    <Box position="relative">
                        <Button
                            variant="outline"
                            borderRadius="0"
                            borderColor={notificationOpen ? "#4b7ee8" : "#273140"}
                            bg={notificationOpen ? "#15233b" : "transparent"}
                            color="#eef3fb"
                            onClick={onToggleNotifications}
                        >
                            Notifications {unreadCount ? `(${unreadCount})` : ""}
                        </Button>
                        {notificationOpen ? (
                            <NotificationPanel
                                notifications={notifications}
                                onReadNotification={onReadNotification}
                            />
                        ) : null}
                    </Box>
                </HStack>

                <HStack gap="3">
                    {busyLabel ? (
                        <Text fontSize="sm" color="#90a0b7">
                            {busyLabel}
                        </Text>
                    ) : null}
                    <Flex
                        align="center"
                        justify="center"
                        w="10"
                        h="10"
                        borderWidth="1px"
                        borderColor="#344053"
                        bg="#111720"
                        color="#f5f7fb"
                        fontWeight="700"
                    >
                        {getInitials(user?.username ?? "TP")}
                    </Flex>
                </HStack>
            </Flex>
        </Box>
    );
}
