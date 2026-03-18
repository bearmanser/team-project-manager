import { Box, type BoxProps } from "@chakra-ui/react";

export function SurfaceCard(props: BoxProps) {
    return (
        <Box
            bg="var(--color-bg-card)"
            borderWidth="1px"
            borderColor="var(--color-border-default)"
            borderRadius="12px"
            boxShadow="none"
            backdropFilter="blur(18px)"
            {...props}
        />
    );
}
