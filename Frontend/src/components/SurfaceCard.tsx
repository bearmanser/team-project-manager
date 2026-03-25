import { forwardRef } from "react";

import { Box, type BoxProps } from "@chakra-ui/react";

export const SurfaceCard = forwardRef<HTMLDivElement, BoxProps>(
  function SurfaceCard(props, ref) {
    return (
      <Box
        ref={ref}
        bg="var(--color-bg-card)"
        borderWidth="1px"
        borderColor="var(--color-border-default)"
        borderRadius="12px"
        boxShadow="none"
        backdropFilter="blur(18px)"
        {...props}
      />
    );
  },
);
