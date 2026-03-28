import { Button, Stack, Text } from "@chakra-ui/react";

import { ModalFrame } from "../../../components/ModalFrame";
import type { EndSprintUnfinishedAction, Task } from "../../../types";

type EndSprintIncompleteTasksModalProps = {
    action: EndSprintUnfinishedAction;
    isOpen: boolean;
    sprintName: string;
    tasks: Task[];
    onActionChange: (value: EndSprintUnfinishedAction) => void;
    onClose: () => void;
    onSubmit: () => void;
};

const ACTION_OPTIONS: Array<{
    value: EndSprintUnfinishedAction;
    title: string;
    description: string;
}> = [
    {
        value: "done",
        title: "Set them as done",
        description: "Close the sprint by marking every unfinished task as Done before the sprint is archived.",
    },
    {
        value: "carryover",
        title: "Carry over to next sprint",
        description: "Move the unfinished tasks into the next sprint and keep their current statuses.",
    },
    {
        value: "product",
        title: "Add back to product backlog",
        description: "Take the unfinished tasks out of the sprint and return them to the product backlog.",
    },
];

export function EndSprintIncompleteTasksModal({
    action,
    isOpen,
    sprintName,
    tasks,
    onActionChange,
    onClose,
    onSubmit,
}: EndSprintIncompleteTasksModalProps) {
    return (
        <ModalFrame
            title={sprintName ? `Finish ${sprintName}` : "Finish sprint"}
            description="Choose what should happen to the unfinished tasks before the sprint is closed."
            isOpen={isOpen}
            onClose={onClose}
        >
            <Stack gap="4">
                <Text color="var(--color-text-secondary)">
                    {tasks.length} unfinished {tasks.length === 1 ? "task is" : "tasks are"} still in this sprint.
                </Text>
                <Stack gap="2">
                    {tasks.map((task) => (
                        <Text key={task.id} color="var(--color-text-muted)">
                            {task.title}
                        </Text>
                    ))}
                </Stack>
                <Stack gap="3">
                    {ACTION_OPTIONS.map((option) => {
                        const isSelected = action === option.value;

                        return (
                            <Button
                                key={option.value}
                                justifyContent="flex-start"
                                textAlign="left"
                                h="auto"
                                px="4"
                                py="3.5"
                                borderRadius="lg"
                                variant="outline"
                                borderColor={isSelected ? "var(--color-accent-border)" : "var(--color-border-strong)"}
                                bg={isSelected ? "var(--color-bg-hover)" : "var(--color-bg-muted)"}
                                color="var(--color-text-primary)"
                                _hover={{ bg: "var(--color-bg-hover)" }}
                                onClick={() => onActionChange(option.value)}
                            >
                                <Stack gap="1" align="flex-start">
                                    <Text fontWeight="700" color="var(--color-text-primary)">
                                        {option.title}
                                    </Text>
                                    <Text whiteSpace="normal" color="var(--color-text-muted)" fontWeight="500">
                                        {option.description}
                                    </Text>
                                </Stack>
                            </Button>
                        );
                    })}
                </Stack>
                <Button
                    onClick={onSubmit}
                    alignSelf="flex-start"
                    borderRadius="lg"
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
                    _hover={{ bg: "var(--color-accent-hover)" }}
                >
                    End sprint
                </Button>
            </Stack>
        </ModalFrame>
    );
}
