import { Button, Flex, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { ModalFrame } from "../components/ModalFrame";
import { PlusIcon } from "../components/icons";
import { SurfaceCard } from "../components/SurfaceCard";
import type { OrganizationSummary } from "../types";
import { formatShortDate } from "../utils";

type OrganizationOverviewPageProps = {
    createOrganizationForm: {
        name: string;
        description: string;
    };
    isCreatingOrganization: boolean;
    organizations: OrganizationSummary[];
    showCreateForm: boolean;
    onCreateOrganization: () => void;
    onCreateOrganizationFormChange: (field: "name" | "description", value: string) => void;
    onOpenOrganization: (organizationId: number) => void;
    onToggleCreateForm: () => void;
};

export function OrganizationOverviewPage({
    createOrganizationForm,
    isCreatingOrganization,
    organizations,
    showCreateForm,
    onCreateOrganization,
    onCreateOrganizationFormChange,
    onOpenOrganization,
    onToggleCreateForm,
}: OrganizationOverviewPageProps) {
    return (
        <Stack gap="6">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" color="var(--color-text-muted)">
                        Organizations
                    </Text>
                    <Heading size="2xl" color="var(--color-text-primary)">
                        Pick a workspace
                    </Heading>
                </Stack>
                <Button minW="11" h="11" borderRadius="lg" bg="var(--color-accent)" color="var(--color-text-inverse)" _hover={{ bg: "var(--color-accent-hover)" }} onClick={onToggleCreateForm}>
                    <ActionIcon>
                        <PlusIcon />
                    </ActionIcon>
                </Button>
            </Flex>

            <SurfaceCard p="0" overflow="hidden">
                {organizations.length ? (
                    organizations.map((organization) => (
                        <Flex
                            key={organization.id}
                            px={{ base: "4", lg: "5" }}
                            py="3"
                            align={{ base: "flex-start", lg: "center" }}
                            justify="space-between"
                            gap="4"
                            wrap="wrap"
                            borderBottomWidth="1px"
                            borderColor="var(--color-border-default)"
                            _last={{ borderBottomWidth: "0" }}
                        >
                            <Stack gap="1" flex="1" minW="260px">
                                <Heading size="md" color="var(--color-text-primary)">
                                    {organization.name}
                                </Heading>
                                <Text color="var(--color-text-muted)">
                                    {organization.description || "No description yet."}
                                </Text>
                                <Text color="var(--color-text-subtle)" fontSize="sm">
                                    {organization.projectCount} projects - {organization.repoCount} repos - {organization.memberCount} people - {organization.openBugCount} open bugs - updated {formatShortDate(organization.updatedAt)}
                                </Text>
                            </Stack>
                            <Button
                                borderRadius="lg"
                                variant="outline"
                                borderColor="var(--color-border-strong)"
                                color="var(--color-text-primary)"
                                _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                onClick={() => onOpenOrganization(organization.id)}
                            >
                                Open
                            </Button>
                        </Flex>
                    ))
                ) : (
                    <Stack p="6" gap="2">
                        <Text color="var(--color-text-primary)" fontWeight="600">
                            No organizations yet.
                        </Text>
                        <Text color="var(--color-text-muted)">Use the add button to create the first one.</Text>
                    </Stack>
                )}
            </SurfaceCard>

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
                    <Button type="submit" borderRadius="lg" bg="var(--color-accent)" color="var(--color-text-inverse)" alignSelf="flex-start" _hover={{ bg: "var(--color-accent-hover)" }}>
                        {isCreatingOrganization ? "Adding..." : "Add organization"}
                    </Button>
                </Stack>
            </ModalFrame>
        </Stack>
    );
}

