import { StrictMode } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { appSystem } from "./theme";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ChakraProvider value={appSystem}>
            <App />
        </ChakraProvider>
    </StrictMode>,
);
