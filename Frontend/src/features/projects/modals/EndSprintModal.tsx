import { Button, Stack, Text, Textarea } from "@chakra-ui/react";

import { ModalFrame } from "../../../components/ModalFrame";
import type { ProjectDetail } from "../../../types";

type EndSprintModalProps = {
    isOpen: boolean;
    project: ProjectDetail;
    reviewText: string;
    onChange: (value: string) => void;
    onClose: () => void;
    onSubmit: () => void;
};

export function EndSprintModal({
    isOpen,
    project,
    reviewText,
    onChange,
    onClose,
    onSubmit,
}: EndSprintModalProps) {
    const activeSprint = project.activeSprint;
    const sprintTaskCount = activeSprint
        ? project.tasks.filter((task) => task.sprintId === activeSprint.id).length
        : 0;

    return (
        <ModalFrame
            title={activeSprint ? `End ${activeSprint.name}` : "End sprint"}
            description="Wrap the current sprint, capture a quick review note if you want, and decide what should happen to unfinished work next."
            isOpen={isOpen}
            onClose={onClose}
        >
            <Stack gap="4">
                <Text color="var(--color-text-secondary)">
                    {activeSprint
                        ? `${activeSprint.name} currently has ${sprintTaskCount} tasks.`
                        : "No active sprint is available."}
                </Text>
                <Textarea
                    value={reviewText}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Optional sprint review: what shipped, what slipped, and what to watch next sprint."
                    minH="180px"
                    bg="var(--color-bg-muted)"
                    borderColor="var(--color-border-strong)"
                    borderRadius="lg"
                    color="var(--color-text-primary)"
                />
                <Button
                    onClick={onSubmit}
                    alignSelf="flex-start"
                    borderRadius="lg"
                    bg="var(--color-accent)"
                    color="var(--color-text-inverse)"
                    _hover={{ bg: "var(--color-accent-hover)" }}
                    disabled={!activeSprint}
                >
                    End sprint
                </Button>
            </Stack>
        </ModalFrame>
    );
}
