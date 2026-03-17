import { Box, type BoxProps } from "@chakra-ui/react";

export function SurfaceCard(props: BoxProps) {
    return (
        <Box
            bg="#111720"
            borderWidth="1px"
            borderColor="#273140"
            borderRadius="0"
            boxShadow="none"
            backdropFilter="blur(18px)"
            {...props}
        />
    );
}
