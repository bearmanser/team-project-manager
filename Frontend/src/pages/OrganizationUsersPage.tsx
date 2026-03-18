import { useEffect, useState } from "react";

import { Button, Flex, Heading, Input, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { ModalFrame } from "../components/ModalFrame";
import { InviteIcon } from "../components/icons";
import { SurfaceCard } from "../components/SurfaceCard";
import { StatusPill } from "../components/StatusPill";
import type { ProjectRole, ProjectSummary } from "../types";
import { nativeSelectStyle } from "../utils";
import type { OrganizationUser } from "../view-models";

type OrganizationUsersPageProps = {
    isInviting: boolean;
    isLoading: boolean;
    manageableProjects: ProjectSummary[];
    users: OrganizationUser[];
    onInviteUser: (projectId: number, identifier: string, role: ProjectRole) => void;
};

const roleOptions: ProjectRole[] = ["member", "viewer", "admin"];

export function OrganizationUsersPage({
    isInviting,
    isLoading,
    manageableProjects,
    users,
    onInviteUser,
}: OrganizationUsersPageProps) {
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteProjectId, setInviteProjectId] = useState<string>("");
    const [inviteIdentifier, setInviteIdentifier] = useState("");
    const [inviteRole, setInviteRole] = useState<ProjectRole>("member");

    useEffect(() => {
        if (!inviteProjectId && manageableProjects.length) {
            setInviteProjectId(String(manageableProjects[0].id));
        }
    }, [inviteProjectId, manageableProjects]);

    function handleCloseInvite(): void {
        setInviteOpen(false);
        setInviteIdentifier("");
        setInviteRole("member");
        setInviteProjectId(manageableProjects[0] ? String(manageableProjects[0].id) : "");
    }

    function handleSubmitInvite(): void {
        const projectId = Number(inviteProjectId);
        if (!Number.isFinite(projectId) || !inviteIdentifier.trim()) {
            return;
        }

        onInviteUser(projectId, inviteIdentifier.trim(), inviteRole);
        handleCloseInvite();
    }

    return (
        <Stack gap="6">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Organization users
                    </Text>
                    <Heading size="2xl" color="var(--color-text-primary)">
                        Shared team directory
                    </Heading>
                    <Text color="var(--color-text-secondary)" maxW="2xl">
                        People show up once here and can still participate across multiple projects underneath the same organization.
                    </Text>
                </Stack>
                <Button
                    borderRadius="lg"
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
                    alignSelf={{ base: "stretch", md: "center" }}
                    disabled={!manageableProjects.length}
                    _hover={{ bg: "var(--color-accent-hover)" }}
                    onClick={() => setInviteOpen(true)}
                >
                    <ActionIcon>
                        <InviteIcon size={16} />
                    </ActionIcon>
                    Invite user
                </Button>
            </Flex>

            {isLoading ? (
                <SurfaceCard p="5" bg="var(--color-bg-muted)">
                    <Text color="var(--color-text-muted)">Loading people from project memberships...</Text>
                </SurfaceCard>
            ) : null}

            {!isLoading ? (
                <SurfaceCard p="0" overflow="hidden">
                    {users.length ? (
                        users.map((entry) => (
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
                                <Flex gap="2" wrap="wrap">
                                    {[...new Set(entry.roles)].map((role) => (
                                        <StatusPill key={role} label={role} />
                                    ))}
                                </Flex>
                            </Flex>
                        ))
                    ) : (
                        <Stack p="6" gap="2">
                            <Text color="var(--color-text-primary)" fontWeight="600">
                                No people discovered yet.
                            </Text>
                            <Text color="var(--color-text-muted)">Once projects exist, their members will appear here.</Text>
                        </Stack>
                    )}
                </SurfaceCard>
            ) : null}

            <ModalFrame
                title="Invite user"
                description={manageableProjects.length ? "Add someone to one of the projects you can manage." : "You need admin access to at least one project before inviting people from here."}
                isOpen={inviteOpen}
                onClose={handleCloseInvite}
            >
                {manageableProjects.length ? (
                    <Stack
                        as="form"
                        gap="4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleSubmitInvite();
                        }}
                    >
                        <select
                            value={inviteProjectId}
                            style={nativeSelectStyle}
                            onChange={(event) => setInviteProjectId(event.target.value)}
                        >
                            {manageableProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
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
                            onChange={(event) => setInviteRole(event.target.value as ProjectRole)}
                        >
                            {roleOptions.map((role) => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </select>
                        <Button type="submit" borderRadius="lg" bg="var(--color-accent)" color="var(--color-text-inverse)" alignSelf="flex-start" disabled={isInviting || !inviteIdentifier.trim()} _hover={{ bg: "var(--color-accent-hover)" }}>
                            {isInviting ? "Inviting..." : "Send invite"}
                        </Button>
                    </Stack>
                ) : (
                    <Text color="var(--color-text-muted)">No manageable projects are available in this organization yet.</Text>
                )}
            </ModalFrame>
        </Stack>
    );
}
