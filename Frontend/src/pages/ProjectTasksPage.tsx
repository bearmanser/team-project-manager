import { Button, Grid, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import { StatusPill } from "../components/StatusPill";
import type { ProjectDetail, TaskStatus } from "../types";
import { formatShortDate, nativeSelectStyle } from "../utils";

type ProjectTasksPageProps = {
    createTaskForm: {
        title: string;
        description: string;
        status: TaskStatus;
    };
    project: ProjectDetail;
    onCreateTask: () => void;
    onCreateTaskFormChange: (field: "title" | "description" | "status", value: string) => void;
    onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
};

export function ProjectTasksPage({
    createTaskForm,
    project,
    onCreateTask,
    onCreateTaskFormChange,
    onUpdateTaskStatus,
}: ProjectTasksPageProps) {
    return (
        <Stack gap="6">
            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Grid templateColumns={{ base: "1fr", xl: "0.8fr 1.2fr" }} gap="8">
                    <Stack
                        as="form"
                        gap="4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onCreateTask();
                        }}
                    >
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                            Create task
                        </Text>
                        <Input
                            value={createTaskForm.title}
                            onChange={(event) => onCreateTaskFormChange("title", event.target.value)}
                            placeholder="Ship org-level user management"
                            bg="#0f141b"
                            borderColor="#2b3544"
                            borderRadius="0"
                            color="#f5f7fb"
                        />
                        <Textarea
                            value={createTaskForm.description}
                            onChange={(event) => onCreateTaskFormChange("description", event.target.value)}
                            placeholder="Add the details teammates need."
                            bg="#0f141b"
                            borderColor="#2b3544"
                            borderRadius="0"
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
                        <Button type="submit" borderRadius="0" bg="#2d6cdf" color="#f8fbff">
                            Create task
                        </Button>
                    </Stack>

                    <Stack gap="4">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                            Task list
                        </Text>
                        {project.tasks.length ? (
                            project.tasks.map((task) => (
                                <SurfaceCard key={task.id} p="4" bg="#0f141b">
                                    <Stack gap="3">
                                        <Heading size="sm" color="#f5f7fb">
                                            {task.title}
                                        </Heading>
                                        <Text color="#90a0b7">{task.description || "No description yet."}</Text>
                                        <Stack direction="row" wrap="wrap">
                                            <StatusPill label={project.taskStatusLabels[task.status]} />
                                            {task.branchName ? <StatusPill label={task.branchName} /> : null}
                                        </Stack>
                                        <Text color="#d8e1ee" fontSize="sm">
                                            Updated {formatShortDate(task.updatedAt)}
                                        </Text>
                                        <select
                                            value={task.status}
                                            style={nativeSelectStyle}
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
                                    </Stack>
                                </SurfaceCard>
                            ))
                        ) : (
                            <Text color="#90a0b7">No tasks yet.</Text>
                        )}
                    </Stack>
                </Grid>
            </SurfaceCard>
        </Stack>
    );
}
