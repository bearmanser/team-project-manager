import { Button, Grid, Heading, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import { StatusPill } from "../components/StatusPill";
import type { ProjectDetail, TaskStatus } from "../types";

type ProjectBoardPageProps = {
    project: ProjectDetail;
    onOpenTasks: () => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
};

export function ProjectBoardPage({
    project,
    onOpenTasks,
    onUpdateTaskStatus,
}: ProjectBoardPageProps) {
    const statuses = project.boardColumns.map((column) => column.id);

    return (
        <Stack gap="6">
            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Stack gap="3">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                        Project board
                    </Text>
                    <Heading size="2xl" color="#f5f7fb">
                        {project.name}
                    </Heading>
                    <Text color="#b0bccf" maxW="2xl">
                        Delivery board for the project. Tasks, bugs, and repo ownership remain project-scoped, while
                        users stay managed at the organization level.
                    </Text>
                </Stack>
            </SurfaceCard>

            <Grid templateColumns={{ base: "1fr", xl: `repeat(${Math.max(project.boardColumns.length, 1)}, 1fr)` }} gap="4">
                {project.boardColumns.map((column) => (
                    <SurfaceCard key={column.id} p="4" bg="#0f141b">
                        <Stack gap="4">
                            <Stack gap="1">
                                <Heading size="sm" color="#f5f7fb">
                                    {column.label}
                                </Heading>
                                <Text color="#90a0b7" fontSize="sm">
                                    {project.tasks.filter((task) => task.status === column.id).length} tasks
                                </Text>
                            </Stack>

                            {project.tasks
                                .filter((task) => task.status === column.id)
                                .map((task) => {
                                    const currentIndex = statuses.indexOf(task.status);
                                    const nextStatus = statuses[currentIndex + 1];

                                    return (
                                        <SurfaceCard key={task.id} p="4" bg="#111720">
                                            <Stack gap="3">
                                                <Heading size="sm" color="#f5f7fb">
                                                    {task.title}
                                                </Heading>
                                                <Text color="#90a0b7">{task.description || "No description yet."}</Text>
                                                <Stack direction="row" wrap="wrap">
                                                    {task.isResolutionTask ? <StatusPill label="Resolution task" /> : null}
                                                    {task.bugReportTitle ? <StatusPill label={task.bugReportTitle} /> : null}
                                                </Stack>
                                                <Text color="#d8e1ee" fontSize="sm">
                                                    {task.assignees.length
                                                        ? `Assigned to ${task.assignees.map((assignee) => assignee.username).join(", ")}`
                                                        : "Unassigned"}
                                                </Text>
                                                {nextStatus ? (
                                                    <Button
                                                        borderRadius="0"
                                                        variant="outline"
                                                        borderColor="#2b3544"
                                                        color="#eef3fb"
                                                        onClick={() => onUpdateTaskStatus(task.id, nextStatus)}
                                                    >
                                                        Move to {project.taskStatusLabels[nextStatus]}
                                                    </Button>
                                                ) : null}
                                            </Stack>
                                        </SurfaceCard>
                                    );
                                })}
                        </Stack>
                    </SurfaceCard>
                ))}
            </Grid>

            <Button
                alignSelf="flex-start"
                borderRadius="0"
                variant="outline"
                borderColor="#2b3544"
                color="#eef3fb"
                onClick={onOpenTasks}
            >
                Open task manager
            </Button>
        </Stack>
    );
}
