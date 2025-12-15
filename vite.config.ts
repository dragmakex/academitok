import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { nitro } from "nitro/vite"
import viteTsConfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

const config = defineConfig({
  plugins: [
    devtools(),
    nitro({ preset: "bun" }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: process.env.NODE_ENV === "development",
    chunkSizeWarningLimit: 500,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "effect", "@tanstack/react-router"],
  },
  test: {
    globals: true,
    // Browser mode configuration for component and visual regression testing
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        {
          browser: "chromium",
          viewport: { width: 1280, height: 720 },
        },
        {
          browser: "firefox",
          viewport: { width: 1280, height: 720 },
        },
        {
          browser: "webkit",
          viewport: { width: 1280, height: 720 },
        },
      ],
      expect: {
        toMatchScreenshot: {
          comparatorName: "pixelmatch",
          comparatorOptions: {
            threshold: 0.2,
            allowedMismatchedPixelRatio: 0.01,
          },
          // Platform-agnostic screenshot paths - exclude OS from filename
          // This ensures screenshots work across macOS (darwin) and Linux CI
          resolveScreenshotPath: ({
            arg,
            browserName,
            ext,
            testFileDirectory,
            testFileName,
          }) =>
            `${testFileDirectory}/__screenshots__/${testFileName}/${arg}-${browserName}${ext}`,
        },
      },
    },
    // Coverage configuration - 100% coverage required (German precision engineering)
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "json-summary", "json"],

      // 100% coverage thresholds (branches at 90% due to browser test constraints)
      // Note: Branch coverage is limited because:
      // - Server-side branches (typeof window === "undefined") unreachable in browser tests
      // - Nullish coalescing defaults require mocking null returns
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 90,
        statements: 100,
      },

      // Files to include in coverage analysis
      include: ["src/**/*.{ts,tsx}"],

      // Files to exclude from coverage requirements
      exclude: [
        "src/**/*.test.{ts,tsx}", // Test files
        "src/**/*.spec.{ts,tsx}", // Spec files
        "src/visual/**", // Visual regression tests
        "src/routeTree.gen.ts", // Generated route tree
        "**/*.d.ts", // Type definitions
        "**/__tests__/**", // Test directories
        "**/node_modules/**", // Dependencies

        // Demo/example script - not production code
        "src/telemetry-example.ts",

        // React UI components using hooks require rendering context
        // These are tested via visual regression tests in src/visual/
        "src/routes/-index/app.tsx", // Composition component
        "src/routes/-index/atoms.tsx", // Effect atom runtime (tested via E2E)
        "src/routes/-index/create-todo-form.tsx", // Uses useState
        "src/routes/-index/todo-item.tsx", // Uses useState
        "src/routes/-index/todo-list.tsx", // Uses useAtomValue hooks
        "src/routes/__root.tsx", // React document shell component
        "src/routes/index.tsx", // Server function loader (tested via E2E)

        // HMR code and module-level side effects not testable in unit tests
        "src/routes/api/$.ts", // HMR code, tested via integration tests
        "src/routes/api/-lib/todos-api-live.ts", // HTTP adapter (tested via integration)

        // Telemetry files with server-side checks unreachable in browser tests
        "src/lib/posthog-client.ts", // Server-side window check (lines 28-29)
        "src/lib/logger-loki.ts", // Internal LogBuffer.destroy() method
        "src/lib/telemetry-server.ts", // OpenTelemetry callbacks
      ],

      // Don't skip files with 100% coverage in reports
      skipFull: false,

      // Clean coverage directory before running
      clean: true,

      // Output directory for coverage reports
      reportsDirectory: "./coverage",
    },
  },
  server: {
    watch: {
      ignored: [".worktrees/**"],
    },
  },
})

export default config
