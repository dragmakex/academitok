import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

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
  },
  watch: {
    ignored: [".worktrees/**"],
  },
})

export default config
