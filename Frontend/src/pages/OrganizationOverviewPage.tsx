import { Button, Flex, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { ModalFrame } from "../components/ModalFrame";
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
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.18em" color="#90a0b7">
                        Organizations
                    </Text>
                    <Heading size="2xl" color="#f5f7fb">
                        Pick a workspace
                    </Heading>
                    <Text color="#b0bccf" maxW="2xl">
                        Create organizations, group projects underneath them, and keep the top level focused on the workspaces you actually use.
                    </Text>
                </Stack>
                <Button
                    minW="12"
                    h="12"
                    borderRadius="full"
                    bg="#2d6cdf"
                    color="#f8fbff"
                    fontSize="2xl"
                    lineHeight="1"
                    onClick={onToggleCreateForm}
                >
                    +
                </Button>
            </Flex>

            <SurfaceCard p="0" overflow="hidden">
                {organizations.length ? (
                    organizations.map((organization) => (
                        <Flex
                            key={organization.id}
                            px={{ base: "4", lg: "5" }}
                            py="4"
                            align={{ base: "flex-start", lg: "center" }}
                            justify="space-between"
                            gap="4"
                            wrap="wrap"
                            borderBottomWidth="1px"
                            borderColor="#273140"
                            _last={{ borderBottomWidth: "0" }}
                        >
                            <Stack gap="1" flex="1" minW="260px">
                                <Heading size="md" color="#f5f7fb">
                                    {organization.name}
                                </Heading>
                                <Text color="#90a0b7">
                                    {organization.description || "No description yet."}
                                </Text>
                                <Text color="#728198" fontSize="sm">
                                    {organization.projectCount} projects · {organization.repoCount} repos · {organization.memberCount} people · {organization.openBugCount} open bugs · updated {formatShortDate(organization.updatedAt)}
                                </Text>
                            </Stack>
                            <Button
                                borderRadius="full"
                                variant="outline"
                                borderColor="#2b3544"
                                color="#eef3fb"
                                onClick={() => onOpenOrganization(organization.id)}
                            >
                                Open
                            </Button>
                        </Flex>
                    ))
                ) : (
                    <Stack p="6" gap="2">
                        <Text color="#f5f7fb" fontWeight="600">
                            No organizations yet.
                        </Text>
                        <Text color="#90a0b7">Use the + button to add the first one.</Text>
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
                        bg="#0f141b"
                        borderColor="#2b3544"
                        borderRadius="0"
                        color="#f5f7fb"
                    />
                    <Textarea
                        value={createOrganizationForm.description}
                        onChange={(event) => onCreateOrganizationFormChange("description", event.target.value)}
                        placeholder="Shared work across services, frontend, and ops."
                        bg="#0f141b"
                        borderColor="#2b3544"
                        borderRadius="0"
                        color="#f5f7fb"
                        minH="120px"
                    />
                    <Button type="submit" borderRadius="full" bg="#2d6cdf" color="#f8fbff">
                        {isCreatingOrganization ? "Adding..." : "Add organization"}
                    </Button>
                </Stack>
            </ModalFrame>
        </Stack>
    );
}
