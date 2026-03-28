import { useState } from "react";

import { Button, Input, Stack, Text } from "@chakra-ui/react";

import { ModalFrame } from "./ModalFrame";

type NameConfirmModalProps = {
    entityLabel: string;
    isDeleting: boolean;
    isOpen: boolean;
    name: string;
    onClose: () => void;
    onConfirm: () => void;
};

export function NameConfirmModal({
    entityLabel,
    isDeleting,
    isOpen,
    name,
    onClose,
    onConfirm,
}: NameConfirmModalProps) {
    const [confirmationValue, setConfirmationValue] = useState("");
    const isConfirmed = confirmationValue.trim() === name;

    function handleClose(): void {
        setConfirmationValue("");
        onClose();
    }

    return (
        <ModalFrame
            title={`Delete ${entityLabel}`}
            description="Type the exact name below to confirm. This action cannot be undone."
            isOpen={isOpen}
            onClose={handleClose}
            maxW="560px"
        >
            <Stack gap="4">
                <Text color="var(--color-text-primary)" fontWeight="600">
                    {name}
                </Text>
                <Text color="var(--color-text-muted)">
                    Deleting this {entityLabel} permanently removes its data.
                </Text>
                <Input
                    value={confirmationValue}
                    onChange={(event) => setConfirmationValue(event.target.value)}
                    placeholder={name}
                    bg="var(--color-bg-muted)"
                    borderColor="var(--color-border-strong)"
                    borderRadius="lg"
                    color="var(--color-text-primary)"
                />
                <Stack direction={{ base: "column", sm: "row" }} gap="3" justify="flex-end">
                    <Button
                        borderRadius="lg"
                        variant="outline"
                        borderColor="var(--color-border-strong)"
                        color="var(--color-text-primary)"
                        onClick={handleClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        borderRadius="lg"
                        variant="outline"
                        borderColor="var(--color-danger-border)"
                        color="var(--color-danger-text)"
                        disabled={!isConfirmed || isDeleting}
                        _hover={{ bg: "var(--color-danger-bg-soft)", borderColor: "var(--color-danger-border)" }}
                        onClick={onConfirm}
                    >
                        {isDeleting ? `Deleting ${entityLabel}` : `Delete ${entityLabel}`}
                    </Button>
                </Stack>
            </Stack>
        </ModalFrame>
    );
}
