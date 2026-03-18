import { useEffect, useMemo, useState } from "react";

import { Box, Button, Flex, Grid, Heading, Stack, Text } from "@chakra-ui/react";

import type { BugReport, PriorityLevel, ProjectDetail, Task, TaskStatus, BugStatus } from "../types";
import {
    formatDateTime,
    getBugStatusOptionStyle,
    getBugStatusSelectStyle,
    getPriorityLabel,
    getPriorityOptionStyle,
    getPrioritySelectStyle,
    getTaskStatusOptionStyle,
    getTaskStatusSelectStyle,
    PRIORITY_OPTIONS,
} from "../utils";
import { MentionTextarea } from "./MentionTextarea";
import { ModalFrame } from "./ModalFrame";
import { PriorityPill } from "./PriorityPill";
import { StatusPill } from "./StatusPill";

type WorkItemDetailModalProps = {
    isOpen: boolean;
    project: ProjectDetail;
    task?: Task | null;
    bug?: BugReport | null;
    onClose: () => void;
    onSaveTask: (taskId: number, payload: Partial<{ title: string; description: string; status: string; priority: string }>) => void;
    onSaveBug: (bugId: number, payload: Partial<{ title: string; description: string; status: string; priority: string }>) => void;
    onAddTaskComment: (taskId: number, payload: { body: string; anchorType?: string; anchorId?: string; anchorLabel?: string }) => void;
    onAddBugComment: (bugId: number, payload: { body: string; anchorType?: string; anchorId?: string; anchorLabel?: string }) => void;
};

