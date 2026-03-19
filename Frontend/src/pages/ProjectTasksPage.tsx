import { useEffect, useMemo, useRef, useState } from "react";

import { Box, Button, Flex, Grid, Heading, Input, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { EditTextIcon, PlusIcon } from "../components/icons";
import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { BacklogPlacement, PriorityLevel, ProjectDetail, Task, TaskStatus } from "../types";
import {
    formatShortDate,
    getPriorityLabel,
    getPriorityOptionStyle,
    getPrioritySelectStyle,
    getProductBacklogTasks,
    getSprintBacklogTasks,
    getTaskPlacement,
    getTaskStatusOptionStyle,
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
        placement: BacklogPlacement;
    };
    hiddenProductBacklogTaskIds: number[];
    isCreateOpen: boolean;
    project: ProjectDetail;
    onCleanupProductBacklogDoneTasks: (projectId: number, taskIds: number[]) => void;
    onCreateTask: () => void;
    onCreateTaskFormChange: (field: "title" | "description" | "status" | "priority" | "placement", value: string) => void;
    onToggleCreateForm: () => void;
    onOpenCreateTask: (status: TaskStatus, placement?: BacklogPlacement) => void;
    onOpenTask: (taskId: number) => void;
    onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
    onMoveTaskPlacement: (taskId: number, placement: BacklogPlacement) => void;
    onRenameSprint: (name: string) => void;
    onCreateTaskBranch: (task: Task) => void;
};

function TaskRow({
    draggable,
    project,
    task,
    onDragEnd,
    onDragStart,
    onOpenTask,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
}: {
    draggable: boolean;
    project: ProjectDetail;
    task: Task;
    onDragEnd: () => void;
    onDragStart: (taskId: number) => void;
    onOpenTask: (taskId: number) => void;
    onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
}) {
    const meta = [
        task.description || "No description",
        task.assignees.length ? `Assigned to ${task.assignees.map((assignee) => assignee.username).join(", ")}` : "Unassigned",
        `Updated ${formatShortDate(task.updatedAt)}`,
    ].join(" - ");

    return (
        <Flex
            px={{ base: "4", lg: "5" }}
            py="3"
            align={{ base: "flex-start", lg: "center" }}
            justify="space-between"
            gap="3"
            wrap="wrap"
            borderBottomWidth="1px"
            borderColor="var(--color-border-default)"
            _last={{ borderBottomWidth: "0" }}
            draggable={draggable}
            cursor={draggable ? "grab" : "default"}
            onDragStart={(event) => {
                if (!draggable) {
                    return;
                }
                event.dataTransfer.setData("text/task-id", String(task.id));
                event.dataTransfer.effectAllowed = "move";
                onDragStart(task.id);
            }}
            onDragEnd={onDragEnd}
        >
            <Stack gap="1.5" flex="1" minW="260px" cursor="pointer" onClick={() => onOpenTask(task.id)}>
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
                        onChange={(event) => onUpdateTaskPriority(task.id, event.target.value as PriorityLevel)}
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
                        value={task.status}
                        style={{ ...getTaskStatusSelectStyle(task.status), minWidth: 170 }}
                        onChange={(event) => onUpdateTaskStatus(task.id, event.target.value as TaskStatus)}
                    >
                        {project.boardColumns.map((column) => (
                            <option key={column.id} value={column.id} style={getTaskStatusOptionStyle(column.id)}>
                                {column.label}
                            </option>
                        ))}
                    </select>
                </Box>
            </Flex>
        </Flex>
    );
}

