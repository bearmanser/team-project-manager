import { Box, Button, Flex, Heading, Input, Link, Stack, Text, Textarea } from "@chakra-ui/react";

import { ModalFrame } from "../components/ModalFrame";
import { SurfaceCard } from "../components/SurfaceCard";
import type { BugStatus, GitHubIssueCandidate, PriorityLevel, ProjectDetail } from "../types";
import {
    formatShortDate,
    getBugStatusOptionStyle,
    getBugStatusSelectStyle,
    getPriorityLabel,
    getPriorityOptionStyle,
    getPrioritySelectStyle,
    nativeSelectStyle,
    PRIORITY_OPTIONS,
    sortBugsByPriority,
} from "../utils";

type ProjectBugsPageProps = {
    createBugForm: {
        title: string;
        description: string;
        status: BugStatus;
        priority: PriorityLevel;
    };
    githubIssues: GitHubIssueCandidate[];
    isCreateOpen: boolean;
    isImportOpen: boolean;
    isImportLoading: boolean;
    project: ProjectDetail;
    onCloseImport: () => void;
    onCreateBug: () => void;
    onCreateBugFormChange: (field: "title" | "description" | "status" | "priority", value: string) => void;
    onCreateTaskFromBug: (bugId: number) => void;
    onImportIssue: (issue: GitHubIssueCandidate) => void;
    onOpenBug: (bugId: number) => void;
    onOpenImport: () => void;
    onToggleCreateForm: () => void;
    onUpdateBugPriority: (bugId: number, priority: PriorityLevel) => void;
    onUpdateBugStatus: (bugId: number, status: BugStatus) => void;
};

