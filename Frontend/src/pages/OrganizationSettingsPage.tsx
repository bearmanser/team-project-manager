import { useState } from "react";

import { Button, Heading, Input, Stack, Text } from "@chakra-ui/react";

import { NameConfirmModal } from "../components/NameConfirmModal";
import { SurfaceCard } from "../components/SurfaceCard";
import type { OrganizationRole, OrganizationSummary } from "../types";

type OrganizationSettingsPageProps = {
    busyLabel: string | null;
    organization: OrganizationSummary;
    role: OrganizationRole;
    organizationSettingsForm: {
        name: string;
    };
    onDeleteOrganization: () => void;
    onLeaveOrganization: () => void;
    onOrganizationSettingsChange: (field: "name", value: string) => void;
    onSaveOrganizationSettings: () => void;
};

export function OrganizationSettingsPage({
    busyLabel,
    organization,
    role,
    organizationSettingsForm,
    onDeleteOrganization,
    onLeaveOrganization,
    onOrganizationSettingsChange,
    onSaveOrganizationSettings,
}: OrganizationSettingsPageProps) {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const canEditDetails = role === "owner" || role === "admin";
    const canDeleteOrganization = role === "owner";
    const canLeaveOrganization = role !== "owner";

    return (
        <>
            <Stack gap="6">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Organization settings
                    </Text>
                    <Heading size="2xl" color="var(--color-text-primary)">
                        {organization.displayName}
                    </Heading>
                </Stack>

                <Stack gap="4">
                    {canEditDetails ? (
                        <SurfaceCard
                            as="form"
                            p="5"
                            bg="var(--color-bg-muted)"
                            onSubmit={(event) => {
                                event.preventDefault();
                                onSaveOrganizationSettings();
                            }}
                        >
                            <Stack gap="4">
                                <Heading size="md" color="var(--color-text-primary)">
                                    Organization details
                                </Heading>
                                <Input
                                    value={organizationSettingsForm.name}
                                    onChange={(event) => onOrganizationSettingsChange("name", event.target.value)}
                                    bg="var(--color-bg-card)"
                                    borderColor="var(--color-border-strong)"
                                    borderRadius="lg"
                                    color="var(--color-text-primary)"
                                />
                                <Button
                                    type="submit"
                                    borderRadius="lg"
                                    bg="var(--color-accent)"
                                    color="var(--color-text-inverse)"
                                    alignSelf="flex-start"
                                    _hover={{ bg: "var(--color-accent-hover)" }}
                                >
                                    {busyLabel === "Saving organization settings" ? busyLabel : "Save changes"}
                                </Button>
                            </Stack>
                        </SurfaceCard>
                    ) : null}

                    {canDeleteOrganization ? (
                        <SurfaceCard p="5" bg="var(--color-danger-bg)" borderColor="var(--color-danger-border)">
                            <Stack gap="3">
                                <Heading size="md" color="var(--color-danger-heading)">
                                    Danger zone
                                </Heading>
                                <Text color="var(--color-danger-text)">
                                    Delete this organization and all of its projects if the whole space should be removed.
                                </Text>
                                <Button
                                    borderRadius="lg"
                                    variant="outline"
                                    borderColor="var(--color-danger-border)"
                                    color="var(--color-danger-text)"
                                    alignSelf="flex-start"
                                    _hover={{ bg: "var(--color-danger-bg-soft)", borderColor: "var(--color-danger-border)" }}
                                    onClick={() => setIsDeleteModalOpen(true)}
                                >
                                    Delete organization
                                </Button>
                            </Stack>
                        </SurfaceCard>
                    ) : null}

                    {canLeaveOrganization ? (
                        <SurfaceCard p="5" bg="var(--color-bg-muted)">
                            <Stack gap="3">
                                <Heading size="md" color="var(--color-text-primary)">
                                    Leave organization
                                </Heading>
                                <Text color="var(--color-text-muted)">
                                    Leave this organization and lose access to its shared projects.
                                </Text>
                                <Button
                                    borderRadius="lg"
                                    variant="outline"
                                    borderColor="var(--color-border-strong)"
                                    color="var(--color-text-primary)"
                                    alignSelf="flex-start"
                                    _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                    onClick={onLeaveOrganization}
                                >
                                    {busyLabel === "Leaving organization" ? busyLabel : "Leave organization"}
                                </Button>
                            </Stack>
                        </SurfaceCard>
                    ) : null}
                </Stack>
            </Stack>

            {canDeleteOrganization ? (
                <NameConfirmModal
                    entityLabel="organization"
                    isDeleting={busyLabel === "Deleting organization"}
                    isOpen={isDeleteModalOpen}
                    name={organization.name}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={onDeleteOrganization}
                />
            ) : null}
        </>
    );
}
