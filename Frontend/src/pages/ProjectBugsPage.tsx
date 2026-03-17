import { Button, Grid, Heading, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import { SurfaceCard } from "../components/SurfaceCard";
import { StatusPill } from "../components/StatusPill";
import type { BugStatus, ProjectDetail } from "../types";
import { formatShortDate, nativeSelectStyle } from "../utils";

type ProjectBugsPageProps = {
    createBugForm: {
        title: string;
        description: string;
        status: BugStatus;
    };
    project: ProjectDetail;
    onCreateBug: () => void;
    onCreateBugFormChange: (field: "title" | "description" | "status", value: string) => void;
    onUpdateBugStatus: (bugId: number, status: BugStatus) => void;
};

export function ProjectBugsPage({
    createBugForm,
    project,
    onCreateBug,
    onCreateBugFormChange,
    onUpdateBugStatus,
}: ProjectBugsPageProps) {
    return (
        <Stack gap="6">
            <SurfaceCard p={{ base: "6", lg: "8" }}>
                <Grid templateColumns={{ base: "1fr", xl: "0.8fr 1.2fr" }} gap="8">
                    <Stack
                        as="form"
                        gap="4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            onCreateBug();
                        }}
                    >
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                            Report bug
                        </Text>
                        <Input
                            value={createBugForm.title}
                            onChange={(event) => onCreateBugFormChange("title", event.target.value)}
                            placeholder="Board is not syncing live updates"
                            bg="#0f141b"
                            borderColor="#2b3544"
                            borderRadius="0"
                            color="#f5f7fb"
                        />
                        <Textarea
                            value={createBugForm.description}
                            onChange={(event) => onCreateBugFormChange("description", event.target.value)}
                            placeholder="Describe the issue, impact, and current behavior."
                            bg="#0f141b"
                            borderColor="#2b3544"
                            borderRadius="0"
                            color="#f5f7fb"
                            minH="140px"
                        />
                        <select
                            value={createBugForm.status}
                            style={nativeSelectStyle}
                            onChange={(event) => onCreateBugFormChange("status", event.target.value)}
                        >
                            {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <Button type="submit" borderRadius="0" bg="#2d6cdf" color="#f8fbff">
                            Create bug report
                        </Button>
                    </Stack>

                    <Stack gap="4">
                        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="#90a0b7">
                            Active bug reports
                        </Text>
                        {project.bugReports.length ? (
                            project.bugReports.map((bug) => (
                                <SurfaceCard key={bug.id} p="4" bg="#0f141b">
                                    <Stack gap="3">
                                        <Heading size="sm" color="#f5f7fb">
                                            {bug.title}
                                        </Heading>
                                        <Text color="#90a0b7">{bug.description || "No description yet."}</Text>
                                        <Stack direction="row" wrap="wrap">
                                            <StatusPill label={project.bugStatusLabels[bug.status]} />
                                            {bug.resolutionTaskTitle ? (
                                                <StatusPill label={bug.resolutionTaskTitle} />
                                            ) : null}
                                        </Stack>
                                        <Text color="#d8e1ee" fontSize="sm">
                                            Reporter: {bug.reporter.username} · Updated {formatShortDate(bug.updatedAt)}
                                        </Text>
                                        <select
                                            value={bug.status}
                                            style={nativeSelectStyle}
                                            onChange={(event) =>
                                                onUpdateBugStatus(bug.id, event.target.value as BugStatus)
                                            }
                                        >
                                            {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </Stack>
                                </SurfaceCard>
                            ))
                        ) : (
                            <Text color="#90a0b7">No bug reports yet.</Text>
                        )}
                    </Stack>
                </Grid>
            </SurfaceCard>
        </Stack>
    );
}
