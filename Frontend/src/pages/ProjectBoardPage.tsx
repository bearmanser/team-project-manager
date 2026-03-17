import { useState } from "react";

import { Grid, Heading, Stack, Text } from "@chakra-ui/react";

import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { ProjectDetail, TaskStatus } from "../types";

type ProjectBoardPageProps = {
    project: ProjectDetail;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
};

export function ProjectBoardPage({ project, onUpdateTaskStatus }: ProjectBoardPageProps) {
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
        <Stack gap="6">
            <Stack gap="1">
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                    Board
                </Text>
                <Heading size="2xl" color="#f5f7fb">
                    {project.name}
                </Heading>
                <Text color="#b0bccf" maxW="2xl">
                    Drag cards between columns to move them. The board is now the movement surface, not a stack of "Move to" buttons.
                </Text>
            </Stack>

            <Grid templateColumns={{ base: "1fr", xl: `repeat(${Math.max(project.boardColumns.length, 1)}, 1fr)` }} gap="4">
                {project.boardColumns.map((column) => {
                    const tasks = project.tasks.filter((task) => task.status === column.id);
                    const isHovered = hoveredColumn === column.id;

                    return (
                        <SurfaceCard
                            key={column.id}
                            p="4"
                            bg={isHovered ? "#111e34" : "#0f141b"}
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
                            <Stack gap="4">
                                <Stack gap="1">
                                    <Heading size="sm" color="#f5f7fb">
                                        {column.label}
                                    </Heading>
                                    <Text color="#90a0b7" fontSize="sm">
                                        {tasks.length} tasks
                                    </Text>
                                </Stack>

                                {tasks.map((task) => (
                                    <SurfaceCard
                                        key={task.id}
                                        p="4"
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
                                            <Heading size="sm" color="#f5f7fb">
                                                {task.title}
                                            </Heading>
                                            <Text color="#90a0b7">{task.description || "No description yet."}</Text>
                                            <Stack direction="row" wrap="wrap">
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
                        </SurfaceCard>
                    );
                })}
            </Grid>
        </Stack>
    );
}