export function ProjectTasksPage({
    createTaskForm,
    hiddenProductBacklogTaskIds,
    isCreateOpen,
    project,
    onCleanupProductBacklogDoneTasks,
    onCreateTask,
    onCreateTaskFormChange,
    onToggleCreateForm,
    onOpenCreateTask,
    onOpenTask,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
    onMoveTaskPlacement,
    onRenameSprint,
}: ProjectTasksPageProps) {
    const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
    const [hoveredSection, setHoveredSection] = useState<BacklogPlacement | null>(null);
    const [isRenamingSprint, setIsRenamingSprint] = useState(false);
    const [sprintNameDraft, setSprintNameDraft] = useState(project.activeSprint?.name ?? "");
    const cleanupRef = useRef({ project, onCleanupProductBacklogDoneTasks });
    cleanupRef.current = { project, onCleanupProductBacklogDoneTasks };
    const activeSprint = project.activeSprint;
    const canRenameSprint = project.role === "owner" || project.role === "admin";

    useEffect(() => {
        return () => {
            const { project: currentProject, onCleanupProductBacklogDoneTasks: onCleanup } = cleanupRef.current;
            if (!currentProject.useSprints) {
                return;
            }

            const taskIds = currentProject.tasks
                .filter(
                    (task) =>
                        getTaskPlacement(task, currentProject.activeSprint) === "product" && task.status === "done",
                )
                .map((task) => task.id);
            onCleanup(currentProject.id, taskIds);
        };
    }, []);

    useEffect(() => {
        setSprintNameDraft(activeSprint?.name ?? "");
        setIsRenamingSprint(false);
    }, [activeSprint?.id, activeSprint?.name]);

    const hiddenProductTaskIdSet = useMemo(() => new Set(hiddenProductBacklogTaskIds), [hiddenProductBacklogTaskIds]);
    const tasks = sortTasksByPriority(project.tasks);
    const sprintBacklog = getSprintBacklogTasks(project);
    const productBacklog = getProductBacklogTasks(project).filter(
        (task) => !(hiddenProductTaskIdSet.has(task.id) && task.status === "done"),
    );

    const sections = project.useSprints
        ? [
              {
                  key: "sprint",
                  placement: "sprint" as BacklogPlacement,
                  title: activeSprint?.name ?? "Sprint backlog",
                  description: "The active sprint work currently flowing through the board.",
                  tasks: sprintBacklog,
                  onCreate: () => onOpenCreateTask("todo", "sprint"),
              },
              {
                  key: "product",
                  placement: "product" as BacklogPlacement,
                  title: "Product backlog",
                  description: "Ready work that has not been pulled into the current sprint yet.",
                  tasks: productBacklog,
                  onCreate: () => onOpenCreateTask("todo", "product"),
              },
          ]
        : [
              {
                  key: "all",
                  placement: "product" as BacklogPlacement,
                  title: "All tasks",
                  description: "Keep tasks lightweight, update status and priority inline, and add new work from the create button instead of a permanent form.",
                  tasks,
                  onCreate: () => onToggleCreateForm(),
              },
          ];

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

    function handleDrop(taskId: number, placement: BacklogPlacement): void {
        if (!project.useSprints) {
            return;
        }

        onMoveTaskPlacement(taskId, placement);
        setDraggedTaskId(null);
        setHoveredSection(null);
    }

    return (
        <Flex direction="column" gap="6" flex="1" minH="0">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Tasks
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
                    onClick={() => onOpenCreateTask("todo", "product")}
                >
                    <ActionIcon>
                        <PlusIcon />
                    </ActionIcon>
                </Button>
            </Flex>

            <Grid templateColumns="1fr" gap="4" flex="1" minH="0">
                {sections.map((section) => {
                    const isDropTarget = hoveredSection === section.placement && project.useSprints;
                    const isSprintSection = project.useSprints && section.placement === "sprint";

                    return (
                        <SurfaceCard
                            key={section.key}
                            p="0"
                            overflow="hidden"
                            display="flex"
                            flexDirection="column"
                            minH="0"
                            borderColor={isDropTarget ? "var(--color-accent-border)" : "var(--color-border-default)"}
                            bg={isDropTarget ? "var(--color-bg-hover)" : "var(--color-bg-card)"}
                            onDragOver={(event) => {
                                if (!project.useSprints) {
                                    return;
                                }
                                event.preventDefault();
                                setHoveredSection(section.placement);
                            }}
                            onDragLeave={() => {
                                if (hoveredSection === section.placement) {
                                    setHoveredSection(null);
                                }
                            }}
                            onDrop={(event) => {
                                if (!project.useSprints) {
                                    return;
                                }
                                event.preventDefault();
                                const dragValue = event.dataTransfer.getData("text/task-id");
                                const taskId = dragValue ? Number(dragValue) : draggedTaskId;
                                if (taskId !== null && Number.isFinite(taskId)) {
                                    handleDrop(taskId, section.placement);
                                }
                            }}
                        >
                            <Flex
                                justify="space-between"
                                align={{ base: "stretch", md: "center" }}
                                gap="3"
                                wrap="wrap"
                                px="5"
                                py="4"
                                bg="var(--color-bg-muted)"
                            >
                                {isSprintSection && activeSprint ? (
                                    isRenamingSprint ? (
                                        <Stack gap="3" flex="1" minW="280px">
                                            <Text
                                                fontSize="xs"
                                                textTransform="uppercase"
                                                letterSpacing="0.16em"
                                                color="var(--color-text-muted)"
                                            >
                                                Sprint backlog
                                            </Text>
                                            <Input
                                                value={sprintNameDraft}
                                                onChange={(event) => setSprintNameDraft(event.target.value)}
                                                bg="var(--color-bg-card)"
                                                borderColor="var(--color-border-strong)"
                                                borderRadius="lg"
                                                color="var(--color-text-primary)"
                                                fontSize="var(--chakra-fontSizes-xl)"
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
                                            <Text color="var(--color-text-muted)">{section.description}</Text>
                                        </Stack>
                                    ) : (
                                        <Stack gap="1">
                                            <Text
                                                fontSize="xs"
                                                textTransform="uppercase"
                                                letterSpacing="0.16em"
                                                color="var(--color-text-muted)"
                                            >
                                                Sprint backlog
                                            </Text>
                                            <Flex align="center" gap="2" wrap="wrap">
                                                <Heading size="md" color="var(--color-text-primary)">
                                                    {section.title}
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
                                            <Text color="var(--color-text-muted)">{section.description}</Text>
                                        </Stack>
                                    )
                                ) : (
                                    <Stack gap="1">
                                        <Heading size="md" color="var(--color-text-primary)">
                                            {section.title}
                                        </Heading>
                                        <Text color="var(--color-text-muted)">{section.description}</Text>
                                    </Stack>
                                )}
                                <Button
                                    borderRadius="lg"
                                    variant="outline"
                                    borderColor="var(--color-border-strong)"
                                    color="var(--color-text-primary)"
                                    _hover={{ bg: "var(--color-bg-hover)" }}
                                    onClick={section.onCreate}
                                >
                                    Add task
                                </Button>
                            </Flex>
                            <Stack gap="0" flex="1" minH="0" overflowY="auto">
                                {section.tasks.length ? (
                                    section.tasks.map((task) => (
                                        <TaskRow
                                            key={task.id}
                                            draggable={project.useSprints}
                                            project={project}
                                            task={task}
                                            onDragEnd={() => {
                                                setDraggedTaskId(null);
                                                setHoveredSection(null);
                                            }}
                                            onDragStart={setDraggedTaskId}
                                            onOpenTask={onOpenTask}
                                            onUpdateTaskPriority={onUpdateTaskPriority}
                                            onUpdateTaskStatus={onUpdateTaskStatus}
                                        />
                                    ))
                                ) : (
                                    <Stack p="6" gap="2">
                                        <Text color="var(--color-text-primary)" fontWeight="600">
                                            No tasks here yet.
                                        </Text>
                                        <Text color="var(--color-text-muted)">Add a task to start filling this backlog.</Text>
                                    </Stack>
                                )}
                            </Stack>
                        </SurfaceCard>
                    );
                })}
            </Grid>

            <CreateTaskModal
                form={createTaskForm}
                isOpen={isCreateOpen}
                project={project}
                onClose={onToggleCreateForm}
                onCreateTask={onCreateTask}
                onFormChange={onCreateTaskFormChange}
            />
        </Flex>
    );
}

