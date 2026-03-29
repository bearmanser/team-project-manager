import type { ReactElement } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { render, type RenderOptions } from "@testing-library/react";

import { appSystem } from "../theme";

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ChakraProvider value={appSystem}>{children}</ChakraProvider>
    ),
    ...options,
  });
}
