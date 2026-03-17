import { Box, Button, Flex, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { ModalFrame } from "../components/ModalFrame";
import { PlusIcon } from "../components/icons";
import { PriorityPill } from "../components/PriorityPill";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { BugStatus, PriorityLevel, ProjectDetail } from "../types";
import {
    formatShortDate,
    nativeSelectStyle,
    PRIORITY_OPTIONS,
    getPriorityLabel,
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
    onUpdateBugPriority,
    onUpdateBugStatus,
}: ProjectBugsPageProps) {
    const bugReports = sortBugsByPriority(project.bugReports);

    return (
        <Stack gap="6">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Bugs
                    </Text>
                    <Heading size="2xl" color="#f5f7fb">
                        {project.name}
                    </Heading>
                    <Text color="#b0bccf" maxW="2xl">
                        Keep bug reports concise, update status and priority inline, and create new reports only when you need one.
                    </Text>
                </Stack>
                <Button minW="11" h="11" borderRadius="lg" bg="#2d6cdf" color="#f8fbff" onClick={onToggleCreateForm}>
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
                                borderColor="#273140"
                                _last={{ borderBottomWidth: "0" }}
                            >
                                <Stack gap="1.5" flex="1" minW="260px">
                                    <Text color="#f5f7fb" fontWeight="700" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {bug.title}
                                    </Text>
                                    <Text color="#90a0b7" fontSize="sm" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {meta}
                                    </Text>
                                </Stack>
                                <Flex gap="2" wrap="wrap" align="center">
                                    <PriorityPill priority={bug.priority} />
                                    {bug.resolutionTaskTitle ? <StatusPill label={bug.resolutionTaskTitle} /> : null}
                                </Flex>
                                <Flex gap="2" wrap="wrap" align="center">
                                    <Box as="span">
                                        <select
                                            value={bug.priority}
                                            style={{ ...nativeSelectStyle, minWidth: 150 }}
                                            onChange={(event) => onUpdateBugPriority(bug.id, event.target.value as PriorityLevel)}
                                        >
                                            {PRIORITY_OPTIONS.map((priority) => (
                                                <option key={priority} value={priority}>
                                                    {getPriorityLabel(priority)}
                                                </option>
                                            ))}
                                        </select>
                                    </Box>
                                    <Box as="span">
                                        <select
                                            value={bug.status}
                                            style={{ ...nativeSelectStyle, minWidth: 170 }}
                                            onChange={(event) => onUpdateBugStatus(bug.id, event.target.value as BugStatus)}
                                        >
                                            {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                                                <option key={value} value={value}>
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
                        <Text color="#f5f7fb" fontWeight="600">
                            No bug reports yet.
                        </Text>
                        <Text color="#90a0b7">Use the create button to add the first bug report.</Text>
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
                        bg="#0f141b"
                        borderColor="#2b3544"
                        borderRadius="lg"
                        color="#f5f7fb"
                    />
                    <Textarea
                        value={createBugForm.description}
                        onChange={(event) => onCreateBugFormChange("description", event.target.value)}
                        placeholder="Describe the issue, impact, and current behavior."
                        bg="#0f141b"
                        borderColor="#2b3544"
                        borderRadius="lg"
                        color="#f5f7fb"
                        minH="140px"
                    />
                    <select
                        value={createBugForm.status}
                        style={nativeSelectStyle}
                        onChange={(event) => onCreateBugFormChange("status", event.target.value)}
                    >
                        {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
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
                            <option key={priority} value={priority}>
                                {getPriorityLabel(priority)} priority
                            </option>
                        ))}
                    </select>
                    <Button type="submit" borderRadius="lg" bg="#2d6cdf" color="#f8fbff" alignSelf="flex-start">
                        Add bug report
                    </Button>
                </Stack>
            </ModalFrame>
        </Stack>
    );
}