export function WorkItemDetailModal({
    isOpen,
    project,
    task,
    bug,
    onClose,
    onSaveTask,
    onSaveBug,
    onAddTaskComment,
    onAddBugComment,
}: WorkItemDetailModalProps) {
    const item = task ?? bug ?? null;
    const kind = task ? "task" : bug ? "bug" : null;
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState<string>("");
    const [priority, setPriority] = useState<PriorityLevel>("medium");
    const [generalComment, setGeneralComment] = useState("");
    const [inlineDrafts, setInlineDrafts] = useState<Record<string, string>>({});
    const [openInlineAnchor, setOpenInlineAnchor] = useState<string | null>(null);

    useEffect(() => {
        if (!item) {
            return;
        }

        setTitle(item.title);
        setDescription(item.description);
        setStatus(item.status);
        setPriority(item.priority);
        setGeneralComment("");
        setInlineDrafts({});
        setOpenInlineAnchor(null);
    }, [item]);

    const paragraphs = useMemo(() => {
        const blocks = description.split(/\n+/).map((part) => part.trim()).filter(Boolean);
        return blocks.length ? blocks : ["No description yet."];
    }, [description]);

    if (!item || !kind) {
        return null;
    }

    const currentItem = item;
    const comments = currentItem.comments;
    const generalComments = comments.filter((comment) => !comment.anchorType);
    const activity = currentItem.activity;
    const canSave = title.trim().length > 0;

    function handleSave(): void {
        if (!canSave) {
            return;
        }

        if (kind === "task") {
            onSaveTask(currentItem.id, {
                title: title.trim(),
                description: description.trim(),
                status,
                priority,
            });
            return;
        }

        onSaveBug(currentItem.id, {
            title: title.trim(),
            description: description.trim(),
            status,
            priority,
        });
    }

    function handleAddGeneralComment(): void {
        const body = generalComment.trim();
        if (!body) {
            return;
        }

        if (kind === "task") {
            onAddTaskComment(currentItem.id, { body });
        } else {
            onAddBugComment(currentItem.id, { body });
        }
        setGeneralComment("");
    }

    function handleAddInlineComment(anchorId: string, anchorLabel: string): void {
        const body = (inlineDrafts[anchorId] ?? "").trim();
        if (!body) {
            return;
        }

        const payload = {
            body,
            anchorType: "description",
            anchorId,
            anchorLabel,
        };
        if (kind === "task") {
            onAddTaskComment(currentItem.id, payload);
        } else {
            onAddBugComment(currentItem.id, payload);
        }

        setInlineDrafts((current) => ({ ...current, [anchorId]: "" }));
        setOpenInlineAnchor(null);
    }

    return (
        <ModalFrame
            title={kind === "task" ? "Task details" : "Bug details"}
            description={kind === "task" ? "Inspect the work, keep the workflow moving, and discuss directly in context." : "Inspect the issue, update triage, and collaborate directly inside the record."}
            isOpen={isOpen}
            onClose={onClose}
            maxW="1100px"
        >
            <Stack gap="6">
                <Grid templateColumns={{ base: "1fr", xl: "minmax(0, 1.45fr) minmax(320px, 0.85fr)" }} gap="6">
                    <Stack gap="5">
                        <Stack gap="3">
                            <input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                style={{
                                    width: "100%",
                                    background: "var(--color-bg-muted)",
                                    border: "1px solid var(--color-border-strong)",
                                    color: "var(--color-text-primary)",
                                    borderRadius: 14,
                                    padding: "14px 16px",
                                    fontSize: 18,
                                    fontWeight: 700,
                                }}
                            />
                            <Flex gap="2" wrap="wrap" align="center">
                                <PriorityPill priority={priority} />
                                {kind === "task" && task?.bugReportTitle ? <StatusPill label={task.bugReportTitle} /> : null}
                                {kind === "bug" && bug?.resolutionTaskTitle ? <StatusPill label={bug.resolutionTaskTitle} /> : null}
                            </Flex>
                        </Stack>

                        <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap="3">
                            <select
                                value={priority}
                                style={getPrioritySelectStyle(priority)}
                                onChange={(event) => setPriority(event.target.value as PriorityLevel)}
                            >
                                {PRIORITY_OPTIONS.map((value) => (
                                    <option key={value} value={value} style={getPriorityOptionStyle(value)}>
                                        {getPriorityLabel(value)}
                                    </option>
                                ))}
                            </select>
                            {kind === "task" ? (
                                <select
                                    value={status}
                                    style={getTaskStatusSelectStyle(status as TaskStatus)}
                                    onChange={(event) => setStatus(event.target.value)}
                                >
                                    {project.boardColumns.map((column) => (
                                        <option key={column.id} value={column.id} style={getTaskStatusOptionStyle(column.id)}>
                                            {column.label}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <select
                                    value={status}
                                    style={getBugStatusSelectStyle(status as BugStatus)}
                                    onChange={(event) => setStatus(event.target.value)}
                                >
                                    {Object.entries(project.bugStatusLabels).map(([value, label]) => (
                                        <option key={value} value={value} style={getBugStatusOptionStyle(value as BugStatus)}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </Grid>

                        <Stack gap="3">
                            <Flex justify="space-between" align="center">
                                <Heading size="sm" color="var(--color-text-primary)">
                                    Description
                                </Heading>
                                <Button
                                    size="sm"
                                    borderRadius="full"
                                    variant="outline"
                                    borderColor="var(--color-border-strong)"
                                    color="var(--color-text-primary)"
                                    _hover={{ bg: "var(--color-bg-hover)" }}
                                    onClick={handleSave}
                                    disabled={!canSave}
                                >
                                    Save changes
                                </Button>
                            </Flex>
                            <MentionTextarea
                                value={description}
                                onChange={setDescription}
                                members={project.members}
                                placeholder={kind === "task" ? "Describe the work, context, and expected outcome." : "Describe the issue, impact, and current behavior."}
                                minH="180px"
                            />
                        </Stack>

                        <Stack gap="4">
                            <Heading size="sm" color="var(--color-text-primary)">
                                Inline discussion
                            </Heading>
                            {paragraphs.map((paragraph, index) => {
                                const anchorId = String(index);
                                const inlineComments = comments.filter(
                                    (comment) => comment.anchorType === "description" && comment.anchorId === anchorId,
                                );

                                return (
                                    <Box
                                        key={anchorId}
                                        borderWidth="1px"
                                        borderColor="var(--color-border-default)"
                                        borderRadius="16px"
                                        bg="var(--color-bg-muted)"
                                        p="4"
                                    >
                                        <Stack gap="3">
                                            <Flex justify="space-between" align="flex-start" gap="4">
                                                <Text color="var(--color-text-primary)">{paragraph}</Text>
                                                <Button
                                                    size="sm"
                                                    borderRadius="full"
                                                    variant="ghost"
                                                    color="var(--color-text-muted)"
                                                    _hover={{ bg: "var(--color-bg-hover)", color: "var(--color-text-primary)" }}
                                                    onClick={() =>
                                                        setOpenInlineAnchor((current) => (current === anchorId ? null : anchorId))
                                                    }
                                                >
                                                    Inline comment
                                                </Button>
                                            </Flex>
                                            {inlineComments.length ? (
                                                <Stack gap="3">
                                                    {inlineComments.map((comment) => (
                                                        <Box
                                                            key={comment.id}
                                                            borderLeftWidth="3px"
                                                            borderColor="var(--color-accent-border)"
                                                            pl="3"
                                                        >
                                                            <Text color="var(--color-text-primary)" fontWeight="600">
                                                                {comment.author.username}
                                                            </Text>
                                                            <Text color="var(--color-text-secondary)">{comment.body}</Text>
                                                            <Text color="var(--color-text-muted)" fontSize="xs">
                                                                {formatDateTime(comment.createdAt)}
                                                            </Text>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            ) : null}
                                            {openInlineAnchor === anchorId ? (
                                                <Stack gap="3">
                                                    <MentionTextarea
                                                        value={inlineDrafts[anchorId] ?? ""}
                                                        onChange={(value) =>
                                                            setInlineDrafts((current) => ({ ...current, [anchorId]: value }))
                                                        }
                                                        members={project.members}
                                                        placeholder="Discuss this specific line of work. Use @username to mention a teammate."
                                                        minH="110px"
                                                    />
                                                    <Button
                                                        alignSelf="flex-start"
                                                        borderRadius="lg"
                                                        bg="var(--color-accent)"
                                                        color="var(--color-text-inverse)"
                                                        _hover={{ bg: "var(--color-accent-hover)" }}
                                                        onClick={() => handleAddInlineComment(anchorId, paragraph.slice(0, 120))}
                                                    >
                                                        Add inline comment
                                                    </Button>
                                                </Stack>
                                            ) : null}
                                        </Stack>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Stack>

                    <Stack gap="5">
                        <Box borderWidth="1px" borderColor="var(--color-border-default)" borderRadius="18px" p="4" bg="var(--color-bg-muted)">
                            <Stack gap="3">
                                <Heading size="sm" color="var(--color-text-primary)">
                                    Snapshot
                                </Heading>
                                <Text color="var(--color-text-secondary)">
                                    {kind === "task"
                                        ? `Created by ${task?.creator.username ?? "unknown"} on ${formatDateTime(task?.createdAt)}`
                                        : `Reported by ${bug?.reporter.username ?? "unknown"} on ${formatDateTime(bug?.createdAt)}`}
                                </Text>
                                {kind === "task" ? (
                                    <>
                                        <Text color="var(--color-text-secondary)">
                                            {task?.assignees.length
                                                ? `Assigned to ${task.assignees.map((assignee) => assignee.username).join(", ")}`
                                                : "No assignees yet."}
                                        </Text>
                                        {task?.branchName ? (
                                            <StatusPill label={task.branchName} alignSelf="flex-start" />
                                        ) : null}
                                    </>
                                ) : (
                                    <Text color="var(--color-text-secondary)">
                                        {bug?.tasks.length ? `${bug.tasks.length} linked tasks are tracking this bug.` : "No linked tasks yet."}
                                    </Text>
                                )}
                            </Stack>
                        </Box>

                        <Stack gap="3">
                            <Heading size="sm" color="var(--color-text-primary)">
                                Comments
                            </Heading>
                            <MentionTextarea
                                value={generalComment}
                                onChange={setGeneralComment}
                                members={project.members}
                                placeholder="Add a comment. Use @username to mention someone."
                            />
                            <Button
                                alignSelf="flex-start"
                                borderRadius="lg"
                                bg="var(--color-accent)"
                                color="var(--color-text-inverse)"
                                _hover={{ bg: "var(--color-accent-hover)" }}
                                onClick={handleAddGeneralComment}
                            >
                                Add comment
                            </Button>
                            <Stack gap="3">
                                {generalComments.length ? (
                                    generalComments.map((comment) => (
                                        <Box
                                            key={comment.id}
                                            borderWidth="1px"
                                            borderColor="var(--color-border-default)"
                                            borderRadius="16px"
                                            bg="var(--color-bg-muted)"
                                            p="4"
                                        >
                                            <Stack gap="1.5">
                                                <Text color="var(--color-text-primary)" fontWeight="600">
                                                    {comment.author.username}
                                                </Text>
                                                <Text color="var(--color-text-secondary)">{comment.body}</Text>
                                                <Text color="var(--color-text-muted)" fontSize="xs">
                                                    {formatDateTime(comment.createdAt)}
                                                </Text>
                                            </Stack>
                                        </Box>
                                    ))
                                ) : (
                                    <Text color="var(--color-text-muted)">No comments yet.</Text>
                                )}
                            </Stack>
                        </Stack>

                        <Stack gap="3">
                            <Heading size="sm" color="var(--color-text-primary)">
                                Activity
                            </Heading>
                            <Stack gap="3" maxH="280px" overflowY="auto">
                                {activity.length ? (
                                    activity.map((entry) => (
                                        <Box
                                            key={entry.id}
                                            borderWidth="1px"
                                            borderColor="var(--color-border-default)"
                                            borderRadius="16px"
                                            bg="var(--color-bg-muted)"
                                            p="4"
                                        >
                                            <Text color="var(--color-text-primary)">{entry.description}</Text>
                                            <Text color="var(--color-text-muted)" fontSize="xs" mt="1.5">
                                                {formatDateTime(entry.createdAt)}
                                            </Text>
                                        </Box>
                                    ))
                                ) : (
                                    <Text color="var(--color-text-muted)">No recent activity yet.</Text>
                                )}
                            </Stack>
                        </Stack>
                    </Stack>
                </Grid>
            </Stack>
        </ModalFrame>
    );
}
