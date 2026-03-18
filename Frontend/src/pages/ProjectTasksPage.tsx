import { Box, Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";

import { ActionIcon } from "../components/ActionIcon";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { PlusIcon } from "../components/icons";
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
    isCreateOpen: boolean;
    project: ProjectDetail;
    onCreateTask: () => void;
    onCreateTaskFormChange: (field: "title" | "description" | "status" | "priority" | "placement", value: string) => void;
    onToggleCreateForm: () => void;
    onOpenCreateTask: (status: TaskStatus, placement?: BacklogPlacement) => void;
    onOpenTask: (taskId: number) => void;
    onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
    onMoveTaskPlacement: (taskId: number, placement: BacklogPlacement) => void;
};

function TaskRow({
    project,
    task,
    onOpenTask,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
    onMoveTaskPlacement,
}: {
    project: ProjectDetail;
    task: Task;
    onOpenTask: (taskId: number) => void;
    onUpdateTaskPriority: (taskId: number, priority: PriorityLevel) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
    onMoveTaskPlacement: (taskId: number, placement: BacklogPlacement) => void;
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
                {project.useSprints && task.sprintName ? <StatusPill label={task.sprintName} /> : null}
            </Flex>
            <Flex gap="2" wrap="wrap" align="center">
                {project.useSprints ? (
                    <Button
                        size="sm"
                        borderRadius="full"
                        variant="outline"
                        borderColor="var(--color-border-strong)"
                        color="var(--color-text-primary)"
                        _hover={{ bg: "var(--color-bg-hover)" }}
                        onClick={() =>
                            onMoveTaskPlacement(
                                task.id,
                                getTaskPlacement(task, project.activeSprint) === "sprint" ? "product" : "sprint",
                            )
                        }
                    >
                        {getTaskPlacement(task, project.activeSprint) === "sprint" ? "To product backlog" : "Add to sprint"}
                    </Button>
                ) : null}
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
    isCreateOpen,
    project,
    onCreateTask,
    onCreateTaskFormChange,
    onToggleCreateForm,
    onOpenCreateTask,
    onOpenTask,
    onUpdateTaskPriority,
    onUpdateTaskStatus,
    onMoveTaskPlacement,
}: ProjectTasksPageProps) {
    const tasks = sortTasksByPriority(project.tasks);
    const sprintBacklog = getSprintBacklogTasks(project);
    const productBacklog = getProductBacklogTasks(project);

    const sections = project.useSprints
        ? [
              {
                  key: "sprint",
                  title: project.activeSprint ? `${project.activeSprint.name} backlog` : "Sprint backlog",
                  description: "The active sprint work currently flowing through the board.",
                  tasks: sprintBacklog,
                  onCreate: () => onOpenCreateTask("todo", "sprint"),
              },
              {
                  key: "product",
                  title: "Product backlog",
                  description: "Ready work that has not been pulled into the current sprint yet.",
                  tasks: productBacklog,
                  onCreate: () => onOpenCreateTask("todo", "product"),
              },
          ]
        : [
              {
                  key: "all",
                  title: "All tasks",
                  description: "Keep tasks lightweight, update status and priority inline, and add new work from the create button instead of a permanent form.",
                  tasks,
                  onCreate: () => onToggleCreateForm(),
              },
          ];

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
                        {project.useSprints
                            ? "Plan work between the active sprint and product backlog without losing quick inline edits."
                            : "Keep tasks lightweight, update status and priority inline, and add new work from the create button instead of a permanent form."}
                    </Text>
                </Stack>
                <Button
                    minW="11"
                    h="11"
                    borderRadius="lg"
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
                    _hover={{ bg: "var(--color-accent-hover)" }}
                    onClick={() => onOpenCreateTask("todo", project.useSprints ? "product" : "product")}
                >
                    <ActionIcon>
                        <PlusIcon />
                    </ActionIcon>
                </Button>
            </Flex>

            <Stack gap="4">
                {sections.map((section) => (
                    <SurfaceCard key={section.key} p="0" overflow="hidden">
                        <Stack gap="0">
                            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="3" wrap="wrap" px="5" py="4" bg="var(--color-bg-muted)">
                                <Stack gap="1">
                                    <Heading size="md" color="var(--color-text-primary)">
                                        {section.title}
                                    </Heading>
                                    <Text color="var(--color-text-muted)">{section.description}</Text>
                                </Stack>
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
                            {section.tasks.length ? (
                                section.tasks.map((task) => (
                                    <TaskRow
                                        key={task.id}
                                        project={project}
                                        task={task}
                                        onOpenTask={onOpenTask}
                                        onUpdateTaskPriority={onUpdateTaskPriority}
                                        onUpdateTaskStatus={onUpdateTaskStatus}
                                        onMoveTaskPlacement={onMoveTaskPlacement}
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
                ))}
            </Stack>

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
