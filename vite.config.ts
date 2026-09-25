import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // Listen on IPv6 wildcard with IPv4 mapped, so both localhost (::1)
    // and 127.0.0.1 accept connections. Binding only 0.0.0.0 makes browsers
    // that prefer ::1 fail with connection refused.
    host: "::",
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
});
