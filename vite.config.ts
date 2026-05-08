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
        "**/.repos/**",
        ".repos/**",
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
      // Keep node coverage focused on the logic we can measure honestly.
      // Browser/UI runtime paths are enforced by the separate browser lane.
      coverage: {
        provider: "istanbul",
        reporter: ["text", "html", "json-summary", "json"],
        thresholds: {
          lines: 95,
          functions: 95,
          branches: 90,
          statements: 95,
        },
        include: [
          "src/router.tsx",
          "src/api/todo-schema.ts",
          "src/db/schema.ts",
          "src/db/todos-test-support.ts",
          "src/lib/atom-utils.ts",
          "src/lib/codefabrik-workflow-state.ts",
          "src/lib/posthog-server.ts",
          "src/lib/pyroscope-server.ts",
          "src/lib/telemetry-client.ts",
          "src/lib/telemetry-server.ts",
          "src/lib/todo-id-generator.ts",
          "src/routes/api/-lib/todos-rpc-live.ts",
          "src/routes/api/-lib/todos-service.ts",
        ],
        exclude: [
          "src/**/*.test.{ts,tsx}",
          "src/**/*.spec.{ts,tsx}",
          "src/routeTree.gen.ts",
          "**/*.d.ts",
          "**/__tests__/**",
          "**/node_modules/**",
        ],
        skipFull: false,
        clean: true,
        reportsDirectory: "./coverage",
      },
    },
    server: {
      watch: {
        ignored: [
          ".worktrees/**",
          ".jj-workspaces/**",
          ".repos/**",
        ],
      },
    },
  }
})

export default config
