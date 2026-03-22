import { useState } from "react";

import { Button, Heading, Input, Stack, Text } from "@chakra-ui/react";

import { NameConfirmModal } from "../components/NameConfirmModal";
import { SurfaceCard } from "../components/SurfaceCard";
import type { OrganizationSummary } from "../types";

type OrganizationSettingsPageProps = {
    busyLabel: string | null;
    organization: OrganizationSummary;
    organizationSettingsForm: {
        name: string;
    };
    onDeleteOrganization: () => void;
    onOrganizationSettingsChange: (field: "name", value: string) => void;
    onSaveOrganizationSettings: () => void;
};

export function OrganizationSettingsPage({
    busyLabel,
    organization,
    organizationSettingsForm,
    onDeleteOrganization,
    onOrganizationSettingsChange,
    onSaveOrganizationSettings,
}: OrganizationSettingsPageProps) {
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
                </Stack>
            </Stack>

            <NameConfirmModal
                entityLabel="organization"
                isDeleting={busyLabel === "Deleting organization"}
                isOpen={isDeleteModalOpen}
                name={organization.name}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={onDeleteOrganization}
            />
        </>
    );
}
