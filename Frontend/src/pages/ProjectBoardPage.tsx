import { useState } from "react";

import { Box, Button, Flex, Grid, Heading, Stack, Text } from "@chakra-ui/react";

import { CreateTaskModal } from "../components/CreateTaskModal";
import { DropdownMenu } from "../components/DropdownMenu";
import { ActionIcon } from "../components/ActionIcon";
import { MoreIcon, PlusIcon } from "../components/icons";
import { PriorityPill } from "../components/PriorityPill";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { PriorityLevel, ProjectDetail, TaskStatus } from "../types";
import { PRIORITY_OPTIONS, getPriorityLabel, sortTasksByPriority } from "../utils";

type ProjectBoardPageProps = {
    createTaskForm: {
        title: string;
        description: string;
        status: TaskStatus;
        priority: PriorityLevel;
    };
    isCreateTaskOpen: boolean;
    project: ProjectDetail;
    onCreateTask: () => void;
    onCreateTaskFormChange: (field: "title" | "description" | "status" | "priority", value: string) => void;
    onOpenCreateTask: (status: TaskStatus) => void;
    onOpenTasksView: () => void;
    onToggleCreateTaskForm: () => void;
    onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
};

export function ProjectBoardPage({
    createTaskForm,
    isCreateTaskOpen,
    project,
    onCreateTask,
    onCreateTaskFormChange,
    onOpenCreateTask,
    onOpenTasksView,
    onToggleCreateTaskForm,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
}: ProjectBoardPageProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
    const [hoveredColumn, setHoveredColumn] = useState<TaskStatus | null>(null);

    function moveTask(taskId: number, nextStatus: TaskStatus): void {
        const task = project.tasks.find((item) => item.id === taskId);
        if (!task || task.status === nextStatus) {
            return;
        }

        onUpdateTaskStatus(taskId, nextStatus);
    }

    return (
        <Flex direction="column" gap="4" flex="1" minH="0">
            <Text
                fontSize="xs"
                textTransform="uppercase"
                letterSpacing="0.16em"
                color="#90a0b7"
                flexShrink={0}
            >
                Board
            </Text>

            <SurfaceCard p="0" overflow="hidden" flex="1" minH="0">
                <Grid
                    templateColumns={{
                        base: "1fr",
                        xl: `repeat(${Math.max(project.boardColumns.length, 1)}, minmax(0, 1fr))`,
                    }}
                    gap="0"
                    flex="1"
                    minH="0"
                    alignItems="stretch"
                >
                    {project.boardColumns.map((column, columnIndex) => {
                        const tasks = sortTasksByPriority(
                            project.tasks.filter((task) => task.status === column.id),
                        );
                        const isHovered = hoveredColumn === column.id;

                        return (
                            <Box
                                key={column.id}
                                p="4"
                                bg={isHovered ? "#111e34" : "#0f141b"}
                                h="full"
                                minH="0"
                                borderRightWidth={{ base: "0", xl: columnIndex === project.boardColumns.length - 1 ? "0" : "1px" }}
                                borderBottomWidth={{ base: columnIndex === project.boardColumns.length - 1 ? "0" : "1px", xl: "0" }}
                                borderColor="#273140"
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setHoveredColumn(column.id);
                                }}
                                onDragLeave={() => {
                                    if (hoveredColumn === column.id) {
                                        setHoveredColumn(null);
                                    }
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    const taskId = Number(event.dataTransfer.getData("text/task-id") || draggedTaskId);
                                    if (Number.isFinite(taskId)) {
                                        moveTask(taskId, column.id);
                                    }
                                    setDraggedTaskId(null);
                                    setHoveredColumn(null);
                                }}
                            >
                                <Stack gap="4" h="full" minH="0">
                                    <Stack gap="1" flexShrink={0}>
                                        <Heading size="sm" color="#f5f7fb">
                                            {column.label}
                                        </Heading>
                                        <Text color="#90a0b7" fontSize="sm">
                                            {tasks.length} tasks
                                        </Text>
                                    </Stack>

                                    <Stack gap="3" flex="1" minH="0" overflowY="auto">
                                        {tasks.map((task) => (
                                            <SurfaceCard
                                                key={task.id}
                                                p="3"
                                                bg="#111720"
                                                cursor="grab"
                                                draggable
                                                opacity={draggedTaskId === task.id ? 0.55 : 1}
                                                onDragStart={(event) => {
                                                    setDraggedTaskId(task.id);
                                                    event.dataTransfer.setData("text/task-id", String(task.id));
                                                    event.dataTransfer.effectAllowed = "move";
                                                }}
                                                onDragEnd={() => {
                                                    setDraggedTaskId(null);
                                                    setHoveredColumn(null);
                                                }}
                                            >
                                                <Stack gap="3">
                                                    <Flex justify="space-between" align="flex-start" gap="3">
                                                        <Heading size="sm" color="#f5f7fb" fontSize="md" flex="1">
                                                            {task.title}
                                                        </Heading>
                                                        <DropdownMenu
                                                            width="210px"
                                                            items={[
                                                                ...project.boardColumns
                                                                    .filter((nextColumn) => nextColumn.id !== task.status)
                                                                    .map((nextColumn) => ({
                                                                        label: `Move to ${nextColumn.label}`,
                                                                        onClick: () => moveTask(task.id, nextColumn.id),
                                                                    })),
                                                                ...PRIORITY_OPTIONS
                                                                    .filter((priority) => priority !== task.priority)
                                                                    .map((priority) => ({
                                                                        label: `Set ${getPriorityLabel(priority)} priority`,
                                                                        onClick: () => onUpdateTaskPriority(task.id, priority),
                                                                    })),
                                                                {
                                                                    label: "Open in Tasks",
                                                                    onClick: onOpenTasksView,
                                                                },
                                                            ]}
                                                            renderTrigger={({ toggle }) => (
                                                                <Button
                                                                    minW="8"
                                                                    h="8"
                                                                    px="0"
                                                                    variant="ghost"
                                                                    borderRadius="10px"
                                                                    color="#90a0b7"
                                                                    _hover={{ bg: "#161e2a", color: "#eef3fb" }}
                                                                    onClick={toggle}
                                                                >
                                                                    <ActionIcon>
                                                                        <MoreIcon size={16} />
                                                                    </ActionIcon>
                                                                </Button>
                                                            )}
                                                        />
                                                    </Flex>
                                                    <Text color="#90a0b7" fontSize="sm" lineClamp="2">
                                                        {task.description || "No description yet."}
                                                    </Text>
                                                    <Stack direction="row" wrap="wrap">
                                                        <PriorityPill priority={task.priority} />
                                                        {task.isResolutionTask ? <StatusPill label="Resolution" /> : null}
                                                        {task.bugReportTitle ? <StatusPill label={task.bugReportTitle} /> : null}
                                                    </Stack>
                                                    <Text color="#d8e1ee" fontSize="sm">
                                                        {task.assignees.length
                                                            ? `Assigned to ${task.assignees.map((assignee) => assignee.username).join(", ")}`
                                                            : "Unassigned"}
                                                    </Text>
                                                </Stack>
                                            </SurfaceCard>
                                        ))}
                                    </Stack>

                                    <Button
                                        variant="outline"
                                        borderColor="#2b3544"
                                        color="#eef3fb"
                                        borderRadius="10px"
                                        onClick={() => onOpenCreateTask(column.id)}
                                    >
                                        <ActionIcon>
                                            <PlusIcon size={16} />
                                        </ActionIcon>
                                        Create task
                                    </Button>
                                </Stack>
                            </Box>
                        );
                    })}
                </Grid>
            </SurfaceCard>

            <CreateTaskModal
                form={createTaskForm}
                isOpen={isCreateTaskOpen}
                project={project}
                onClose={onToggleCreateTaskForm}
                onCreateTask={onCreateTask}
                onFormChange={onCreateTaskFormChange}
            />
        </Flex>
    );
}
