import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

function normalizeBasePath(basePath: string): string {
  const trimmedPath = basePath.trim();

  if (!trimmedPath || trimmedPath === "/") {
    return "/";
  }

  const withLeadingSlash = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: normalizeBasePath(env.VITE_APP_BASE_PATH ?? "/"),
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      proxy: {
        "/api": "http://127.0.0.1:8000",
      },
    },
  };
});
