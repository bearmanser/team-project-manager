import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
    globalCss: {
        "html, body": {
            background: "#090d12",
            color: "#f5f7fb",
        },
        body: {
            minHeight: "100vh",
        },
        "#root": {
            minHeight: "100vh",
        },
        "*": {
            scrollbarColor: "#3b4657 #0f141b",
        },
        "::selection": {
            background: "#2d6cdf",
            color: "#f8fbff",
        },
    },
    theme: {
        tokens: {
            fonts: {
                heading: { value: '"Segoe UI", "Aptos", sans-serif' },
                body: { value: '"Segoe UI", "Aptos", sans-serif' },
            },
        },
    },
});

export const appSystem = createSystem(defaultConfig, config);
