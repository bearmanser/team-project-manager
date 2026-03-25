import type { ReactNode } from "react";

import {
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Stack,
  Text,
} from "@chakra-ui/react";

import type { Notification, User } from "../types";
import { getInitials } from "../utils";
import { ActionIcon } from "./ActionIcon";
import { DropdownMenu } from "./DropdownMenu";
import { MoonIcon, SunIcon } from "./icons";
import { NotificationPanel } from "./NotificationPanel";
import { StatusAlert } from "./StatusAlert";

type TopNavProps = {
  busyLabel: string | null;
  error: string | null;
  notice: string | null;
  notifications: Notification[];
  notificationOpen: boolean;
  unreadCount: number;
  themeMode: "light" | "dark";
  user: User | null;
  onConnectGitHub: () => void;
  onDisconnectGitHub: () => void;
  onLogout: () => void;
  onReadNotification: (notification: Notification) => void;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onToggleThemeMode: () => void;
};

function NotificationIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3.75a4.25 4.25 0 0 0-4.25 4.25v2.14c0 .67-.2 1.33-.57 1.89L5.8 14.1a1.5 1.5 0 0 0 1.25 2.33h9.9a1.5 1.5 0 0 0 1.25-2.33l-1.38-2.07a3.4 3.4 0 0 1-.57-1.89V8A4.25 4.25 0 0 0 12 3.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M9.75 18.25a2.25 2.25 0 0 0 4.5 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
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
      borderColor={
        isActive ? "var(--color-accent-border)" : "var(--color-border-default)"
      }
      bg={isActive ? "var(--color-accent-surface)" : "var(--color-bg-muted)"}
      color="var(--color-text-primary)"
      _hover={{
        bg: isActive
          ? "var(--color-accent-surface-strong)"
          : "var(--color-bg-hover)",
        borderColor: isActive
          ? "var(--color-accent-border)"
          : "var(--color-border-strong)",
      }}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function BrandWordmark() {
  const words = [
    { initial: "T", rest: "eam" },
    { initial: "P", rest: "roject" },
    { initial: "M", rest: "anager" },
  ];

  return (
    <Flex
      align="baseline"
      wrap="wrap"
      columnGap={{ base: "2", md: "2" }}
      rowGap="1"
      aria-label="Team Project Manager"
    >
      {words.map((word) => (
        <Text
          key={word.initial}
          display="inline-flex"
          alignItems="baseline"
          color="var(--color-text-primary)"
          lineHeight="1"
        >
          <Box
            as="span"
            fontSize={{ base: "3xl", md: "3xl" }}
            fontWeight="500"
            lineHeight="0.8"
          >
            {word.initial}
          </Box>
          <Box as="span" fontSize={{ base: "sm", md: "2xl" }} fontWeight="500">
            {word.rest}
          </Box>
        </Text>
      ))}
    </Flex>
  );
}

export function TopNav({
  busyLabel,
  error,
  notice,
  notifications,
  notificationOpen,
  unreadCount,
  themeMode,
  user,
  onConnectGitHub,
  onDisconnectGitHub,
  onLogout,
  onReadNotification,
  onToggleNotifications,
  onCloseNotifications,
  onToggleThemeMode,
}: TopNavProps) {
  const isManagingGitHub =
    busyLabel === "Opening GitHub" ||
    busyLabel === "Refreshing GitHub repositories" ||
    busyLabel === "Disconnecting GitHub";

  const statusAlert = error
    ? {
        title: error,
        status: "error" as const,
      }
    : notice
    ? {
        title: notice,
        status: "success" as const,
      }
    : busyLabel
    ? {
        title: busyLabel,
        status: "neutral" as const,
        loading: true,
      }
    : null;

  return (
    <Box
      as="header"
      borderBottomWidth="1px"
      borderColor="var(--color-border-default)"
      bg="var(--color-bg-panel)"
      px={{ base: "4", lg: "8" }}
      py="4"
      position="sticky"
      top="0"
      zIndex="10"
    >
      <Flex justify="space-between" align="center" gap="4" wrap="wrap">
        <Stack gap="0">
          <BrandWordmark />
        </Stack>

        <HStack gap="3" align="center" wrap="wrap" justify="flex-end">
          {statusAlert ? (
            <StatusAlert
              title={statusAlert.title}
              status={statusAlert.status}
              loading={statusAlert.loading}
              maxW={{ base: "full", md: "320px" }}
            />
          ) : null}

          <HeaderActionButton
            label={
              themeMode === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            onClick={onToggleThemeMode}
          >
            <ActionIcon>
              {themeMode === "dark" ? (
                <SunIcon size={18} />
              ) : (
                <MoonIcon size={18} />
              )}
            </ActionIcon>
          </HeaderActionButton>

          <Box position="relative">
            <HeaderActionButton
              label="Notifications"
              isActive={notificationOpen}
              onClick={onToggleNotifications}
            >
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
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
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
            width="200px"
            items={[
              {
                label: user?.githubConnected
                  ? "Disconnect GitHub"
                  : "Connect GitHub",
                onClick: user?.githubConnected
                  ? onDisconnectGitHub
                  : onConnectGitHub,
                disabled: isManagingGitHub,
              },
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
                borderColor="var(--color-border-default)"
                bg="var(--color-bg-muted)"
                color="var(--color-text-primary)"
                _hover={{
                  bg: "var(--color-bg-hover)",
                  borderColor: "var(--color-border-strong)",
                }}
                onClick={toggle}
              >
                {user?.githubAvatarUrl ? (
                  <Image
                    src={user.githubAvatarUrl}
                    alt={user.username}
                    w="full"
                    h="full"
                    objectFit="cover"
                  />
                ) : (
                  <Flex
                    align="center"
                    justify="center"
                    w="full"
                    h="full"
                    color="var(--color-text-primary)"
                    fontWeight="700"
                  >
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
