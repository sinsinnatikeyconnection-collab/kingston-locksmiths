import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Standalone Vitest config (root) — does NOT load the app's vite.config.js (which
// mounts the base44 platform plugin). Tests here target the pure logic layer and
// a focused set of component flows; the base44 SDK and async queues are mocked at
// the boundary so no network/platform calls happen during `npm test`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@base44": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "base44/shared/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", "src/vite-plugins"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts", "base44/shared/**/*.ts"],
      exclude: ["src/test/**", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    },
  },
});