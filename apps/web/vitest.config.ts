import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["components/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"],
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
