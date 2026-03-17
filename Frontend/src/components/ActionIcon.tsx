import type { ReactNode } from "react";

import { Box } from "@chakra-ui/react";

type ActionIconProps = {
    children: ReactNode;
};

export function ActionIcon({ children }: ActionIconProps) {
    return (
        <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            flexShrink="0"
            lineHeight="1"
        >
            {children}
        </Box>
    );
}
