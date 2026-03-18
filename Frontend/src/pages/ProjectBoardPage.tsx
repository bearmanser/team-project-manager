import { useEffect, useMemo, useState } from "react";

import { Box, Button, Flex, Grid, Heading, Input, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { DropdownMenu } from "../components/DropdownMenu";
import { EditTextIcon, MoreIcon, PlusIcon } from "../components/icons";
import { PriorityPill } from "../components/PriorityPill";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { BacklogPlacement, PriorityLevel, ProjectDetail, TaskStatus } from "../types";
import {
    getPriorityLabel,
    getSprintBacklogTasks,
    getTaskPlacement,
    PRIORITY_OPTIONS,
    sortTasksByPriority,
} from "../utils";

type ProjectBoardPageProps = {
    createTaskForm: {
        title: string;
        description: string;
        status: TaskStatus;
        priority: PriorityLevel;
        placement: BacklogPlacement;
    };
    isCreateTaskOpen: boolean;
    project: ProjectDetail;
    onCreateTask: () => void;
    onCreateTaskFormChange: (
        field: "title" | "description" | "status" | "priority" | "placement",
        value: string,
    ) => void;
    onOpenCreateTask: (status: TaskStatus, placement?: BacklogPlacement) => void;
    onOpenTask: (taskId: number) => void;
    onRenameSprint: (name: string) => void;
    onToggleCreateTaskForm: () => void;
    onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
    onMoveTaskPlacement: (taskId: number, placement: BacklogPlacement) => void;
    onOpenEndSprint: () => void;
};

export function ProjectBoardPage({
    createTaskForm,
    isCreateTaskOpen,
    project,
    onCreateTask,
    onCreateTaskFormChange,
    onOpenCreateTask,
    onOpenTask,
    onRenameSprint,
    onToggleCreateTaskForm,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
    onMoveTaskPlacement,
    onOpenEndSprint,
}: ProjectBoardPageProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
    const [hoveredColumn, setHoveredColumn] = useState<TaskStatus | null>(null);
    const [isRenamingSprint, setIsRenamingSprint] = useState(false);
    const [sprintNameDraft, setSprintNameDraft] = useState(project.activeSprint?.name ?? "");

    const activeSprint = project.activeSprint;
    const canRenameSprint = project.role === "owner" || project.role === "admin";

    useEffect(() => {
        setSprintNameDraft(activeSprint?.name ?? "");
        setIsRenamingSprint(false);
    }, [activeSprint?.id, activeSprint?.name]);

    const boardTasks = useMemo(() => {
        if (!project.useSprints) {
            return sortTasksByPriority(project.tasks);
        }

        return getSprintBacklogTasks(project);
    }, [project]);

    function moveTask(taskId: number, nextStatus: TaskStatus): void {
        const task = project.tasks.find((item) => item.id === taskId);
        if (!task || task.status === nextStatus) {
            return;
        }

        onUpdateTaskStatus(taskId, nextStatus);
    }

    function submitSprintRename(): void {
        const nextName = sprintNameDraft.trim();
        if (!activeSprint) {
            return;
        }
        if (!nextName || nextName === activeSprint.name) {
            setSprintNameDraft(activeSprint.name);
            setIsRenamingSprint(false);
            return;
        }

        onRenameSprint(nextName);
        setIsRenamingSprint(false);
    }

    return (
        <Flex direction="column" gap="4" flex="1" minH="0">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text
                        fontSize="xs"
                        textTransform="uppercase"
                        letterSpacing="0.16em"
                        color="var(--color-text-muted)"
                        flexShrink={0}
                    >
                        {project.useSprints ? "Sprint board" : "Board"}
                    </Text>
                    {project.useSprints && activeSprint ? (
                        isRenamingSprint ? (
                            <Stack gap="3" maxW="420px">
                                <Input
                                    value={sprintNameDraft}
                                    onChange={(event) => setSprintNameDraft(event.target.value)}
                                    bg="var(--color-bg-muted)"
                                    borderColor="var(--color-border-strong)"
                                    borderRadius="lg"
                                    color="var(--color-text-primary)"
                                    fontSize="var(--chakra-fontSizes-3xl)"
                                    fontWeight="700"
                                    h="auto"
                                    py="3"
                                    px="4"
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            submitSprintRename();
                                        }
                                        if (event.key === "Escape" && activeSprint) {
                                            setSprintNameDraft(activeSprint.name);
                                            setIsRenamingSprint(false);
                                        }
                                    }}
                                />
                                <Flex gap="2" wrap="wrap">
                                    <Button
                                        borderRadius="lg"
                                        bg="var(--color-accent)"
                                        color="var(--color-text-inverse)"
                                        _hover={{ bg: "var(--color-accent-hover)" }}
                                        onClick={submitSprintRename}
                                        disabled={!sprintNameDraft.trim()}
                                    >
                                        Save name
                                    </Button>
                                    <Button
                                        borderRadius="lg"
                                        variant="outline"
                                        borderColor="var(--color-border-strong)"
                                        color="var(--color-text-primary)"
                                        _hover={{ bg: "var(--color-bg-hover)" }}
                                        onClick={() => {
                                            setSprintNameDraft(activeSprint.name);
                                            setIsRenamingSprint(false);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </Flex>
                            </Stack>
                        ) : (
                            <Flex align="center" gap="2">
                                <Heading size="2xl" color="var(--color-text-primary)">
                                    {activeSprint.name}
                                </Heading>
                                {canRenameSprint ? (
                                    <Button
                                        minW="9"
                                        h="9"
                                        px="0"
                                        variant="ghost"
                                        borderRadius="lg"
                                        color="var(--color-text-muted)"
                                        _hover={{ bg: "var(--color-bg-hover)", color: "var(--color-text-primary)" }}
                                        onClick={() => setIsRenamingSprint(true)}
                                        aria-label="Rename sprint"
                                    >
                                        <ActionIcon>
                                            <EditTextIcon size={16} />
                                        </ActionIcon>
                                    </Button>
                                ) : null}
                            </Flex>
                        )
                    ) : (
                        <Heading size="2xl" color="var(--color-text-primary)">
                            {project.name}
                        </Heading>
                    )}
                    <Text color="var(--color-text-secondary)">
                        {project.useSprints
                            ? "Run a scrumban flow through the active sprint while keeping fresh work in the product backlog."
                            : "Move work across the board and keep delivery visible."}
                    </Text>
                </Stack>
                {project.useSprints ? (
                    <Button
                        alignSelf={{ base: "stretch", md: "flex-start" }}
                        borderRadius="lg"
                        bg="var(--color-accent)"
                        color="var(--color-text-inverse)"
                        _hover={{ bg: "var(--color-accent-hover)" }}
                        onClick={onOpenEndSprint}
                    >
                        End sprint
                    </Button>
                ) : null}
            </Flex>

            <SurfaceCard p="0" overflow="hidden" flex="1" minH="0">
                <Grid
                    templateColumns={{
                        base: "1fr",
                        xl: `repeat(${Math.max(project.boardColumns.length, 1)}, minmax(0, 1fr))`,
                    }}
                    gap="0"
                    flex="1"
                    minH="0"
                    h="full"
                    alignItems="stretch"
                >
                    {project.boardColumns.map((column, columnIndex) => {
                        const tasks = sortTasksByPriority(boardTasks.filter((task) => task.status === column.id));
                        const isHovered = hoveredColumn === column.id;

                        return (
                            <Box
                                key={column.id}
                                p="4"
                                bg={isHovered ? "var(--color-bg-hover-strong)" : "var(--color-bg-muted)"}
                                h="full"
                                minH="0"
                                borderRightWidth={{
                                    base: "0",
                                    xl: columnIndex === project.boardColumns.length - 1 ? "0" : "1px",
                                }}
                                borderBottomWidth={{
                                    base: columnIndex === project.boardColumns.length - 1 ? "0" : "1px",
                                    xl: "0",
                                }}
                                borderColor="var(--color-border-default)"
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
                                        <Heading size="sm" color="var(--color-text-primary)">
                                            {column.label}
                                        </Heading>
                                        <Text color="var(--color-text-muted)" fontSize="sm">
                                            {tasks.length} tasks
                                        </Text>
                                    </Stack>

                                    <Stack gap="3" flex="1" minH="0" overflowY="auto">
                                        {tasks.map((task) => (
                                            <SurfaceCard
                                                key={task.id}
                                                p="3"
                                                bg="var(--color-bg-card)"
                                                cursor="grab"
                                                draggable
                                                position="relative"
                                                opacity={draggedTaskId === task.id ? 0.55 : 1}
                                                onClick={() => onOpenTask(task.id)}
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
                                                    <Box position="relative" pt="6">
                                                        <Box position="absolute" top="0" left="50%" transform="translateX(-50%)">
                                                            <PriorityPill priority={task.priority} compact />
                                                        </Box>
                                                        <Flex justify="space-between" align="flex-start" gap="3">
                                                            <Heading size="sm" color="var(--color-text-primary)" fontSize="md" flex="1">
                                                                {task.title}
                                                            </Heading>
                                                            <DropdownMenu
                                                                width="230px"
                                                                items={[
                                                                    ...project.boardColumns
                                                                        .filter((nextColumn) => nextColumn.id !== task.status)
                                                                        .map((nextColumn) => ({
                                                                            label: `Move to ${nextColumn.label}`,
                                                                            onClick: () => moveTask(task.id, nextColumn.id),
                                                                        })),
                                                                    ...PRIORITY_OPTIONS.filter((priority) => priority !== task.priority).map((priority) => ({
                                                                        label: `Set ${getPriorityLabel(priority)} priority`,
                                                                        onClick: () => onUpdateTaskPriority(task.id, priority),
                                                                    })),
                                                                    ...(project.useSprints
                                                                        ? [
                                                                              {
                                                                                  label:
                                                                                      getTaskPlacement(task, project.activeSprint) === "sprint"
                                                                                          ? "Move to product backlog"
                                                                                          : "Move to sprint backlog",
                                                                                  onClick: () =>
                                                                                      onMoveTaskPlacement(
                                                                                          task.id,
                                                                                          getTaskPlacement(task, project.activeSprint) === "sprint"
                                                                                              ? "product"
                                                                                              : "sprint",
                                                                                      ),
                                                                              },
                                                                          ]
                                                                        : []),
                                                                    {
                                                                        label: "Open details",
                                                                        onClick: () => onOpenTask(task.id),
                                                                    },
                                                                ]}
                                                                renderTrigger={({ toggle }) => (
                                                                    <Button
                                                                        minW="8"
                                                                        h="8"
                                                                        px="0"
                                                                        variant="ghost"
                                                                        borderRadius="10px"
                                                                        color="var(--color-text-muted)"
                                                                        _hover={{ bg: "var(--color-bg-hover)", color: "var(--color-text-primary)" }}
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            toggle();
                                                                        }}
                                                                    >
                                                                        <ActionIcon>
                                                                            <MoreIcon size={16} />
                                                                        </ActionIcon>
                                                                    </Button>
                                                                )}
                                                            />
                                                        </Flex>
                                                    </Box>
                                                    <Text color="var(--color-text-muted)" fontSize="sm" lineClamp="2">
                                                        {task.description || "No description yet."}
                                                    </Text>
                                                    <Stack direction="row" wrap="wrap">
                                                        {task.isResolutionTask ? <StatusPill label="Resolution" /> : null}
                                                        {task.bugReportTitle ? <StatusPill label={task.bugReportTitle} /> : null}
                                                    </Stack>
                                                    <Text color="var(--color-text-strong)" fontSize="sm">
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
                                        borderColor="var(--color-border-strong)"
                                        color="var(--color-text-primary)"
                                        borderRadius="10px"
                                        _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                        onClick={() => onOpenCreateTask(column.id, project.useSprints ? "sprint" : "product")}
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
