import type { ReactNode } from "react";

import {
  Accordion,
  Box,
  Button,
  Flex,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";

import { ActionIcon } from "./ActionIcon";
import { DropdownMenu } from "./DropdownMenu";
import { BrandWordmark, HeaderActionButton } from "./HeaderElements";
import { MoonIcon, SunIcon } from "./icons";
import { PublicLoginPanel } from "./PublicLoginPanel";

const faqs = [
  {
    question: "What kind of teams is this built for?",
    answer:
      "It fits small product and engineering teams that need one shared place for planning, delivery, bug management, and project administration.",
  },
  {
    question: "Is it really free?",
    answer:
      "Yes. Every feature is free to use, with no hidden costs, upgrade wall, or locked section waiting later.",
  },
  {
    question: "How does GitHub fit into the workflow?",
    answer:
      "Each project can connect to a GitHub repository, which helps teams keep backlog ownership and repository context aligned.",
  },
  {
    question: "Can one organization manage multiple projects?",
    answer:
      "Yes. Organizations hold users, and those users can collaborate across several projects without rebuilding access every time.",
  },
  {
    question: "Do I need to connect GitHub right away?",
    answer:
      "No. You can create an account first and connect GitHub when you are ready, or use the combined signup flow to do both in one step.",
  },
];

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      transition="transform 160ms ease"
      transform={open ? "rotate(180deg)" : "rotate(0deg)"}
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="m6 9 6 6 6-6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Box>
  );
}

type PublicPageHeaderProps = {
  busyLabel: string | null;
  error: string | null;
  notice: string | null;
  loginForm: {
    identifier: string;
    password: string;
  };
  themeMode: "light" | "dark";
  onLoginFormChange: (field: "identifier" | "password", value: string) => void;
  onNavigateHome: () => void;
  onSubmitLogin: () => void;
  onToggleThemeMode: () => void;
  rightAction?: ReactNode;
};

export function PublicPageHeader({
  busyLabel,
  error,
  notice,
  loginForm,
  themeMode,
  onLoginFormChange,
  onNavigateHome,
  onSubmitLogin,
  onToggleThemeMode,
  rightAction,
}: PublicPageHeaderProps) {
  return (
    <Box
      as="header"
      borderBottomWidth="1px"
      borderColor="var(--color-border-default)"
      bg="color-mix(in srgb, var(--color-bg-panel) 92%, transparent)"
      backdropFilter="blur(18px)"
      px={{ base: "4", lg: "8" }}
      py="4"
      position="sticky"
      top="0"
      zIndex="10"
    >
      <Flex justify="space-between" align="center" gap="4" wrap="wrap">
        <Button
          variant="ghost"
          h="auto"
          minW="0"
          p="0"
          borderRadius="0"
          _hover={{ bg: "transparent" }}
          _active={{ bg: "transparent" }}
          onClick={onNavigateHome}
        >
          <BrandWordmark />
        </Button>

        <HStack gap="3" align="center" wrap="wrap" justify="flex-end">
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

          <DropdownMenu
            width="380px"
            align="right"
            sections={[]}
            footerSlot={
              <Stack gap="3" p="1">
                <Text
                  px="2"
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="0.14em"
                  color="var(--color-text-subtle)"
                >
                  FAQ
                </Text>
                <Accordion.Root collapsible>
                  {faqs.map((faq) => (
                    <Accordion.Item
                      key={faq.question}
                      value={faq.question}
                      overflow="hidden"
                    >
                      <Accordion.ItemTrigger
                        px="3"
                        py="3"
                        bg="var(--color-bg-muted)"
                        color="var(--color-text-primary)"
                        _hover={{ bg: "var(--color-bg-hover)" }}
                      >
                        <Flex
                          align="center"
                          justify="space-between"
                          w="full"
                          gap="3"
                        >
                          <Text fontWeight="600" textAlign="left">
                            {faq.question}
                          </Text>
                          <Accordion.ItemIndicator color="var(--color-text-muted)">
                            <ChevronDownIcon open={false} />
                          </Accordion.ItemIndicator>
                        </Flex>
                      </Accordion.ItemTrigger>
                      <Accordion.ItemContent bg="var(--color-bg-soft)">
                        <Accordion.ItemBody px="3" py="3">
                          <Text fontSize="sm" color="var(--color-text-muted)">
                            {faq.answer}
                          </Text>
                        </Accordion.ItemBody>
                      </Accordion.ItemContent>
                    </Accordion.Item>
                  ))}
                </Accordion.Root>
              </Stack>
            }
            renderTrigger={({ isOpen, toggle }) => (
              <Button
                borderRadius="12px"
                h="11"
                px="4"
                borderWidth="1px"
                borderColor={
                  isOpen
                    ? "var(--color-accent-border)"
                    : "var(--color-border-default)"
                }
                bg={
                  isOpen
                    ? "var(--color-accent-surface)"
                    : "var(--color-bg-muted)"
                }
                color="var(--color-text-primary)"
                _hover={{
                  bg: isOpen
                    ? "var(--color-accent-surface-strong)"
                    : "var(--color-bg-hover)",
                  borderColor: "var(--color-border-strong)",
                }}
                onClick={toggle}
              >
                <HStack gap="2">
                  <Text fontWeight="600">FAQ</Text>
                  <ChevronDownIcon open={isOpen} />
                </HStack>
              </Button>
            )}
          />

          <DropdownMenu
            width="400px"
            align="right"
            sections={[]}
            footerSlot={
              <PublicLoginPanel
                busyLabel={busyLabel}
                error={error}
                notice={notice}
                loginForm={loginForm}
                onLoginFormChange={onLoginFormChange}
                onSubmitLogin={onSubmitLogin}
              />
            }
            renderTrigger={({ isOpen, toggle }) => (
              <Button
                borderRadius="12px"
                h="11"
                px="4"
                borderWidth="1px"
                borderColor={
                  isOpen
                    ? "var(--color-accent-border)"
                    : "var(--color-border-default)"
                }
                bg={
                  isOpen
                    ? "var(--color-accent-surface)"
                    : "var(--color-bg-muted)"
                }
                color="var(--color-text-primary)"
                _hover={{
                  bg: isOpen
                    ? "var(--color-accent-surface-strong)"
                    : "var(--color-bg-hover)",
                  borderColor: "var(--color-accent-border)",
                }}
                onClick={toggle}
              >
                Login
              </Button>
            )}
          />

          {rightAction}
        </HStack>
      </Flex>
    </Box>
  );
}
