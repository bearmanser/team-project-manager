import { Button, Input, Stack, Text, Textarea } from "@chakra-ui/react";

import type { BacklogPlacement, PriorityLevel, ProjectDetail, TaskStatus } from "../types";
import {
    getPriorityLabel,
    getPriorityOptionStyle,
    getTaskStatusOptionStyle,
    nativeSelectStyle,
    PRIORITY_OPTIONS,
} from "../utils";
import { ModalFrame } from "./ModalFrame";

type CreateTaskModalProps = {
    form: {
        title: string;
        description: string;
        status: TaskStatus;
        priority: PriorityLevel;
        placement: BacklogPlacement;
        bugReportId: number | null;
        bugReportTitle: string;
        markAsResolution: boolean;
    };
    isOpen: boolean;
    project: ProjectDetail;
    onClose: () => void;
    onCreateTask: () => void;
    onFormChange: (field: "title" | "description" | "status" | "priority" | "placement", value: string) => void;
    onMarkAsResolutionChange: (value: boolean) => void;
};

export function CreateTaskModal({
    form,
    isOpen,
    project,
    onClose,
    onCreateTask,
    onFormChange,
    onMarkAsResolutionChange,
}: CreateTaskModalProps) {
    const isBugLinked = Boolean(form.bugReportId);

    return (
        <ModalFrame
            title={isBugLinked ? "Create bug task" : "Add task"}
            description={
                isBugLinked
                    ? "Start from the bug details below, then choose where the follow-up task should land."
                    : "Capture the work, choose its first status and priority, then place it in the current sprint or product backlog."
            }
            isOpen={isOpen}
            onClose={onClose}
        >
            <Stack
                as="form"
                gap="4"
                onSubmit={(event) => {
                    event.preventDefault();
                    onCreateTask();
                }}
            >
                {isBugLinked ? (
                    <Stack gap="2" p="3" borderRadius="lg" bg="var(--color-bg-muted)">
                        <Text fontSize="sm" color="var(--color-text-muted)">
                            Based on bug
                        </Text>
                        <Text color="var(--color-text-primary)" fontWeight="700">
                            {form.bugReportTitle}
                        </Text>
                        <label style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={form.markAsResolution}
                                onChange={(event) => onMarkAsResolutionChange(event.target.checked)}
                            />
                            <Text color="var(--color-text-primary)">Mark this as the resolution task</Text>
                        </label>
                    </Stack>
                ) : null}
                <Input
                    value={form.title}
                    onChange={(event) => onFormChange("title", event.target.value)}
                    placeholder="Ship org-level user management"
                    bg="var(--color-bg-muted)"
                    borderColor="var(--color-border-strong)"
                    borderRadius="lg"
                    color="var(--color-text-primary)"
                />
                <Textarea
                    value={form.description}
                    onChange={(event) => onFormChange("description", event.target.value)}
                    placeholder="Add the details teammates need."
                    bg="var(--color-bg-muted)"
                    borderColor="var(--color-border-strong)"
                    borderRadius="lg"
                    color="var(--color-text-primary)"
                    minH="140px"
                />
                {project.useSprints ? (
                    <Stack gap="2">
                        <Text fontSize="sm" color="var(--color-text-muted)">
                            Backlog placement
                        </Text>
                        <select
                            value={form.placement}
                            style={nativeSelectStyle}
                            onChange={(event) => onFormChange("placement", event.target.value)}
                        >
                            <option value="sprint">
                                {project.activeSprint ? `${project.activeSprint.name} sprint backlog` : "Sprint backlog"}
                            </option>
                            <option value="product">Product backlog</option>
                        </select>
                    </Stack>
                ) : null}
                <select
                    value={form.status}
                    style={nativeSelectStyle}
                    onChange={(event) => onFormChange("status", event.target.value)}
                >
                    {project.boardColumns.map((column) => (
                        <option key={column.id} value={column.id} style={getTaskStatusOptionStyle(column.id)}>
                            {column.label}
                        </option>
                    ))}
                </select>
                <select
                    value={form.priority}
                    style={nativeSelectStyle}
                    onChange={(event) => onFormChange("priority", event.target.value)}
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
                    {isBugLinked ? "Create task from bug" : "Add task"}
                </Button>
            </Stack>
        </ModalFrame>
    );
}
