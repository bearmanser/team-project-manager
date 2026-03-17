import { Box, Button, Flex, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { ModalFrame } from "../components/ModalFrame";
import { PlusIcon } from "../components/icons";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { ProjectDetail, TaskStatus } from "../types";
import { formatShortDate, nativeSelectStyle } from "../utils";

type ProjectTasksPageProps = {
    createTaskForm: {
        title: string;
        description: string;
        status: TaskStatus;
    };
    isCreateOpen: boolean;
    project: ProjectDetail;
    onCreateTask: () => void;
    onCreateTaskFormChange: (field: "title" | "description" | "status", value: string) => void;
    onToggleCreateForm: () => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
};

export function ProjectTasksPage({
    createTaskForm,
    isCreateOpen,
    project,
    onCreateTask,
    onCreateTaskFormChange,
    onToggleCreateForm,
    onUpdateTaskStatus,
}: ProjectTasksPageProps) {
    return (
        <Stack gap="6">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Tasks
                    </Text>
                    <Heading size="2xl" color="#f5f7fb">
                        {project.name}
                    </Heading>
                    <Text color="#b0bccf" maxW="2xl">
                        Keep tasks lightweight, update status inline, and add new work from the create button instead of a permanent form.
                    </Text>
                </Stack>
                <Button minW="11" h="11" borderRadius="lg" bg="#2d6cdf" color="#f8fbff" onClick={onToggleCreateForm}>
                    <ActionIcon>
                        <PlusIcon />
                    </ActionIcon>
                </Button>
            </Flex>

            <SurfaceCard p="0" overflow="hidden">
                {project.tasks.length ? (
                    project.tasks.map((task) => {
                        const meta = [
                            task.description || "No description",
                            task.assignees.length
                                ? `Assigned to ${task.assignees.map((assignee) => assignee.username).join(", ")}`
                                : "Unassigned",
                            `Updated ${formatShortDate(task.updatedAt)}`,
                        ].join(" - ");

                        return (
                            <Flex
                                key={task.id}
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
                                        {task.title}
                                    </Text>
                                    <Text color="#90a0b7" fontSize="sm" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {meta}
                                    </Text>
                                </Stack>
                                <Flex gap="2" wrap="wrap" align="center">
                                    {task.bugReportTitle ? <StatusPill label={task.bugReportTitle} /> : null}
                                    {task.isResolutionTask ? <StatusPill label="Resolution" /> : null}
                                    {task.branchName ? <StatusPill label={task.branchName} /> : null}
                                </Flex>
                                <Box as="span">
                                    <select
                                        value={task.status}
                                        style={{ ...nativeSelectStyle, minWidth: 170 }}
                                        onChange={(event) =>
                                            onUpdateTaskStatus(task.id, event.target.value as TaskStatus)
                                        }
                                    >
                                        {project.boardColumns.map((column) => (
                                            <option key={column.id} value={column.id}>
                                                {column.label}
                                            </option>
                                        ))}
                                    </select>
                                </Box>
                            </Flex>
                        );
                    })
                ) : (
                    <Stack p="6" gap="2">
                        <Text color="#f5f7fb" fontWeight="600">
                            No tasks yet.
                        </Text>
                        <Text color="#90a0b7">Use the create button to add the first task.</Text>
                    </Stack>
                )}
            </SurfaceCard>

            <ModalFrame
                title="Add task"
                description="Capture the work, then manage the status directly from the list."
                isOpen={isCreateOpen}
                onClose={onToggleCreateForm}
            >
                <Stack
                    as="form"
                    gap="4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onCreateTask();
                    }}
                >
                    <Input
                        value={createTaskForm.title}
                        onChange={(event) => onCreateTaskFormChange("title", event.target.value)}
                        placeholder="Ship org-level user management"
                        bg="#0f141b"
                        borderColor="#2b3544"
                        borderRadius="lg"
                        color="#f5f7fb"
                    />
                    <Textarea
                        value={createTaskForm.description}
                        onChange={(event) => onCreateTaskFormChange("description", event.target.value)}
                        placeholder="Add the details teammates need."
                        bg="#0f141b"
                        borderColor="#2b3544"
                        borderRadius="lg"
                        color="#f5f7fb"
                        minH="140px"
                    />
                    <select
                        value={createTaskForm.status}
                        style={nativeSelectStyle}
                        onChange={(event) => onCreateTaskFormChange("status", event.target.value)}
                    >
                        {project.boardColumns.map((column) => (
                            <option key={column.id} value={column.id}>
                                {column.label}
                            </option>
                        ))}
                    </select>
                    <Button type="submit" borderRadius="lg" bg="#2d6cdf" color="#f8fbff" alignSelf="flex-start">
                        Add task
                    </Button>
                </Stack>
            </ModalFrame>
        </Stack>
    );
}
