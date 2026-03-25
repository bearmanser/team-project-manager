import { Box, Button, Input, Stack, Text } from "@chakra-ui/react";

type PublicLoginPanelProps = {
  busyLabel: string | null;
  error: string | null;
  notice: string | null;
  loginForm: {
    identifier: string;
    password: string;
  };
  onLoginFormChange: (field: "identifier" | "password", value: string) => void;
  onSubmitLogin: () => void;
};

export function PublicLoginPanel({
  busyLabel,
  error,
  notice,
  loginForm,
  onLoginFormChange,
  onSubmitLogin,
}: PublicLoginPanelProps) {
  return (
    <Stack gap="4" p="1">
      <Stack gap="1">
        <Text
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing="0.14em"
          color="var(--color-text-subtle)"
        >
          Login
        </Text>
        <Text color="var(--color-text-secondary)" fontSize="sm">
          Access your workspace and pick up where the team left off.
        </Text>
      </Stack>

      {error ? (
        <Box
          borderWidth="1px"
          borderColor="var(--color-danger-border)"
          bg="var(--color-danger-bg)"
          p="2.5"
          borderRadius="lg"
          color="var(--color-danger-text)"
          fontSize="sm"
        >
          {error}
        </Box>
      ) : null}

      {notice ? (
        <Box
          borderWidth="1px"
          borderColor="var(--color-success-border)"
          bg="var(--color-success-bg)"
          p="2.5"
          borderRadius="lg"
          color="var(--color-success-text)"
          fontSize="sm"
        >
          {notice}
        </Box>
      ) : null}

      <Stack
        as="form"
        gap="4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitLogin();
        }}
      >
        <Stack gap="2">
          <Text color="var(--color-text-strong)">Email or username</Text>
          <Input
            value={loginForm.identifier}
            onChange={(event) =>
              onLoginFormChange("identifier", event.target.value)
            }
            bg="var(--color-bg-muted)"
            borderColor="var(--color-border-strong)"
            borderRadius="lg"
            color="var(--color-text-primary)"
          />
        </Stack>
        <Stack gap="2">
          <Text color="var(--color-text-strong)">Password</Text>
          <Input
            type="password"
            value={loginForm.password}
            onChange={(event) => onLoginFormChange("password", event.target.value)}
            bg="var(--color-bg-muted)"
            borderColor="var(--color-border-strong)"
            borderRadius="lg"
            color="var(--color-text-primary)"
          />
        </Stack>
        <Button
          type="submit"
          borderRadius="lg"
          bg="var(--color-accent)"
          color="var(--color-text-inverse)"
          alignSelf="flex-start"
          disabled={Boolean(busyLabel)}
          _hover={{ bg: "var(--color-accent-hover)" }}
        >
          {busyLabel ?? "Sign in"}
        </Button>
      </Stack>
    </Stack>
  );
}
