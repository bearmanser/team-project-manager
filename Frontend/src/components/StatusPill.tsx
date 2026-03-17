import { Box, type BoxProps } from "@chakra-ui/react";

type StatusPillProps = BoxProps & {
    label: string;
};

export function StatusPill({ label, ...props }: StatusPillProps) {
    return (
        <Box
            as="span"
            display="inline-flex"
            alignItems="center"
            px="2.5"
            py="1"
            borderWidth="1px"
            borderColor="#344053"
            bg="#151c26"
            color="#d8e1ee"
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="0.12em"
            borderRadius="8px"
            {...props}
        >
            {label}
        </Box>
    );
}
