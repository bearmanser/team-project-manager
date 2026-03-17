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
        "button, a, input, textarea, select": {
            transitionProperty: "background-color, border-color, color, box-shadow, transform",
            transitionDuration: "160ms",
            transitionTimingFunction: "ease",
        },
        "button:not(:disabled), a, [role='button']": {
            cursor: "pointer",
        },
        "button:not(:disabled):hover, a:hover, [role='button']:hover": {
            transform: "translateY(-1px)",
        },
        "button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible": {
            outline: "none",
            boxShadow: "0 0 0 1px #6d95e6",
        },
        "input:hover, textarea:hover, select:hover": {
            borderColor: "#415069",
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