export function ProjectBugsPage({
    createBugForm,
    githubIssues,
    isCreateOpen,
    isImportOpen,
    isImportLoading,
    project,
    onCloseImport,
    onCreateBug,
    onCreateBugFormChange,
    onCreateTaskFromBug,
    onImportIssue,
    onOpenBug,
    onOpenImport,
    onToggleCreateForm,
    onUpdateBugPriority,
    onUpdateBugStatus,
}: ProjectBugsPageProps) {
    const bugReports = sortBugsByPriority(project.bugReports);

    return (
        <Stack gap="6">
            <Flex justify="space-between" align={{ base: "stretch", md: "center" }} gap="4" wrap="wrap">
                <Stack gap="1">
                    <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" color="var(--color-text-muted)">
                        Bugs
                    </Text>
                    <Heading size="2xl" color="var(--color-text-primary)">
                        {project.name}
                    </Heading>
                </Stack>
                <Flex gap="3" wrap="wrap">
                    <Button
                        borderRadius="lg"
                        variant="outline"
                        borderColor="var(--color-border-strong)"
                        color="var(--color-text-primary)"
                        disabled={!project.permissions.canCreateBugReports || !project.repositories.length}
                        _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                        onClick={onOpenImport}
                    >
                        Import issues
                    </Button>
                    <Button
                        borderRadius="lg"
                        variant="outline"
                        borderColor="var(--color-border-strong)"
                        color="var(--color-text-primary)"
                        _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                        onClick={onToggleCreateForm}
                    >
                        Add bug report
                    </Button>
                </Flex>
            </Flex>

            <SurfaceCard p="0" overflow="hidden">
                {bugReports.length ? (
                    bugReports.map((bug) => {
                        const linkedIssue = bug.linkedGitHubIssues[0] ?? null;
                        const metaParts = [
                            bug.description || "No description",
                            `Reporter ${bug.reporter.username}`,
                            `Updated ${formatShortDate(bug.updatedAt)}`,
                        ];
                        if (linkedIssue) {
                            metaParts.push(`GitHub ${linkedIssue.repositoryFullName}#${linkedIssue.issueNumber}`);
                        }
                        const meta = metaParts.join(" - ");

                        return (
                            <Flex
                                key={bug.id}
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
                                <Stack
                                    gap="1.5"
                                    flex="1"
                                    minW="260px"
                                    cursor="pointer"
                                    onClick={() => onOpenBug(bug.id)}
                                >
                                    <Text color="var(--color-text-primary)" fontWeight="700" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {bug.title}
                                    </Text>
                                    <Text color="var(--color-text-muted)" fontSize="sm" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                        {meta}
                                    </Text>
                                </Stack>
                                {project.permissions.canCreateTasks ? (
                                    <Flex gap="2" wrap="wrap" align="center">
                                        <Button
                                            size="sm"
                                            borderRadius="lg"
                                            variant="outline"
                                            borderColor="var(--color-border-strong)"
                                            color="var(--color-text-primary)"
                                            _hover={{ bg: "var(--color-bg-hover)", borderColor: "var(--color-accent-border)" }}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onCreateTaskFromBug(bug.id);
                                            }}
                                        >
                                            Create task
                                        </Button>
                                    </Flex>
                                ) : null}
                                <Flex gap="2" wrap="wrap" align="center">
                                    <Box as="span">
                                        <select
                                            value={bug.priority}
                                            style={{ ...getPrioritySelectStyle(bug.priority), minWidth: 150 }}
                                            onChange={(event) => onUpdateBugPriority(bug.id, event.target.value as PriorityLevel)}
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
                                            value={bug.status}
                                            style={{ ...getBugStatusSelectStyle(bug.status), minWidth: 170 }}
                                            onChange={(event) => onUpdateBugStatus(bug.id, event.target.value as BugStatus)}
                                        >
                                            {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                                                <option key={value} value={value} style={getBugStatusOptionStyle(value as BugStatus)}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </Box>
                                </Flex>
                            </Flex>
                        );
                    })
                ) : (
                    <Stack p="6" gap="2">
                        <Text color="var(--color-text-primary)" fontWeight="600">
                            No bug reports yet.
                        </Text>
                        <Text color="var(--color-text-muted)">Use the create button to add the first bug report.</Text>
                    </Stack>
                )}
            </SurfaceCard>

            <ModalFrame
                title="Import GitHub issues"
                description="Pull issues from connected repositories into the project as bug reports."
                isOpen={isImportOpen}
                onClose={onCloseImport}
            >
                {!project.repositories.length ? (
                    <Text color="var(--color-text-muted)">
                        Connect a repository to this project first, then you can import issues as bugs.
                    </Text>
                ) : isImportLoading ? (
                    <Text color="var(--color-text-muted)">Loading GitHub issues...</Text>
                ) : githubIssues.length ? (
                    <Stack gap="3" maxH="420px" overflowY="auto" pr="1">
                        {githubIssues.map((issue) => (
                            <SurfaceCard key={`${issue.repositoryFullName}-${issue.issueNumber}`} p="4" bg="var(--color-bg-muted)">
                                <Stack gap="2">
                                    <Flex justify="space-between" gap="3" wrap="wrap">
                                        <Stack gap="1" minW="0" flex="1">
                                            <Text color="var(--color-text-primary)" fontWeight="700">
                                                {issue.title}
                                            </Text>
                                            <Text color="var(--color-text-muted)" fontSize="sm">
                                                {issue.repositoryFullName}#{issue.issueNumber} - opened by {issue.authorLogin || "unknown"} - updated {formatShortDate(issue.updatedAt)}
                                            </Text>
                                        </Stack>
                                        <Button
                                            borderRadius="lg"
                                            bg="var(--color-accent)"
                                            color="var(--color-text-inverse)"
                                            alignSelf="flex-start"
                                            _hover={{ bg: "var(--color-accent-hover)" }}
                                            onClick={() => onImportIssue(issue)}
                                        >
                                            Import bug
                                        </Button>
                                    </Flex>
                                    {issue.labels.length ? (
                                        <Text color="var(--color-text-subtle)" fontSize="sm">
                                            Labels: {issue.labels.join(", ")}
                                        </Text>
                                    ) : null}
                                    {issue.bodyPreview ? (
                                        <Text color="var(--color-text-muted)" fontSize="sm">
                                            {issue.bodyPreview}
                                        </Text>
                                    ) : null}
                                    <Link href={issue.htmlUrl} color="var(--color-link)" target="_blank" rel="noreferrer">
                                        Open issue on GitHub
                                    </Link>
                                </Stack>
                            </SurfaceCard>
                        ))}
                    </Stack>
                ) : (
                    <Text color="var(--color-text-muted)">
                        No open GitHub issues are ready to import from the connected repositories.
                    </Text>
                )}
            </ModalFrame>

            <ModalFrame
                title="Add bug report"
                description="Capture the issue, set its urgency, then keep triage moving from the list itself."
                isOpen={isCreateOpen}
                onClose={onToggleCreateForm}
            >
                <Stack
                    as="form"
                    gap="4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        onCreateBug();
                    }}
                >
                    <Input
                        value={createBugForm.title}
                        onChange={(event) => onCreateBugFormChange("title", event.target.value)}
                        placeholder="Board is not syncing live updates"
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                    />
                    <Textarea
                        value={createBugForm.description}
                        onChange={(event) => onCreateBugFormChange("description", event.target.value)}
                        placeholder="Describe the issue, impact, and current behavior."
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                        minH="140px"
                    />
                    <select
                        value={createBugForm.status}
                        style={nativeSelectStyle}
                        onChange={(event) => onCreateBugFormChange("status", event.target.value)}
                    >
                        {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                            <option key={value} value={value} style={getBugStatusOptionStyle(value as BugStatus)}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={createBugForm.priority}
                        style={nativeSelectStyle}
                        onChange={(event) => onCreateBugFormChange("priority", event.target.value)}
                    >
                        {PRIORITY_OPTIONS.map((priority) => (
                            <option key={priority} value={priority} style={getPriorityOptionStyle(priority)}>
                                {getPriorityLabel(priority)} priority
                            </option>
                        ))}
                    </select>
                    <Button
                        type="submit"
                        borderRadius="lg"
                        bg="var(--color-accent)"
                        color="var(--color-text-inverse)"
                        alignSelf="flex-start"
                        _hover={{ bg: "var(--color-accent-hover)" }}
                    >
                        Add bug report
                    </Button>
                </Stack>
            </ModalFrame>
        </Stack>
    );
}
