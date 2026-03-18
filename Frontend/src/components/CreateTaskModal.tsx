import { Button, Input, Stack, Textarea } from "@chakra-ui/react";

import type { PriorityLevel, ProjectDetail, TaskStatus } from "../types";
import { nativeSelectStyle, PRIORITY_OPTIONS, getPriorityLabel } from "../utils";
import { ModalFrame } from "./ModalFrame";

type CreateTaskModalProps = {
    form: {
        title: string;
        description: string;
        status: TaskStatus;
        priority: PriorityLevel;
    };
    isOpen: boolean;
    project: ProjectDetail;
    onClose: () => void;
    onCreateTask: () => void;
    onFormChange: (field: "title" | "description" | "status" | "priority", value: string) => void;
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
            description="Capture the work, choose its first status and priority, then keep the board moving."
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
                <select
                    value={form.status}
                    style={nativeSelectStyle}
                    onChange={(event) => onFormChange("status", event.target.value)}
                >
                    {project.boardColumns.map((column) => (
                        <option key={column.id} value={column.id}>
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
                        <option key={priority} value={priority}>
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
