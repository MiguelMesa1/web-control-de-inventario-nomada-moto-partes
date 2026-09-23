import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Node tests run server modules; Next.js enforces this boundary in builds.
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      reporter: ["text", "json-summary"],
    },
  },
});
