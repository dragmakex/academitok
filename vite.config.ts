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
        },
      },
    },
    // Coverage configuration - 100% coverage required (German precision engineering)
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "json-summary", "json"],

      // 100% coverage thresholds - NO EXCEPTIONS
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
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
      ],

      // Enforce coverage for all files, not just tested ones
      all: true,

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
