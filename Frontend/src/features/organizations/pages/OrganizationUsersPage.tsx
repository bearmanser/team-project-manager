import { useState } from "react";

import { Button, Flex, Heading, Input, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "../../../components/ActionIcon";
import { DropdownMenu } from "../../../components/DropdownMenu";
import { InviteIcon, MoreIcon } from "../../../components/icons";
import { ModalFrame } from "../../../components/ModalFrame";
import { SurfaceCard } from "../../../components/SurfaceCard";
import { StatusPill } from "../../../components/StatusPill";
import type { OrganizationMember, OrganizationRole } from "../../../types";
import { nativeSelectStyle } from "../../../utils";

type OrganizationUsersPageProps = {
    isInviting: boolean;
    isLoading: boolean;
    members: OrganizationMember[];
    organizationRole: OrganizationRole;
    onCancelInvite: (membershipId: number) => void;
    onChangeRole: (membershipId: number, role: OrganizationRole) => void;
    onInviteUser: (identifier: string, role: OrganizationRole) => void;
    onRemoveUser: (membershipId: number) => void;
};

const roleOptions: OrganizationRole[] = ["member", "viewer", "admin"];

export function OrganizationUsersPage({
    isInviting,
    isLoading,
    members,
    organizationRole,
    onCancelInvite,
    onChangeRole,
    onInviteUser,
    onRemoveUser,
}: OrganizationUsersPageProps) {
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteIdentifier, setInviteIdentifier] = useState("");
    const [inviteRole, setInviteRole] = useState<OrganizationRole>("member");
    const [rolePromptMember, setRolePromptMember] = useState<OrganizationMember | null>(null);
    const [roleTarget, setRoleTarget] = useState<OrganizationRole>("member");
    const [removePromptMember, setRemovePromptMember] = useState<OrganizationMember | null>(null);
    const canManageUsers = organizationRole === "owner" || organizationRole === "admin";

    function handleCloseInvite(): void {
        setInviteOpen(false);
        setInviteIdentifier("");
        setInviteRole("member");
    }

    function handleSubmitInvite(): void {
        if (!inviteIdentifier.trim()) {
            return;
        }

        onInviteUser(inviteIdentifier.trim(), inviteRole);
        handleCloseInvite();
    }

    function canModifyMember(member: OrganizationMember): boolean {
        if (!canManageUsers) {
            return false;
        }
        if (organizationRole === "owner") {
            return member.role !== "owner";
        }
        return member.role !== "owner" && member.role !== "admin";
    }

    function openRolePrompt(member: OrganizationMember): void {
        const availableRoles = roleOptions
            .filter((role) => role !== member.role)
            .filter((role) => organizationRole === "owner" || role !== "admin");
        if (!availableRoles.length) {
            return;
        }

        setRolePromptMember(member);
        setRoleTarget(availableRoles[0]);
    }

    function closeRolePrompt(): void {
        setRolePromptMember(null);
        setRoleTarget("member");
    }

    function submitRolePrompt(): void {
        if (!rolePromptMember) {
            return;
        }

        onChangeRole(rolePromptMember.id, roleTarget);
        closeRolePrompt();
    }

    function openRemovePrompt(member: OrganizationMember): void {
        setRemovePromptMember(member);
    }

    function closeRemovePrompt(): void {
        setRemovePromptMember(null);
    }

    function submitRemovePrompt(): void {
        if (!removePromptMember) {
            return;
        }

        if (removePromptMember.status === "invited") {
            onCancelInvite(removePromptMember.id);
        } else {
            onRemoveUser(removePromptMember.id);
        }
        closeRemovePrompt();
    }

    return (
        <>
            <Stack gap="6">
                <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                    <Stack gap="1">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                            People
                        </Text>
                        <Heading size="2xl" color="var(--color-text-primary)">
                            Shared team directory
                        </Heading>
                    </Stack>
                    {canManageUsers ? (
                        <Button
                            borderRadius="lg"
                            bg="var(--color-accent)"
                            color="var(--color-text-inverse)"
                            alignSelf={{ base: "stretch", md: "center" }}
                            _hover={{ bg: "var(--color-accent-hover)" }}
                            onClick={() => setInviteOpen(true)}
                        >
                            <ActionIcon>
                                <InviteIcon size={16} />
                            </ActionIcon>
                            Invite user
                        </Button>
                    ) : null}
                </Flex>

                {isLoading ? (
                    <SurfaceCard p="5" bg="var(--color-bg-muted)">
                        <Text color="var(--color-text-muted)">Loading organization members...</Text>
                    </SurfaceCard>
                ) : null}

                {!isLoading ? (
                    <SurfaceCard p="0" overflow="hidden">
                        {members.length ? (
                            members.map((entry) => {
                                const canModify = canModifyMember(entry);
                                const actionItems = [
                                    ...(canModify
                                        ? [
                                              {
                                                  key: "change-role",
                                                  label: "Change role",
                                                  onClick: () => openRolePrompt(entry),
                                              },
                                          ]
                                        : []),
                                    ...(canModify
                                        ? [
                                              {
                                                  key: entry.status === "invited" ? "cancel-invite" : "remove-user",
                                                  label: entry.status === "invited" ? "Cancel invite" : "Remove user",
                                                  onClick: () => openRemovePrompt(entry),
                                                  tone: "danger" as const,
                                              },
                                          ]
                                        : []),
                                ];

                                return (
                                    <Flex
                                        key={entry.id}
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
                                            <Heading size="sm" color="var(--color-text-primary)">
                                                {entry.user.username}
                                            </Heading>
                                            <Text color="var(--color-text-muted)">
                                                {entry.user.email}
                                                {entry.user.githubConnected && entry.user.githubUsername
                                                    ? ` - GitHub @${entry.user.githubUsername}`
                                                    : " - GitHub not connected"}
                                                {entry.projectNames.length
                                                    ? ` - ${entry.projectNames.join(", ")}`
                                                    : " - No projects yet"}
                                            </Text>
                                        </Stack>
                                        <Flex align="center" gap="2" wrap="wrap">
                                            <StatusPill label={entry.role} />
                                            {entry.status === "invited" ? <StatusPill label="invited" /> : null}
                                            {actionItems.length ? (
                                                <DropdownMenu
                                                    width="220px"
                                                    items={actionItems}
                                                    renderTrigger={({ toggle }) => (
                                                        <Button
                                                            aria-label={`Manage ${entry.user.username}`}
                                                            minW="9"
                                                            h="9"
                                                            px="0"
                                                            borderRadius="lg"
                                                            variant="outline"
                                                            borderColor="var(--color-border-strong)"
                                                            color="var(--color-text-primary)"
                                                            _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                                            onClick={toggle}
                                                        >
                                                            <ActionIcon>
                                                                <MoreIcon size={16} />
                                                            </ActionIcon>
                                                        </Button>
                                                    )}
                                                />
                                            ) : null}
                                        </Flex>
                                    </Flex>
                                );
                            })
                        ) : (
                            <Stack p="6" gap="2">
                                <Text color="var(--color-text-primary)" fontWeight="600">
                                    No people discovered yet.
                                </Text>
                                <Text color="var(--color-text-muted)">
                                    Invite someone once this organization is ready to share.
                                </Text>
                            </Stack>
                        )}
                    </SurfaceCard>
                ) : null}

                <ModalFrame
                    title="Invite user"
                    description="Invite someone to this organization. They will show as invited until they accept."
                    isOpen={inviteOpen}
                    onClose={handleCloseInvite}
                >
                    <Stack
                        as="form"
                        gap="4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleSubmitInvite();
                        }}
                    >
                        <Input
                            value={inviteIdentifier}
                            onChange={(event) => setInviteIdentifier(event.target.value)}
                            placeholder="Username or email"
                            bg="var(--color-bg-muted)"
                            borderColor="var(--color-border-strong)"
                            borderRadius="lg"
                            color="var(--color-text-primary)"
                        />
                        <select
                            value={inviteRole}
                            style={nativeSelectStyle}
                            onChange={(event) => setInviteRole(event.target.value as OrganizationRole)}
                        >
                            {roleOptions
                                .filter((role) => organizationRole === "owner" || role !== "admin")
                                .map((role) => (
                                    <option key={role} value={role}>
                                        {role}
                                    </option>
                                ))}
                        </select>
                        <Button
                            type="submit"
                            borderRadius="lg"
                            bg="var(--color-accent)"
                            color="var(--color-text-inverse)"
                            alignSelf="flex-start"
                            disabled={isInviting || !inviteIdentifier.trim()}
                            _hover={{ bg: "var(--color-accent-hover)" }}
                        >
                            {isInviting ? "Inviting..." : "Send invite"}
                        </Button>
                    </Stack>
                </ModalFrame>
            </Stack>

            <ModalFrame
                title="Change role"
                description={
                    rolePromptMember
                        ? `Choose the new organization role for ${rolePromptMember.user.username}.`
                        : undefined
                }
                isOpen={Boolean(rolePromptMember)}
                onClose={closeRolePrompt}
            >
                <Stack
                    as="form"
                    gap="4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitRolePrompt();
                    }}
                >
                    <select
                        value={roleTarget}
                        style={nativeSelectStyle}
                        onChange={(event) => setRoleTarget(event.target.value as OrganizationRole)}
                    >
                        {rolePromptMember
                            ? roleOptions
                                  .filter((role) => role !== rolePromptMember.role)
                                  .filter((role) => organizationRole === "owner" || role !== "admin")
                                  .map((role) => (
                                      <option key={role} value={role}>
                                          {role}
                                      </option>
                                  ))
                            : null}
                    </select>
                    <Flex justify="flex-end" gap="3" wrap="wrap">
                        <Button
                            borderRadius="lg"
                            variant="outline"
                            borderColor="var(--color-border-strong)"
                            color="var(--color-text-primary)"
                            _hover={{ bg: "var(--color-bg-hover)" }}
                            onClick={closeRolePrompt}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            borderRadius="lg"
                            bg="var(--color-accent)"
                            color="var(--color-text-inverse)"
                            _hover={{ bg: "var(--color-accent-hover)" }}
                        >
                            Save role
                        </Button>
                    </Flex>
                </Stack>
            </ModalFrame>

            <ModalFrame
                title={removePromptMember?.status === "invited" ? "Cancel invite" : "Remove user"}
                description={
                    removePromptMember
                        ? removePromptMember.status === "invited"
                            ? `Cancel the pending invite for ${removePromptMember.user.username}.`
                            : `Remove ${removePromptMember.user.username} from this organization and its shared projects.`
                        : undefined
                }
                isOpen={Boolean(removePromptMember)}
                onClose={closeRemovePrompt}
            >
                <Stack gap="4">
                    <Text color="var(--color-text-muted)">
                        {removePromptMember?.status === "invited"
                            ? "They will need a new invite to join later."
                            : "They will lose access immediately."}
                    </Text>
                    <Flex justify="flex-end" gap="3" wrap="wrap">
                        <Button
                            borderRadius="lg"
                            variant="outline"
                            borderColor="var(--color-border-strong)"
                            color="var(--color-text-primary)"
                            _hover={{ bg: "var(--color-bg-hover)" }}
                            onClick={closeRemovePrompt}
                        >
                            Cancel
                        </Button>
                        <Button
                            borderRadius="lg"
                            bg="var(--color-danger-text)"
                            color="white"
                            _hover={{ opacity: 0.92 }}
                            onClick={submitRemovePrompt}
                        >
                            {removePromptMember?.status === "invited" ? "Cancel invite" : "Remove user"}
                        </Button>
                    </Flex>
                </Stack>
            </ModalFrame>
        </>
    );
}
