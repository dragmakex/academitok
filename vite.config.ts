import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { nitro } from "nitro/vite"
import path from "node:path"
import type { PluginOption } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

const config = defineConfig(({ mode }) => {
  const isVitest = mode === "test" || process.env.VITEST === "true"
  const isBrowserRun = process.argv.some((arg) =>
    arg === "--browser.enabled" || arg === "--browser.enabled=true"
  )
  const isCoverageRun = process.argv.includes("--coverage")
  const plugins: Array<PluginOption> = [
    // Vitest only needs the client-side transforms and aliases. Starting
    // Nitro/devtools in test mode leaks workers and adds browser runtime noise.
    !isVitest ? devtools() : null,
    !isVitest ? nitro({ preset: "bun" }) : null,
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      router: {
        // Exclude test/spec files from the file-based routes scan.
        routeFileIgnorePattern: ".*\\.(test|spec)\\.[jt]sx?$",
      },
    }),
    viteReact(),
  ]

  return {
    plugins,
    resolve: {
      alias: {
        "@/lib/react-grab-loader": path.resolve(
          process.cwd(),
          mode === "development"
            ? "src/lib/react-grab-loader.dev.ts"
            : "src/lib/react-grab-loader.ts",
        ),
      },
    },
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
      include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
      exclude: [
        "**/.worktrees/**",
        ".worktrees/**",
        "**/.jj-workspaces/**",
        ".jj-workspaces/**",
        ...(!isBrowserRun
          ? [
            "src/component/*.test.tsx",
            "src/lib/atom-hydration.test.tsx",
            "src/visual/*.test.tsx",
          ]
          : []),
      ],
      // Browser mode configuration for component and visual regression testing
      browser: {
        enabled: isBrowserRun,
        provider: playwright(),
        headless: true,
        instances: isCoverageRun
          ? [
            {
              browser: "chromium",
              viewport: { width: 1280, height: 720 },
            },
          ]
          : [
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
        // Coverage only needs one browser to exercise instrumented code. Keeping
        // the full browser matrix for non-coverage runs preserves visual checks
        // without reintroducing flaky multi-browser startup during coverage.
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

          // Integration-heavy runtime modules are validated by focused tests,
          // but are not a good fit for the repository's narrow coverage run.
          "src/api/api-client.ts",
          "src/api/todo-schema.ts",
          "src/db/todos-repository.ts",
          "src/lib/react-grab-loader.dev.ts",
          "src/lib/react-grab-loader.ts",
          "src/lib/server-init.ts",
          "src/routes/api/-lib/todos-service.ts",

          // React UI components using hooks require rendering context
          // These are tested via visual regression tests in src/visual/
          "src/routes/-index/app.tsx", // Composition component
          "src/routes/-index/atoms.tsx", // Effect atom runtime (tested via E2E)
          "src/routes/-index/create-todo-form.tsx", // Uses useState
          "src/routes/-index/todo-item.tsx", // Uses useState
          "src/routes/-index/todo-list.tsx", // Uses useAtomValue hooks
          "src/routes/-index/dashboard-filters.tsx", // UI composition tested elsewhere
          "src/routes/-index/dashboard-stats.tsx", // UI composition tested elsewhere
          "src/routes/-index/grouped-todo-board.tsx", // Uses React hooks and async atoms
          "src/routes/-index/recent-activity.tsx", // UI composition from canonical atom
          "src/routes/-index/todo-date.ts", // Presentation helpers exercised through UI/integration
          "src/routes/-index/todo-group-section.tsx", // UI composition tested through board integration
          "src/routes/-index/use-refresh-dashboard.ts", // Hook wrapper around atom refresh
          "src/routes/__root.tsx", // React document shell component
          "src/routes/index.tsx", // Server function loader (tested via E2E)

          // Design-system internals (tested via component and visual tests)
          "src/design-system/**",
          "src/component/Footer.tsx", // Composition component

          // Linting scripts (tested separately)
          "scripts/**",

          // HMR code and module-level side effects not testable in unit tests
          "src/routes/api/$.ts", // HMR code, tested via integration tests
          "src/routes/api/-lib/todos-api-live.ts", // HTTP adapter (tested via integration)

          // Telemetry files with server-side checks unreachable in browser tests
          "src/lib/atom-hydration.tsx", // Browser-only hydration boundary test path
          "src/lib/client-init.ts", // Client-only telemetry bootstrap
          "src/lib/observability.ts", // Runtime wiring module with production-only side effects
          "src/lib/posthog-client.ts", // Browser integration covered separately from coverage run
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
        ignored: [
          ".worktrees/**",
          ".jj-workspaces/**",
        ],
      },
    },
  }
})

export default config
