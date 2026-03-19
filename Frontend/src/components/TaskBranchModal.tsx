import { Button, Flex, Input, Stack, Text } from "@chakra-ui/react";

import type { ProjectDetail, Task } from "../types";
import { ModalFrame } from "./ModalFrame";

type TaskBranchModalProps = {
    baseBranch: string;
    branchName: string;
    isOpen: boolean;
    project: ProjectDetail;
    task: Task | null;
    onBaseBranchChange: (value: string) => void;
    onBranchNameChange: (value: string) => void;
    onClose: () => void;
    onSubmit: () => void;
};

export function TaskBranchModal({
    baseBranch,
    branchName,
    isOpen,
    project,
    task,
    onBaseBranchChange,
    onBranchNameChange,
    onClose,
    onSubmit,
}: TaskBranchModalProps) {
    const repository = project.repositories[0] ?? null;

    if (!isOpen || !task || !repository) {
        return null;
    }

    return (
        <ModalFrame
            title="Create git branch"
            description={`This branch will be created in ${repository.fullName}. Leave the branch name empty to use the suggested name.`}
            isOpen={isOpen}
            onClose={onClose}
        >
            <Stack
                as="form"
                gap="4"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSubmit();
                }}
            >
                <Stack gap="1">
                    <Text color="var(--color-text-muted)" fontSize="sm">
                        Task
                    </Text>
                    <Text color="var(--color-text-primary)" fontWeight="700">
                        {task.title}
                    </Text>
                </Stack>
                <Stack gap="1">
                    <Text color="var(--color-text-muted)" fontSize="sm">
                        Branch name
                    </Text>
                    <Input
                        value={branchName}
                        onChange={(event) => onBranchNameChange(event.target.value)}
                        placeholder={`task-${task.id}-short-description`}
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                    />
                </Stack>
                <Stack gap="1">
                    <Text color="var(--color-text-muted)" fontSize="sm">
                        Base branch
                    </Text>
                    <Input
                        value={baseBranch}
                        onChange={(event) => onBaseBranchChange(event.target.value)}
                        placeholder={repository.defaultBranch}
                        bg="var(--color-bg-muted)"
                        borderColor="var(--color-border-strong)"
                        borderRadius="lg"
                        color="var(--color-text-primary)"
                    />
                </Stack>
                <Flex justify="flex-end" gap="3" wrap="wrap">
                    <Button
                        borderRadius="lg"
                        variant="outline"
                        borderColor="var(--color-border-strong)"
                        color="var(--color-text-primary)"
                        _hover={{ bg: "var(--color-bg-hover)" }}
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        borderRadius="lg"
                        bg="var(--color-accent)"
                        color="var(--color-text-inverse)"
                        _hover={{ bg: "var(--color-accent-hover)" }}
                        disabled={!baseBranch.trim()}
                    >
                        Create git branch
                    </Button>
                </Flex>
            </Stack>
        </ModalFrame>
    );
}

