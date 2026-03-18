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
    };
    isOpen: boolean;
    project: ProjectDetail;
    onClose: () => void;
    onCreateTask: () => void;
    onFormChange: (field: "title" | "description" | "status" | "priority" | "placement", value: string) => void;
};

export function CreateTaskModal({
    form,
    isOpen,
    project,
    onClose,
    onCreateTask,
    onFormChange,
}: CreateTaskModalProps) {
    return (
        <ModalFrame
            title="Add task"
            description="Capture the work, choose its first status and priority, then place it in the current sprint or product backlog."
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
                    Add task
                </Button>
            </Stack>
        </ModalFrame>
    );
}
