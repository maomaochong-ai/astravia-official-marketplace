import { defineConfig } from "vitest/config";

// The service has its own suite; keep this run to the panel so `npm test` does not
// execute the same service tests twice.
export default defineConfig({
  test: { include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"] },
});
