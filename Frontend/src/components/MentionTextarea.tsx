import { useMemo, useRef, useState } from "react";

import { Box, Button, Stack, Textarea } from "@chakra-ui/react";

import type { ProjectMember } from "../types";

type MentionTextareaProps = {
    value: string;
    placeholder?: string;
    members: ProjectMember[];
    minH?: string;
    onChange: (value: string) => void;
};

function getMentionQuery(value: string, selectionStart: number): { query: string; start: number; end: number } | null {
    const uptoCursor = value.slice(0, selectionStart);
    const match = uptoCursor.match(/(^|\s)@([A-Za-z0-9_-]*)$/);
    if (!match) {
        return null;
    }

    return {
        query: match[2].toLowerCase(),
        start: selectionStart - match[2].length - 1,
        end: selectionStart,
    };
}

export function MentionTextarea({ value, placeholder, members, minH = "120px", onChange }: MentionTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [selectionStart, setSelectionStart] = useState(0);
    const mention = getMentionQuery(value, selectionStart);

    const suggestions = useMemo(() => {
        if (!mention) {
            return [];
        }

        return members
            .map((member) => member.user.username)
            .filter((username, index, all) => all.indexOf(username) === index)
            .filter((username) => username.toLowerCase().startsWith(mention.query))
            .slice(0, 5);
    }, [members, mention]);

    function handleSelect(username: string): void {
        if (!mention) {
            return;
        }

        const nextValue = `${value.slice(0, mention.start)}@${username} ${value.slice(mention.end)}`;
        onChange(nextValue);
        requestAnimationFrame(() => {
            const node = textareaRef.current;
            if (!node) {
                return;
            }
            const nextCursor = mention.start + username.length + 2;
            node.focus();
            node.setSelectionRange(nextCursor, nextCursor);
            setSelectionStart(nextCursor);
        });
    }

    return (
        <Stack gap="2">
            <Box position="relative">
                <Textarea
                    ref={textareaRef}
                    value={value}
                    placeholder={placeholder}
                    minH={minH}
                    bg="var(--color-bg-muted)"
                    borderColor="var(--color-border-strong)"
                    borderRadius="lg"
                    color="var(--color-text-primary)"
                    onChange={(event) => {
                        onChange(event.target.value);
                        setSelectionStart(event.target.selectionStart ?? event.target.value.length);
                    }}
                    onClick={(event) => setSelectionStart((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
                    onKeyUp={(event) => setSelectionStart((event.target as HTMLTextAreaElement).selectionStart ?? 0)}
                />
                {suggestions.length ? (
                    <Box
                        position="absolute"
                        left="0"
                        right="0"
                        bottom="calc(100% + 8px)"
                        borderWidth="1px"
                        borderColor="var(--color-border-default)"
                        borderRadius="14px"
                        bg="var(--color-bg-card)"
                        boxShadow="lg"
                        p="2"
                        zIndex="2"
                    >
                        <Stack gap="1">
                            {suggestions.map((username) => (
                                <Button
                                    key={username}
                                    justifyContent="flex-start"
                                    variant="ghost"
                                    borderRadius="10px"
                                    color="var(--color-text-primary)"
                                    _hover={{ bg: "var(--color-bg-hover)" }}
                                    onClick={() => handleSelect(username)}
                                >
                                    @{username}
                                </Button>
                            ))}
                        </Stack>
                    </Box>
                ) : null}
            </Box>
        </Stack>
    );
}
