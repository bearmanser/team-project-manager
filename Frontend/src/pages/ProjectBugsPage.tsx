import { Box, Button, Flex, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { ModalFrame } from "../components/ModalFrame";
import { PlusIcon } from "../components/icons";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { BugStatus, PriorityLevel, ProjectDetail } from "../types";
import {
    formatShortDate,
    getBugStatusOptionStyle,
    getBugStatusSelectStyle,
    getPriorityLabel,
    getPriorityOptionStyle,
    getPrioritySelectStyle,
    nativeSelectStyle,
    PRIORITY_OPTIONS,
    sortBugsByPriority,
} from "../utils";

type ProjectBugsPageProps = {
    createBugForm: {
        title: string;
        description: string;
        status: BugStatus;
        priority: PriorityLevel;
    };
    isCreateOpen: boolean;
    project: ProjectDetail;
    onCreateBug: () => void;
    onCreateBugFormChange: (field: "title" | "description" | "status" | "priority", value: string) => void;
    onToggleCreateForm: () => void;
    onOpenBug: (bugId: number) => void;
    onUpdateBugPriority: (bugId: number, priority: PriorityLevel) => void;
    onUpdateBugStatus: (bugId: number, status: BugStatus) => void;
};

export function ProjectBugsPage({
    createBugForm,
    isCreateOpen,
    project,
    onCreateBug,
    onCreateBugFormChange,
    onToggleCreateForm,
    onOpenBug,
    onUpdateBugPriority,
    onUpdateBugStatus,
}: ProjectBugsPageProps) {
    const bugReports = sortBugsByPriority(project.bugReports);

    return (
        <Stack gap="6">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Bugs
                    </Text>
                    <Heading size="2xl" color="var(--color-text-primary)">
                        {project.name}
                    </Heading>
                </Stack>
                <Button
                    minW="11"
                    h="11"
                    borderRadius="lg"
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
                    _hover={{ bg: "var(--color-accent-hover)" }}
                    onClick={onToggleCreateForm}
                >
                    <ActionIcon>
                        <PlusIcon />
                    </ActionIcon>
                </Button>
            </Flex>

            <SurfaceCard p="0" overflow="hidden">
                {bugReports.length ? (
                    bugReports.map((bug) => {
                        const meta = [
                            bug.description || "No description",
                            `Reporter ${bug.reporter.username}`,
                            `Updated ${formatShortDate(bug.updatedAt)}`,
                        ].join(" - ");

                        return (
                            <Flex
                                key={bug.id}
                                px={{ base: "4", lg: "5" }}
                                py="3"
                                align={{ base: "flex-start", lg: "center" }}
                                justify="space-between"
                                gap="3"
                                wrap="wrap"
                                borderBottomWidth="1px"
                                borderColor="var(--color-border-default)"
                                _last={{ borderBottomWidth: "0" }}
                            >
                                <Stack
                                    gap="1.5"
                                    flex="1"
                                    minW="260px"
                                    cursor="pointer"
                                    onClick={() => onOpenBug(bug.id)}
                                >
                                    <Text color="var(--color-text-primary)" fontWeight="700" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {bug.title}
                                    </Text>
                                    <Text color="var(--color-text-muted)" fontSize="sm" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {meta}
                                    </Text>
                                </Stack>
                                <Flex gap="2" wrap="wrap" align="center">
                                    {bug.resolutionTaskTitle ? <StatusPill label={bug.resolutionTaskTitle} /> : null}
                                </Flex>
                                <Flex gap="2" wrap="wrap" align="center">
                                    <Box as="span">
                                        <select
                                            value={bug.priority}
                                            style={{ ...getPrioritySelectStyle(bug.priority), minWidth: 150 }}
                                            onChange={(event) => onUpdateBugPriority(bug.id, event.target.value as PriorityLevel)}
                                        >
                                            {PRIORITY_OPTIONS.map((priority) => (
                                                <option key={priority} value={priority} style={getPriorityOptionStyle(priority)}>
                                                    {getPriorityLabel(priority)}
                                                </option>
                                            ))}
                                        </select>
                                    </Box>
                                    <Box as="span">
                                        <select
                                            value={bug.status}
                                            style={{ ...getBugStatusSelectStyle(bug.status), minWidth: 170 }}
                                            onChange={(event) => onUpdateBugStatus(bug.id, event.target.value as BugStatus)}
                                        >
                                            {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                                                <option key={value} value={value} style={getBugStatusOptionStyle(value as BugStatus)}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </Box>
                                </Flex>
                            </Flex>
                        );
                    })
                ) : (
                    <Stack p="6" gap="2">
                        <Text color="var(--color-text-primary)" fontWeight="600">
                            No bug reports yet.
                        </Text>
                        <Text color="var(--color-text-muted)">Use the create button to add the first bug report.</Text>
                    </Stack>
                )}
            </SurfaceCard>

            <ModalFrame
                title="Add bug report"
                description="Capture the issue, set its urgency, then keep triage moving from the list itself."
                isOpen={isCreateOpen}
                onClose={onToggleCreateForm}
            >
                <Stack
                    as="form"
                    gap="4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onCreateBug();
                    }}
                >
                    <Input
                        value={createBugForm.title}
                        onChange={(event) => onCreateBugFormChange("title", event.target.value)}
                        placeholder="Board is not syncing live updates"
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                    />
                    <Textarea
                        value={createBugForm.description}
                        onChange={(event) => onCreateBugFormChange("description", event.target.value)}
                        placeholder="Describe the issue, impact, and current behavior."
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                        minH="140px"
                    />
                    <select
                        value={createBugForm.status}
                        style={nativeSelectStyle}
                        onChange={(event) => onCreateBugFormChange("status", event.target.value)}
                    >
                        {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                            <option key={value} value={value} style={getBugStatusOptionStyle(value as BugStatus)}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={createBugForm.priority}
                        style={nativeSelectStyle}
                        onChange={(event) => onCreateBugFormChange("priority", event.target.value)}
                    >
                        {PRIORITY_OPTIONS.map((priority) => (
                            <option key={priority} value={priority} style={getPriorityOptionStyle(priority)}>
                                {getPriorityLabel(priority)} priority
                            </option>
                        ))}
                    </select>
                    <Button
                        type="submit"
                        borderRadius="lg"
                        bg="var(--color-accent)"
                        color="var(--color-text-inverse)"
                        alignSelf="flex-start"
                        _hover={{ bg: "var(--color-accent-hover)" }}
                    >
                        Add bug report
                    </Button>
                </Stack>
            </ModalFrame>
        </Stack>
    );
}

