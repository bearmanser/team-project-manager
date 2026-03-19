import { Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import type { ProjectDetail } from "../types";
import { formatDateTime } from "../utils";

type ProjectSprintHistoryPageProps = {
    project: ProjectDetail;
};

export function ProjectSprintHistoryPage({ project }: ProjectSprintHistoryPageProps) {
    return (
        <Stack gap="6">
            <Stack gap="1">
                <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                    Sprint history
                </Text>
                <Heading size="2xl" color="var(--color-text-primary)">
                    {project.name}
                </Heading>
            </Stack>

            {project.sprintHistory.length ? (
                <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
                    {project.sprintHistory.map((sprint) => (
                        <SurfaceCard key={sprint.id} p="5" bg="var(--color-bg-muted)">
                            <Stack gap="4">
                                <Stack gap="1">
                                    <Heading size="md" color="var(--color-text-primary)">
                                        {sprint.name}
                                    </Heading>
                                    <Text color="var(--color-text-muted)" fontSize="sm">
                                        {formatDateTime(sprint.startedAt)} to {formatDateTime(sprint.endedAt)}
                                    </Text>
                                </Stack>
                                <Text color="var(--color-text-secondary)">
                                    {sprint.reviewText || "No sprint review note was captured for this sprint."}
                                </Text>
                                <Stack direction={{ base: "column", md: "row" }} gap="3">
                                    <SurfaceCard p="3" bg="var(--color-bg-card)">
                                        <Text color="var(--color-text-muted)" fontSize="xs" textTransform="uppercase" letterSpacing="0.14em">
                                            Completed
                                        </Text>
                                        <Heading size="md" color="var(--color-text-primary)">
                                            {sprint.summary.completedCount ?? 0}
                                        </Heading>
                                    </SurfaceCard>
                                    <SurfaceCard p="3" bg="var(--color-bg-card)">
                                        <Text color="var(--color-text-muted)" fontSize="xs" textTransform="uppercase" letterSpacing="0.14em">
                                            Carryover
                                        </Text>
                                        <Heading size="md" color="var(--color-text-primary)">
                                            {sprint.summary.carryoverCount ?? 0}
                                        </Heading>
                                    </SurfaceCard>
                                    {(sprint.summary.returnedToProductCount ?? 0) > 0 ? (
                                        <SurfaceCard p="3" bg="var(--color-bg-card)">
                                            <Text color="var(--color-text-muted)" fontSize="xs" textTransform="uppercase" letterSpacing="0.14em">
                                                Back to product
                                            </Text>
                                            <Heading size="md" color="var(--color-text-primary)">
                                                {sprint.summary.returnedToProductCount ?? 0}
                                            </Heading>
                                        </SurfaceCard>
                                    ) : null}
                                </Stack>
                                <Stack gap="2">
                                    <Text color="var(--color-text-primary)" fontWeight="600">
                                        Completed tasks
                                    </Text>
                                    {(sprint.summary.completedTasks ?? []).length ? (
                                        (sprint.summary.completedTasks ?? []).map((task) => (
                                            <Text key={`completed-${sprint.id}-${task.id}`} color="var(--color-text-secondary)">
                                                {task.title}
                                            </Text>
                                        ))
                                    ) : (
                                        <Text color="var(--color-text-muted)">No tasks were completed in this sprint.</Text>
                                    )}
                                </Stack>
                                <Stack gap="2">
                                    <Text color="var(--color-text-primary)" fontWeight="600">
                                        Carryover tasks
                                    </Text>
                                    {(sprint.summary.carryoverTasks ?? []).length ? (
                                        (sprint.summary.carryoverTasks ?? []).map((task) => (
                                            <Text key={`carryover-${sprint.id}-${task.id}`} color="var(--color-text-secondary)">
                                                {task.title}
                                            </Text>
                                        ))
                                    ) : (
                                        <Text color="var(--color-text-muted)">Everything finished before the sprint closed.</Text>
                                    )}
                                </Stack>
                                {(sprint.summary.returnedToProductTasks ?? []).length ? (
                                    <Stack gap="2">
                                        <Text color="var(--color-text-primary)" fontWeight="600">
                                            Returned to product backlog
                                        </Text>
                                        {(sprint.summary.returnedToProductTasks ?? []).map((task) => (
                                            <Text key={`product-${sprint.id}-${task.id}`} color="var(--color-text-secondary)">
                                                {task.title}
                                            </Text>
                                        ))}
                                    </Stack>
                                ) : null}
                            </Stack>
                        </SurfaceCard>
                    ))}
                </SimpleGrid>
            ) : (
                <SurfaceCard p="5" bg="var(--color-bg-muted)">
                    <Text color="var(--color-text-muted)">
                        End your first sprint to start building history here.
                    </Text>
                </SurfaceCard>
            )}
        </Stack>
    );
}

