import { useState } from "react";

import { Flex, Grid, Heading, Stack, Text } from "@chakra-ui/react";

import { StatusPill } from "../components/StatusPill";
import { SurfaceCard } from "../components/SurfaceCard";
import type { ProjectDetail, TaskStatus } from "../types";

type ProjectBoardPageProps = {
  project: ProjectDetail;
  onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
};

export function ProjectBoardPage({
  project,
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

      <Grid
        templateColumns={{
          base: "1fr",
          xl: `repeat(${Math.max(
            project.boardColumns.length,
            1
          )}, minmax(0, 1fr))`,
        }}
        gap="4"
        flex="1"
        minH="0"
        alignItems="stretch"
      >
        {project.boardColumns.map((column) => {
          const tasks = project.tasks.filter(
            (task) => task.status === column.id
          );
          const isHovered = hoveredColumn === column.id;

          return (
            <SurfaceCard
              key={column.id}
              p="3"
              bg={isHovered ? "#111e34" : "#0f141b"}
              h="full"
              minH="0"
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
                const taskId = Number(
                  event.dataTransfer.getData("text/task-id") || draggedTaskId
                );
                if (Number.isFinite(taskId)) {
                  moveTask(taskId, column.id);
                }
                setDraggedTaskId(null);
                setHoveredColumn(null);
              }}
            >
              <Stack gap="3" h="full" minH="0">
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
                        event.dataTransfer.setData(
                          "text/task-id",
                          String(task.id)
                        );
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggedTaskId(null);
                        setHoveredColumn(null);
                      }}
                    >
                      <Stack gap="2">
                        <Heading size="sm" color="#f5f7fb" fontSize="md">
                          {task.title}
                        </Heading>
                        <Text color="#90a0b7" fontSize="sm" lineClamp="2">
                          {task.description || "No description yet."}
                        </Text>
                        <Stack direction="row" wrap="wrap">
                          {task.isResolutionTask ? (
                            <StatusPill label="Resolution" />
                          ) : null}
                          {task.bugReportTitle ? (
                            <StatusPill label={task.bugReportTitle} />
                          ) : null}
                        </Stack>
                        <Text color="#d8e1ee" fontSize="sm">
                          {task.assignees.length
                            ? `Assigned to ${task.assignees
                                .map((assignee) => assignee.username)
                                .join(", ")}`
                            : "Unassigned"}
                        </Text>
                      </Stack>
                    </SurfaceCard>
                  ))}
                </Stack>
              </Stack>
            </SurfaceCard>
          );
        })}
      </Grid>
    </Flex>
  );
}
