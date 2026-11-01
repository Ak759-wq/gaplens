import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // `server-only` throws outside a React Server Component, so tests get a no-op stub.
    // fileURLToPath (not URL#pathname) keeps the path valid when the checkout contains spaces.
    alias: { "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)) },
  },
});
