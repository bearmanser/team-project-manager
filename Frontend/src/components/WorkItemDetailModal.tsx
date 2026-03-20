import { useEffect, useMemo, useState } from "react";

import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Stack,
  Text,
} from "@chakra-ui/react";

import type {
  BugReport,
  BugStatus,
  CommentEntry,
  CommentReactionSummary,
  PriorityLevel,
  ProjectDetail,
  Task,
  TaskStatus,
} from "../types";
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
  sortBugsByPriority,
} from "../utils";
import { ActionIcon } from "./ActionIcon";
import { DropdownMenu } from "./DropdownMenu";
import { EditTextIcon } from "./icons";
import { MentionTextarea } from "./MentionTextarea";
import { ModalFrame } from "./ModalFrame";

type WorkItemDetailModalProps = {
  isOpen: boolean;
  project: ProjectDetail;
  task?: Task | null;
  bug?: BugReport | null;
  onClose: () => void;
  onSaveTask: (
    taskId: number,
    payload: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      resolvedBugIds: number[];
    }>
  ) => void;
  onCreateTaskBranch: (task: Task) => void;
  onSaveBug: (
    bugId: number,
    payload: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
    }>
  ) => void;
  onAddTaskComment: (
    taskId: number,
    payload: {
      body: string;
      anchorType?: string;
      anchorId?: string;
      anchorLabel?: string;
    }
  ) => void;
  onAddBugComment: (
    bugId: number,
    payload: {
      body: string;
      anchorType?: string;
      anchorId?: string;
      anchorLabel?: string;
    }
  ) => void;
  onToggleTaskCommentReaction: (commentId: number, emoji: string) => void;
  onToggleBugCommentReaction: (commentId: number, emoji: string) => void;
};

const commentHint = "Press Enter to send. Shift+Enter adds a new line.";
const REACTION_EMOJIS = [
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F389}",
  "\u{1F440}",
  "\u{1F525}",
];

function buildCommentAnchorLabel(comment: CommentEntry): string {
  return `${comment.author.username}: ${comment.body}`.slice(0, 255);
}

function getCommentContext(comment: CommentEntry): string | null {
  if (comment.anchorType === "description") {
    return comment.anchorLabel
      ? `From description: ${comment.anchorLabel}`
      : "From description";
  }

  return null;
}

function getReactionSummary(
  reactions: CommentReactionSummary[],
  emoji: string
): CommentReactionSummary | null {
  return reactions.find((reaction) => reaction.emoji === emoji) ?? null;
}

