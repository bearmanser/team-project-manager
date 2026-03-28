import { useEffect, useMemo, useRef, useState } from "react";

import { Box, Button, Flex, Grid, Heading, Input, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "../../../components/ActionIcon";
import { DropdownMenu } from "../../../components/DropdownMenu";
import { EditTextIcon, MoreIcon, PlusIcon } from "../../../components/icons";
import { ModalFrame } from "../../../components/ModalFrame";
import { PriorityPill } from "../../../components/PriorityPill";
import { SurfaceCard } from "../../../components/SurfaceCard";
import { CreateTaskModal } from "../modals/CreateTaskModal";
import type { BacklogPlacement, BoardColumn, PriorityLevel, ProjectDetail, Task, TaskStatus } from "../../../types";
import {
    getPriorityLabel,
    getPriorityOptionStyle,
    getPrioritySelectStyle,
    getSprintBacklogTasks,
    getTaskPlacement,
    getTaskStatusOptionStyle,
    getTaskStatusSelectStyle,
    nativeSelectStyle,
    PRIORITY_OPTIONS,
    sortTasksByPriority,
} from "../../../utils";

type ProjectBoardPageProps = {
    createTaskForm: {
        title: string;
        description: string;
        status: TaskStatus;
        priority: PriorityLevel;
        placement: BacklogPlacement;
        bugReportId: number | null;
        bugReportTitle: string;
        markAsResolution: boolean;
    };
    isCreateTaskOpen: boolean;
    project: ProjectDetail;
    onCreateTask: () => void;
    onCreateTaskFormChange: (
        field: "title" | "description" | "status" | "priority" | "placement",
        value: string,
    ) => void;
    onMarkTaskAsResolutionChange: (value: boolean) => void;
    onOpenCreateTask: (status: TaskStatus, placement?: BacklogPlacement) => void;
    onOpenTask: (taskId: number) => void;
    onRenameSprint: (name: string) => void;
    onToggleCreateTaskForm: () => void;
    onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
    onMoveTaskPlacement: (taskId: number, placement: BacklogPlacement) => void;
    onOpenEndSprint: () => void;
    onCreateTaskBranch: (task: Task) => void;
};

export function ProjectBoardPage({
    createTaskForm,
    isCreateTaskOpen,
    project,
    onCreateTask,
    onCreateTaskFormChange,
    onMarkTaskAsResolutionChange,
    onOpenCreateTask,
    onOpenTask,
    onRenameSprint,
    onToggleCreateTaskForm,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
    onMoveTaskPlacement,
    onOpenEndSprint,
    onCreateTaskBranch,
}: ProjectBoardPageProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
    const [hoveredColumn, setHoveredColumn] = useState<TaskStatus | null>(null);
    const [isRenamingSprint, setIsRenamingSprint] = useState(false);
    const [sprintNameDraft, setSprintNameDraft] = useState(project.activeSprint?.name ?? "");
    const [movePromptTask, setMovePromptTask] = useState<Task | null>(null);
    const [moveTargetStatus, setMoveTargetStatus] = useState<TaskStatus>(project.boardColumns[0]?.id ?? "todo");
    const [priorityPromptTask, setPriorityPromptTask] = useState<Task | null>(null);
    const [priorityTarget, setPriorityTarget] = useState<PriorityLevel>("medium");

    const activeSprint = project.activeSprint;
    const canRenameSprint = project.role === "owner" || project.role === "admin";
    const sprintDraftRef = useRef({
        sprintId: activeSprint?.id ?? null,
        isDirty: false,
    });

    useEffect(() => {
        const nextSprintId = activeSprint?.id ?? null;
        const isSameSprint = sprintDraftRef.current.sprintId === nextSprintId;
        const shouldPreserveDraft = isSameSprint && sprintDraftRef.current.isDirty;

        sprintDraftRef.current.sprintId = nextSprintId;

        if (shouldPreserveDraft) {
            return;
        }

        sprintDraftRef.current.isDirty = false;
        setSprintNameDraft(activeSprint?.name ?? "");
        setIsRenamingSprint(false);
    }, [activeSprint?.id, activeSprint?.name]);

    const boardTasks = useMemo(() => {
        if (!project.useSprints) {
            return sortTasksByPriority(project.tasks);
        }

        return getSprintBacklogTasks(project);
    }, [project]);

    const moveOptions = useMemo<BoardColumn[]>(() => {
        if (!movePromptTask) {
            return [];
        }

        return project.boardColumns.filter((column) => column.id !== movePromptTask.status);
    }, [movePromptTask, project.boardColumns]);

    const priorityOptions = useMemo<PriorityLevel[]>(() => {
        if (!priorityPromptTask) {
            return [];
        }

        return PRIORITY_OPTIONS.filter((priority) => priority !== priorityPromptTask.priority);
    }, [priorityPromptTask]);

    function moveTask(taskId: number, nextStatus: TaskStatus): void {
        const task = project.tasks.find((item) => item.id === taskId);
        if (!task || task.status === nextStatus) {
            return;
        }

        onUpdateTaskStatus(taskId, nextStatus);
    }

    function openMovePrompt(task: Task): void {
        const availableColumns = project.boardColumns.filter((column) => column.id !== task.status);
        if (!availableColumns.length) {
            return;
        }

        setMovePromptTask(task);
        setMoveTargetStatus(availableColumns[0].id);
    }

    function closeMovePrompt(): void {
        setMovePromptTask(null);
        setMoveTargetStatus(project.boardColumns[0]?.id ?? "todo");
    }

    function submitMovePrompt(): void {
        if (!movePromptTask) {
            return;
        }

        const selectedColumn = moveOptions.find((column) => column.id === moveTargetStatus);
        if (!selectedColumn) {
            return;
        }

        moveTask(movePromptTask.id, selectedColumn.id);
        closeMovePrompt();
    }

    function openPriorityPrompt(task: Task): void {
        const availablePriorities = PRIORITY_OPTIONS.filter((priority) => priority !== task.priority);
        if (!availablePriorities.length) {
            return;
        }

        setPriorityPromptTask(task);
        setPriorityTarget(availablePriorities[0]);
    }

    function closePriorityPrompt(): void {
        setPriorityPromptTask(null);
        setPriorityTarget("medium");
    }

    function submitPriorityPrompt(): void {
        if (!priorityPromptTask || !priorityOptions.includes(priorityTarget)) {
            return;
        }

        onUpdateTaskPriority(priorityPromptTask.id, priorityTarget);
        closePriorityPrompt();
    }

    function updateSprintNameDraft(value: string): void {
        sprintDraftRef.current.isDirty = value !== (activeSprint?.name ?? "");
        setSprintNameDraft(value);
    }

    function cancelSprintRename(): void {
        sprintDraftRef.current.isDirty = false;
        setSprintNameDraft(activeSprint?.name ?? "");
        setIsRenamingSprint(false);
    }

    function openSprintRename(): void {
        sprintDraftRef.current.isDirty = false;
        setSprintNameDraft(activeSprint?.name ?? "");
        setIsRenamingSprint(true);
    }

    function submitSprintRename(): void {
        const nextName = sprintNameDraft.trim();
        if (!activeSprint) {
            return;
        }
        if (!nextName || nextName === activeSprint.name) {
            cancelSprintRename();
            return;
        }

        sprintDraftRef.current.isDirty = false;
        onRenameSprint(nextName);
        setIsRenamingSprint(false);
    }

    return (
        <>
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
                                        onChange={(event) => updateSprintNameDraft(event.target.value)}
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
                                            if (event.key === "Escape") {
                                                cancelSprintRename();
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
                                            onClick={cancelSprintRename}
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
                                            onClick={openSprintRename}
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

                <SurfaceCard p="0" overflow="hidden" flex="1" minH="0" display="flex" flexDirection="column">
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
                                    h={{ base: "24rem", xl: "full" }}
                                    minH="0"
                                    display="flex"
                                    flexDirection="column"
                                    overflow="hidden"
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
                                    <Stack gap="4" h="full" minH="0" flex="1" overflow="hidden">
                                        <Stack gap="1" flexShrink={0}>
                                            <Heading size="sm" color="var(--color-text-primary)">
                                                {column.label}
                                            </Heading>
                                            <Text color="var(--color-text-muted)" fontSize="sm">
                                                {tasks.length} tasks
                                            </Text>
                                        </Stack>

                                        <Stack gap="3" flex="1" minH="0" overflowY="auto" pe="1">
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
                                                        <Flex justify="space-between" align="flex-start" gap="3">
                                                            <Stack gap="2" flex="1" minW="0">
                                                                <Flex
                                                                    align="center"
                                                                    gap="1.5"
                                                                    wrap="wrap"
                                                                    color="var(--color-text-muted)"
                                                                    fontSize="10px"
                                                                    fontWeight="700"
                                                                    letterSpacing="0.08em"
                                                                    textTransform="uppercase"
                                                                >
                                                                    <Text as="span" color="inherit" fontSize="inherit">
                                                                        Priority:
                                                                    </Text>
                                                                    <PriorityPill priority={task.priority} compact />
                                                                </Flex>
                                                                <Heading size="sm" color="var(--color-text-primary)" fontSize="md" flex="1">
                                                                    {task.title}
                                                                </Heading>
                                                            </Stack>
                                                            <Box flexShrink={0}>
                                                                <DropdownMenu
                                                                    width="230px"
                                                                    items={[
                                                                        {
                                                                            label: "Move task",
                                                                            onClick: () => openMovePrompt(task),
                                                                            disabled: project.boardColumns.length < 2,
                                                                        },
                                                                        {
                                                                            label: "Set priority",
                                                                            onClick: () => openPriorityPrompt(task),
                                                                            disabled: PRIORITY_OPTIONS.length < 2,
                                                                        },
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
                                                                            label: "Create git branch",
                                                                            onClick: () => onCreateTaskBranch(task),
                                                                            disabled:
                                                                                !project.permissions.canEditTasks ||
                                                                                !project.repositories.length,
                                                                        },
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
                                                            </Box>
                                                        </Flex>

                                                        <Text color="var(--color-text-muted)" fontSize="sm" lineClamp="2">
                                                            {task.description || "No description yet."}
                                                        </Text>
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
                                            flexShrink={0}
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
                    onMarkAsResolutionChange={onMarkTaskAsResolutionChange}
                />
            </Flex>

            <ModalFrame
                title="Move task"
                description={movePromptTask ? `Choose the next column for ${movePromptTask.title}.` : undefined}
                isOpen={Boolean(movePromptTask)}
                onClose={closeMovePrompt}
            >
                <Stack
                    as="form"
                    gap="4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitMovePrompt();
                    }}
                >
                    <select
                        value={moveTargetStatus}
                        style={moveOptions.length ? getTaskStatusSelectStyle(moveTargetStatus) : nativeSelectStyle}
                        onChange={(event) => setMoveTargetStatus(event.target.value as TaskStatus)}
                    >
                        {moveOptions.map((column) => (
                            <option key={column.id} value={column.id} style={getTaskStatusOptionStyle(column.id)}>
                                {column.label}
                            </option>
                        ))}
                    </select>
                    <Flex justify="flex-end" gap="3" wrap="wrap">
                        <Button
                            borderRadius="lg"
                            variant="outline"
                            borderColor="var(--color-border-strong)"
                            color="var(--color-text-primary)"
                            _hover={{ bg: "var(--color-bg-hover)" }}
                            onClick={closeMovePrompt}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            borderRadius="lg"
                            bg="var(--color-accent)"
                            color="var(--color-text-inverse)"
                            _hover={{ bg: "var(--color-accent-hover)" }}
                            disabled={!moveOptions.length}
                        >
                            Move task
                        </Button>
                    </Flex>
                </Stack>
            </ModalFrame>

            <ModalFrame
                title="Set priority"
                description={priorityPromptTask ? `Choose the new priority for ${priorityPromptTask.title}.` : undefined}
                isOpen={Boolean(priorityPromptTask)}
                onClose={closePriorityPrompt}
            >
                <Stack
                    as="form"
                    gap="4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitPriorityPrompt();
                    }}
                >
                    <select
                        value={priorityTarget}
                        style={priorityOptions.length ? getPrioritySelectStyle(priorityTarget) : nativeSelectStyle}
                        onChange={(event) => setPriorityTarget(event.target.value as PriorityLevel)}
                    >
                        {priorityOptions.map((priority) => (
                            <option key={priority} value={priority} style={getPriorityOptionStyle(priority)}>
                                {getPriorityLabel(priority)}
                            </option>
                        ))}
                    </select>
                    <Flex justify="flex-end" gap="3" wrap="wrap">
                        <Button
                            borderRadius="lg"
                            variant="outline"
                            borderColor="var(--color-border-strong)"
                            color="var(--color-text-primary)"
                            _hover={{ bg: "var(--color-bg-hover)" }}
                            onClick={closePriorityPrompt}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            borderRadius="lg"
                            bg="var(--color-accent)"
                            color="var(--color-text-inverse)"
                            _hover={{ bg: "var(--color-accent-hover)" }}
                            disabled={!priorityOptions.length}
                        >
                            Save priority
                        </Button>
                    </Flex>
                </Stack>
            </ModalFrame>
        </>
    );
}


