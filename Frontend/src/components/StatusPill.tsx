import { Box, type BoxProps } from "@chakra-ui/react";

type StatusPillProps = BoxProps & {
    label: string;
    compact?: boolean;
};

export function StatusPill({ label, compact = false, ...props }: StatusPillProps) {
    return (
        <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            px={compact ? "2" : "2.5"}
            py={compact ? "0.5" : "1"}
            minH={compact ? "auto" : undefined}
            borderWidth="1px"
            borderColor="var(--color-border-soft)"
            bg="var(--color-bg-soft)"
            color="var(--color-text-strong)"
            fontSize={compact ? "10px" : "xs"}
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing={compact ? "0.1em" : "0.12em"}
            borderRadius={compact ? "6px" : "8px"}
            whiteSpace="nowrap"
            {...props}
        >
            {label}
        </Box>
    );
}