export function WorkItemDetailModal({
  isOpen,
  project,
  task,
  bug,
  onClose,
  onSaveTask,
  onCreateTaskBranch,
  onSaveBug,
  onAddTaskComment,
  onAddBugComment,
  onToggleTaskCommentReaction,
  onToggleBugCommentReaction,
}: WorkItemDetailModalProps) {
  const item = task ?? bug ?? null;
  const kind = task ? "task" : bug ? "bug" : null;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("");
  const [priority, setPriority] = useState<PriorityLevel>("medium");
  const [generalComment, setGeneralComment] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [resolvedBugIds, setResolvedBugIds] = useState<number[]>([]);

  useEffect(() => {
    if (!item) {
      return;
    }

    setTitle(item.title);
    setDescription(item.description);
    setStatus(item.status);
    setPriority(item.priority);
    setGeneralComment("");
    setReplyDrafts({});
    setActiveReplyId(null);
    setResolvedBugIds(task?.resolvedBugs.map((resolvedBug) => resolvedBug.id) ?? []);
  }, [item, task]);

  const comments = item?.comments ?? [];
  const canSave = title.trim().length > 0;
  const canCreateTaskBranch =
    kind === "task" &&
    Boolean(task) &&
    project.permissions.canEditTasks &&
    project.repositories.length > 0;
  const titleLabel = kind === "task" ? "Task name" : "Bug title";

  const commentIds = useMemo(
    () => new Set(comments.map((comment) => String(comment.id))),
    [comments]
  );
  const repliesByParentId = useMemo(() => {
    const grouped = new Map<string, CommentEntry[]>();

    comments.forEach((comment) => {
      if (comment.anchorType !== "comment" || !comment.anchorId) {
        return;
      }

      const existing = grouped.get(comment.anchorId) ?? [];
      existing.push(comment);
      grouped.set(comment.anchorId, existing);
    });

    return grouped;
  }, [comments]);
  const visibleComments = useMemo(
    () =>
      comments.filter(
        (comment) =>
          comment.anchorType !== "comment" || !commentIds.has(comment.anchorId)
      ),
    [commentIds, comments]
  );
  const selectedResolvedBugs = useMemo(() => {
    if (kind !== "task") {
      return [] as BugReport[];
    }

    const bugLookup = new Map(
      project.bugReports.map((currentBug) => [currentBug.id, currentBug])
    );

    return resolvedBugIds
      .map((resolvedBugId) => bugLookup.get(resolvedBugId) ?? null)
      .filter((currentBug): currentBug is BugReport => currentBug !== null);
  }, [kind, project.bugReports, resolvedBugIds]);
  const selectedResolvedBugIdSet = useMemo(
    () => new Set(resolvedBugIds),
    [resolvedBugIds]
  );
  const sortedProjectBugs = useMemo(() => {
    if (kind !== "task") {
      return [] as BugReport[];
    }

    return sortBugsByPriority(project.bugReports);
  }, [kind, project.bugReports]);

  if (!item || !kind) {
    return null;
  }

  const currentItem = item;

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
        resolvedBugIds,
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

  function submitComment(
    body: string,
    anchor?: { anchorType: string; anchorId: string; anchorLabel: string }
  ): void {
    const trimmedBody = body.trim();
    if (!trimmedBody) {
      return;
    }

    const payload = anchor
      ? {
          body: trimmedBody,
          anchorType: anchor.anchorType,
          anchorId: anchor.anchorId,
          anchorLabel: anchor.anchorLabel,
        }
      : { body: trimmedBody };

    if (kind === "task") {
      onAddTaskComment(currentItem.id, payload);
    } else {
      onAddBugComment(currentItem.id, payload);
    }
  }

  function handleAddGeneralComment(): void {
    const body = generalComment.trim();
    if (!body) {
      return;
    }

    submitComment(body);
    setGeneralComment("");
  }

  function handleAddReply(comment: CommentEntry): void {
    const replyKey = String(comment.id);
    const body = (replyDrafts[replyKey] ?? "").trim();
    if (!body) {
      return;
    }

    submitComment(body, {
      anchorType: "comment",
      anchorId: replyKey,
      anchorLabel: buildCommentAnchorLabel(comment),
    });
    setReplyDrafts((current) => ({ ...current, [replyKey]: "" }));
    setActiveReplyId(null);
  }

  function handleToggleReaction(commentId: number, emoji: string): void {
    if (kind === "task") {
      onToggleTaskCommentReaction(commentId, emoji);
      return;
    }

    onToggleBugCommentReaction(commentId, emoji);
  }

  function handleToggleResolvedBug(bugId: number): void {
    setResolvedBugIds((current) =>
      current.includes(bugId)
        ? current.filter((currentBugId) => currentBugId !== bugId)
        : [...current, bugId]
    );
  }

  const renderCommentThread = (comment: CommentEntry, depth = 0) => {
    const replyKey = String(comment.id);
    const replies = repliesByParentId.get(replyKey) ?? [];
    const isReplyOpen = activeReplyId === replyKey;
    const contextLabel = getCommentContext(comment);

    return (
      <Stack key={comment.id} gap="2">
        <Box
          borderWidth="1px"
          borderColor={
            isReplyOpen
              ? "var(--color-accent-border)"
              : "var(--color-border-default)"
          }
          borderRadius="12px"
          bg="var(--color-bg-card)"
          overflow="hidden"
          cursor="pointer"
          transition="border-color 0.2s ease"
          _hover={{ borderColor: "var(--color-accent-border)" }}
          onClick={() =>
            setActiveReplyId((current) =>
              current === replyKey ? null : replyKey
            )
          }
        >
          <Flex
            justify="space-between"
            align="center"
            gap="2"
            wrap="wrap"
            bg="var(--color-bg-muted)"
            px="3"
            py="2"
            borderBottomWidth="1px"
            borderColor="var(--color-border-default)"
          >
            <Flex gap="2" align="center" wrap="wrap">
              <Text
                color="var(--color-text-primary)"
                fontWeight="600"
                fontSize="sm"
              >
                {comment.author.username}
              </Text>
              {contextLabel ? (
                <Box
                  borderWidth="1px"
                  borderColor="var(--color-border-default)"
                  borderRadius="full"
                  px="2"
                  py="0.5"
                  color="var(--color-text-muted)"
                  fontSize="xs"
                  bg="var(--color-bg-card)"
                >
                  {contextLabel}
                </Box>
              ) : null}
            </Flex>
            <Text color="var(--color-text-muted)" fontSize="xs">
              {formatDateTime(comment.createdAt)}
            </Text>
          </Flex>

          <Stack gap="2" px="3" py="3">
            <Text
              color="var(--color-text-secondary)"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
              fontSize="sm"
            >
              {comment.body}
            </Text>

            <Flex wrap="wrap" onClick={(event) => event.stopPropagation()}>
              {REACTION_EMOJIS.map((emoji) => {
                const reaction = getReactionSummary(comment.reactions, emoji);
                const count = reaction?.count ?? 0;
                const isActive = reaction?.reactedByUser ?? false;

                return (
                  <Button
                    key={`${comment.id}-${emoji}`}
                    size="xs"
                    variant="outline"
                    border={0}
                    bg={isActive ? "var(--color-bg-soft)" : "var(--color-bg-card)"}
                    color="var(--color-text-primary)"
                    _hover={{ bg: "var(--color-bg-muted)" }}
                    onClick={() => handleToggleReaction(comment.id, emoji)}
                  >
                    {emoji} {count > 0 ? count : ""}
                  </Button>
                );
              })}
            </Flex>
          </Stack>
        </Box>

        {isReplyOpen ? (
          <Box
            onClick={(event) => event.stopPropagation()}
            pl={depth > 0 ? "3" : "0"}
          >
            <Stack gap="1.5">
              <MentionTextarea
                value={replyDrafts[replyKey] ?? ""}
                onChange={(value) =>
                  setReplyDrafts((current) => ({
                    ...current,
                    [replyKey]: value,
                  }))
                }
                onSubmit={() => handleAddReply(comment)}
                submitOnEnter
                members={project.members}
                placeholder="Reply to this comment. Use @username to mention a teammate."
                minH="52px"
              />
              <Text color="var(--color-text-muted)" fontSize="xs">
                {commentHint}
              </Text>
            </Stack>
          </Box>
        ) : null}

        {replies.length ? (
          <Stack
            gap="2"
            pl="3"
            ml={depth === 0 ? "1" : "0"}
            borderLeftWidth="1px"
            borderColor="var(--color-border-default)"
          >
            {replies.map((reply) => renderCommentThread(reply, depth + 1))}
          </Stack>
        ) : null}
      </Stack>
    );
  };

  return (
    <ModalFrame
      title={kind === "task" ? "Task details" : "Bug details"}
      description={
        kind === "task"
          ? "Inspect the work, update the task, and keep the discussion flowing in the comments column."
          : "Inspect the issue, update triage, and keep the discussion flowing in the comments column."
      }
      isOpen={isOpen}
      onClose={onClose}
      maxW="1280px"
    >
      <Flex direction="column" h={{ base: "auto", xl: "calc(100vh - 240px)" }} minH="0">
        <Grid
          templateColumns={{
            base: "1fr",
            xl: "minmax(0, 1.2fr) minmax(360px, 0.8fr)",
          }}
          gap="6"
          flex="1"
          minH="0"
        >
          <Stack gap="3" minH="0" order={{ base: 2, xl: 1 }}>
            <Heading size="sm" color="var(--color-text-primary)">
              Comments
            </Heading>

            <Box
              flex="1"
              minH={{ base: "240px", xl: "0" }}
              overflowY="auto"
              pr={{ xl: "1" }}
            >
              {visibleComments.length ? (
                <Stack gap="2">
                  {visibleComments.map((comment) => renderCommentThread(comment))}
                </Stack>
              ) : (
                <Text color="var(--color-text-muted)">No comments yet.</Text>
              )}
            </Box>

            <Stack gap="1.5">
              <MentionTextarea
                value={generalComment}
                onChange={setGeneralComment}
                onSubmit={handleAddGeneralComment}
                submitOnEnter
                members={project.members}
                placeholder="Add a comment. Use @username to mention someone."
                minH="56px"
              />
              <Text color="var(--color-text-muted)" fontSize="xs">
                {commentHint}
              </Text>
            </Stack>
          </Stack>

          <Flex
            direction="column"
            gap="4"
            minH="0"
            h={{ xl: "full" }}
            order={{ base: 1, xl: 2 }}
          >
            <Stack
              gap="4"
              minH="0"
              flex="1"
              overflowY={{ base: "visible", xl: "auto" }}
              pr={{ xl: "1" }}
            >
            <Stack gap="2">
              <Heading size="sm" color="var(--color-text-primary)">
                {titleLabel}
              </Heading>
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
            </Stack>

            <Grid
              templateColumns={{
                base: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              }}
              gap="3"
            >
              {kind === "task" ? (
                <select
                  value={status}
                  style={getTaskStatusSelectStyle(status as TaskStatus)}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {project.boardColumns.map((column) => (
                    <option
                      key={column.id}
                      value={column.id}
                      style={getTaskStatusOptionStyle(column.id)}
                    >
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
                  {Object.entries(project.bugStatusLabels).map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                        style={getBugStatusOptionStyle(value as BugStatus)}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              )}
              <select
                value={priority}
                style={getPrioritySelectStyle(priority)}
                onChange={(event) =>
                  setPriority(event.target.value as PriorityLevel)
                }
              >
                {PRIORITY_OPTIONS.map((value) => (
                  <option
                    key={value}
                    value={value}
                    style={getPriorityOptionStyle(value)}
                  >
                    {getPriorityLabel(value)}
                  </option>
                ))}
              </select>
            </Grid>

            <Stack gap="2">
              <Heading size="sm" color="var(--color-text-primary)">
                Description
              </Heading>
              <Box minH="200px">
                <MentionTextarea
                  value={description}
                  onChange={setDescription}
                  members={project.members}
                  placeholder={
                    kind === "task"
                      ? "Describe the work, context, and expected outcome."
                      : "Describe the issue, impact, and current behavior."
                  }
                  minH="200px"
                  h="100%"
                />
              </Box>
            </Stack>

            {kind === "task" ? (
              <Stack gap="3">
                <Stack gap="1">
                  <Flex align="center" justify="space-between" gap="3">
                    <Heading size="sm" color="var(--color-text-primary)">
                      Bugs resolved by this task
                    </Heading>
                    <DropdownMenu
                      width="320px"
                      items={
                        sortedProjectBugs.length
                          ? sortedProjectBugs.map((projectBug) => {
                              const isSelected = selectedResolvedBugIdSet.has(projectBug.id);

                              return {
                                key: String(projectBug.id),
                                label: projectBug.title,
                                onClick: () => handleToggleResolvedBug(projectBug.id),
                                closeOnClick: false,
                                trailingContent: isSelected ? (
                                  <Box
                                    as="span"
                                    color="var(--color-accent)"
                                    fontWeight="700"
                                    fontSize="sm"
                                  >
                                    {"\u2713"}
                                  </Box>
                                ) : (
                                  <Box as="span" w="3.5" />
                                ),
                              };
                            })
                          : [
                              {
                                key: "no-bugs",
                                label: "No bugs available",
                                onClick: () => undefined,
                                disabled: true,
                              },
                            ]
                      }
                      renderTrigger={({ toggle }) => (
                        <Button
                          minW="8"
                          h="8"
                          px="0"
                          variant="ghost"
                          borderRadius="10px"
                          color="var(--color-text-muted)"
                          _hover={{ bg: "var(--color-bg-hover)", color: "var(--color-text-primary)" }}
                          aria-label="Edit resolved bugs"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggle();
                          }}
                          disabled={!sortedProjectBugs.length}
                        >
                          <ActionIcon>
                            <EditTextIcon size={15} />
                          </ActionIcon>
                        </Button>
                      )}
                    />
                  </Flex>
                  <Text color="var(--color-text-muted)" fontSize="sm">
                    These bugs will be closed when this task reaches Done.
                  </Text>
                </Stack>

                {selectedResolvedBugs.length ? (
                  <Flex gap="2" wrap="wrap">
                    {selectedResolvedBugs.map((resolvedBug) => (
                      <Box
                        key={resolvedBug.id}
                        borderWidth="1px"
                        borderColor="var(--color-border-default)"
                        borderRadius="full"
                        bg="var(--color-bg-muted)"
                        px="3"
                        py="1.5"
                        maxW="100%"
                      >
                        <Text
                          color="var(--color-text-primary)"
                          fontWeight="600"
                          fontSize="sm"
                          lineClamp="1"
                        >
                          {resolvedBug.title}
                        </Text>
                      </Box>
                    ))}
                  </Flex>
                ) : (
                  <Text color="var(--color-text-muted)" fontSize="sm">
                    This task will not close any bugs yet.
                  </Text>
                )}
              </Stack>
            ) : null}

            </Stack>

            <Stack gap="1.5" pt="1" mt={{ xl: "auto" }}>
              <Flex
                justify={canCreateTaskBranch ? "space-between" : "flex-end"}
                gap="3"
                wrap="wrap"
              >
              {kind === "task" && task ? (
                <Button
                  borderRadius="full"
                  variant="outline"
                  borderColor="var(--color-border-strong)"
                  color="var(--color-text-primary)"
                  _hover={{ bg: "var(--color-bg-hover)" }}
                  onClick={() => onCreateTaskBranch(task)}
                  disabled={!canCreateTaskBranch}
                >
                  Create git branch
                </Button>
              ) : null}
              <Button
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
              <Text
                color="var(--color-text-muted)"
                fontSize="xs"
                visibility="hidden"
                display={{ base: "none", xl: "block" }}
                aria-hidden="true"
                userSelect="none"
              >
                {commentHint}
              </Text>
            </Stack>
          </Flex>
        </Grid>
      </Flex>
    </ModalFrame>
  );
}
