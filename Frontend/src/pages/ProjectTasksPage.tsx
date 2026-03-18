import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { PlusIcon } from "../components/icons";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { PriorityLevel, ProjectDetail, TaskStatus } from "../types";
import {
    formatShortDate,
    getPriorityLabel,
    getPrioritySelectStyle,
    getTaskStatusSelectStyle,
    PRIORITY_OPTIONS,
    sortTasksByPriority,
} from "../utils";

type ProjectTasksPageProps = {
    createTaskForm: {
        title: string;
        description: string;
        status: TaskStatus;
        priority: PriorityLevel;
    };
    isCreateOpen: boolean;
    project: ProjectDetail;
    onCreateTask: () => void;
    onCreateTaskFormChange: (field: "title" | "description" | "status" | "priority", value: string) => void;
    onToggleCreateForm: () => void;
    onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
};

export function ProjectTasksPage({
    createTaskForm,
    isCreateOpen,
    project,
    onCreateTask,
    onCreateTaskFormChange,
    onToggleCreateForm,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
}: ProjectTasksPageProps) {
    const tasks = sortTasksByPriority(project.tasks);

    return (
        <Stack gap="6">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Tasks
                    </Text>
                    <Heading size="2xl" color="var(--color-text-primary)">
                        {project.name}
                    </Heading>
                    <Text color="var(--color-text-secondary)" maxW="2xl">
                        Keep tasks lightweight, update status and priority inline, and add new work from the create button instead of a permanent form.
                    </Text>
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
                {tasks.length ? (
                    tasks.map((task) => {
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
                                borderColor="var(--color-border-default)"
                                _last={{ borderBottomWidth: "0" }}
                            >
                                <Stack gap="1.5" flex="1" minW="260px">
                                    <Text color="var(--color-text-primary)" fontWeight="700" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {task.title}
                                    </Text>
                                    <Text color="var(--color-text-muted)" fontSize="sm" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {meta}
                                    </Text>
                                </Stack>
                                <Flex gap="2" wrap="wrap" align="center">
                                    {task.bugReportTitle ? <StatusPill label={task.bugReportTitle} /> : null}
                                    {task.isResolutionTask ? <StatusPill label="Resolution" /> : null}
                                    {task.branchName ? <StatusPill label={task.branchName} /> : null}
                                </Flex>
                                <Flex gap="2" wrap="wrap" align="center">
                                    <Box as="span">
                                        <select
                                            value={task.priority}
                                            style={{ ...getPrioritySelectStyle(task.priority), minWidth: 150 }}
                                            onChange={(event) =>
                                                onUpdateTaskPriority(task.id, event.target.value as PriorityLevel)
                                            }
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
                                            value={task.status}
                                            style={{ ...getTaskStatusSelectStyle(task.status), minWidth: 170 }}
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
                            </Flex>
                        );
                    })
                ) : (
                    <Stack p="6" gap="2">
                        <Text color="var(--color-text-primary)" fontWeight="600">
                            No tasks yet.
                        </Text>
                        <Text color="var(--color-text-muted)">Use the create button to add the first task.</Text>
                    </Stack>
                )}
            </SurfaceCard>

            <CreateTaskModal
                form={createTaskForm}
                isOpen={isCreateOpen}
                project={project}
                onClose={onToggleCreateForm}
                onCreateTask={onCreateTask}
                onFormChange={onCreateTaskFormChange}
            />
        </Stack>
    );
}
