import { Box, Button, Flex, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import type { DropdownSection } from "./DropdownMenu";
import { DropdownMenu } from "./DropdownMenu";
import { ModalFrame } from "./ModalFrame";
import { ActionIcon } from "./ActionIcon";
import { ChevronDownIcon, PlusIcon } from "./icons";
import type { OrganizationSummary } from "../types";

type OrganizationSelectorProps = {
    createOrganizationForm: {
        name: string;
        description: string;
    };
    currentOrganization: OrganizationSummary;
    isCreatingOrganization: boolean;
    organizations: OrganizationSummary[];
    showCreateForm: boolean;
    onCreateOrganization: () => void;
    onCreateOrganizationFormChange: (field: "name" | "description", value: string) => void;
    onOpenOrganization: (organizationId: number) => void;
    onToggleCreateForm: () => void;
};

function renderSelectionTag(isSelected: boolean) {
    if (!isSelected) {
        return null;
    }

    return (
        <Box as="span" fontSize="xs" color="var(--color-text-subtle)">
            Current
        </Box>
    );
}

export function OrganizationSelector({
    createOrganizationForm,
    currentOrganization,
    isCreatingOrganization,
    organizations,
    showCreateForm,
    onCreateOrganization,
    onCreateOrganizationFormChange,
    onOpenOrganization,
    onToggleCreateForm,
}: OrganizationSelectorProps) {
    const personalOrganization = organizations.find((organization) => organization.isPersonal) ?? null;
    const sharedOrganizations = organizations.filter((organization) => !organization.isPersonal);

    const sections: DropdownSection[] = [
        {
            key: "account",
            label: "Your account",
            items: personalOrganization
                ? [
                      {
                          key: `organization-${personalOrganization.id}`,
                          label: personalOrganization.displayName,
                          onClick: () => onOpenOrganization(personalOrganization.id),
                          trailingContent: renderSelectionTag(personalOrganization.id === currentOrganization.id),
                      },
                  ]
                : [
                      {
                          key: "no-account-workspace",
                          label: "No account workspace",
                          onClick: () => undefined,
                          disabled: true,
                      },
                  ],
        },
        {
            key: "organizations",
            label: "Organizations",
            items: sharedOrganizations.length
                ? sharedOrganizations.map((organization) => ({
                      key: `organization-${organization.id}`,
                      label: organization.displayName,
                      onClick: () => onOpenOrganization(organization.id),
                      trailingContent: renderSelectionTag(organization.id === currentOrganization.id),
                  }))
                : [
                      {
                          key: "no-organizations",
                          label: "No organizations yet",
                          onClick: () => undefined,
                          disabled: true,
                      },
                  ],
        },
    ];

    return (
        <>
            <DropdownMenu
                width="280px"
                align="left"
                sections={sections}
                footerSlot={
                    <Button
                        w="full"
                        justifyContent="flex-start"
                        borderRadius="10px"
                        variant="ghost"
                        color="var(--color-text-primary)"
                        _hover={{ bg: "var(--color-bg-hover)" }}
                        onClick={onToggleCreateForm}
                    >
                        <ActionIcon>
                            <PlusIcon size={16} />
                        </ActionIcon>
                        Create organization
                    </Button>
                }
                renderTrigger={({ isOpen, toggle }) => (
                    <Button
                        w="full"
                        h="auto"
                        px="0"
                        py="0"
                        justifyContent="stretch"
                        variant="ghost"
                        borderRadius="0"
                        borderWidth="0"
                        onClick={toggle}
                        _hover={{ bg: "transparent" }}
                        _active={{ bg: "transparent" }}
                    >
                        <Flex
                            w="full"
                            align="center"
                            justify="space-between"
                            gap="3"
                            pb="3"
                            borderBottomWidth="1px"
                            borderColor={isOpen ? "var(--color-accent-border)" : "var(--color-border-soft)"}
                        >
                            <Stack gap="0" align="flex-start" minW="0">

                                <Heading size="sm" color="var(--color-text-primary)" maxW="full">
                                    {currentOrganization.displayName}
                                </Heading>
                                <Text fontSize="sm" color="var(--color-text-muted)">
                                    {currentOrganization.isPersonal ? "Your account" : "Organization"}
                                </Text>
                            </Stack>
                            <Box color="var(--color-text-subtle)" flexShrink={0}>
                                <ChevronDownIcon size={16} />
                            </Box>
                        </Flex>
                    </Button>
                )}
            />

            <ModalFrame
                title="Add organization"
                description="Give the workspace a name and short description."
                isOpen={showCreateForm}
                onClose={onToggleCreateForm}
            >
                <Stack
                    as="form"
                    gap="4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onCreateOrganization();
                    }}
                >
                    <Input
                        value={createOrganizationForm.name}
                        onChange={(event) => onCreateOrganizationFormChange("name", event.target.value)}
                        placeholder="Platform delivery"
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                    />
                    <Textarea
                        value={createOrganizationForm.description}
                        onChange={(event) => onCreateOrganizationFormChange("description", event.target.value)}
                        placeholder="Shared work across services, frontend, and ops."
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                        minH="120px"
                    />
                    <Button
                        type="submit"
                        borderRadius="lg"
                        bg="var(--color-accent)"
                        color="var(--color-text-inverse)"
                        alignSelf="flex-start"
                        disabled={!createOrganizationForm.name.trim() || isCreatingOrganization}
                        _hover={{ bg: "var(--color-accent-hover)" }}
                    >
                        {isCreatingOrganization ? "Adding..." : "Add organization"}
                    </Button>
                </Stack>
            </ModalFrame>
        </>
    );
}


