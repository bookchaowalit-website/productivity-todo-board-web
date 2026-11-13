import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// "@/" matches tsconfig paths so tests can import the page and the App shell components.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
