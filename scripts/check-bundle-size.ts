#!/usr/bin/env bun
import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { brotliCompress, gzip } from "node:zlib"

const brotliCompressAsync = promisify(brotliCompress)
const gzipAsync = promisify(gzip)

// Choose compression method: 'brotli' or 'gzip'
// - Brotli: 15-20% better compression, 95%+ browser support
// - Gzip: Universal support, fallback for older browsers/bots
const COMPRESSION_METHOD: "brotli" | "gzip" = "brotli"

interface BundleSizeLimit {
  name: string
  path: string
  limit: number // in KB (compressed)
}

interface SanityCheck {
  name: string
  path: string
  limitRaw: number // KB (raw, uncompressed - sanity check only)
}

const limits: Array<BundleSizeLimit> = [
  {
    name: "Client Bundle (JS/CSS)",
    path: ".output/public",
    limit: 200, // KB (compressed, target: excellent)
  },
]

// Sanity check for server bundle (catches accidental asset bundling)
const sanityChecks: Array<SanityCheck> = [
  {
    name: "Server Bundle (JS)",
    path: ".output/server",
    limitRaw: 50_000, // KB (50 MB raw - very permissive, just catch accidents)
  },
]

const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const CYAN = "\x1b[36m"
const BLUE = "\x1b[34m"
const RESET = "\x1b[0m"

interface FileSize {
  path: string
  raw: number
  gzip: number
  brotli: number
}

/**
 * Check if file should be included in bundle size check
 * Only JS and CSS files matter for critical path performance
 * @param filePath
 */
function shouldIncludeFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase()
  return ext === "js" || ext === "mjs" || ext === "css"
}

/**
 * Recursively gets all files in a directory with their sizes
 * @param dirPath
 * @param baseDir
 */
async function getDirectoryFiles(
  dirPath: string,
  baseDir: string = dirPath,
): Promise<Array<FileSize>> {
  const files: Array<FileSize> = []

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        const subFiles = await getDirectoryFiles(fullPath, baseDir)
        files.push(...subFiles)
      } else if (shouldIncludeFile(fullPath)) {
        const stats = await stat(fullPath)
        const content = await readFile(fullPath)

        // Compress with both methods for comparison
        const [gzipCompressed, brotliCompressed] = await Promise.all([
          gzipAsync(content, { level: 9 }),
          brotliCompressAsync(content),
        ])

        files.push({
          path: fullPath.replace(`${baseDir}/`, ""),
          raw: stats.size,
          gzip: gzipCompressed.length,
          brotli: brotliCompressed.length,
        })
      }
    }
  } catch {
    return []
  }

  return files
}

/**
 * Formats a size in bytes to a human-readable string
 * @param bytes
 */
function formatSize(bytes: number): string {
  const kb = bytes / 1024
  return `${kb.toFixed(2)} KB`
}

/**
 * Formats a file breakdown table
 * @param files
 * @param totalLimit
 */
function formatBreakdown(files: Array<FileSize>, totalLimit: number): string {
  const compressedSize = COMPRESSION_METHOD === "brotli"
    ? "compressed"
    : "compressed"
  const sortKey = COMPRESSION_METHOD === "brotli" ? "brotli" : "gzip"

  // Sort by compressed size, largest first
  const sorted = [...files].sort((a, b) => b[sortKey] - a[sortKey])

  // Take top 10 largest files
  const top10 = sorted.slice(0, 10)

  let output = `\n  ${CYAN}Top files by ${COMPRESSION_METHOD} size:${RESET}\n\n`
  output += `  ${"File".padEnd(50)} ${"Raw".padStart(12)} ${
    "Gzip".padStart(12)
  } ${"Brotli".padStart(12)} ${"Savings".padStart(10)}\n`
  output += `  ${"─".repeat(50)} ${"─".repeat(12)} ${"─".repeat(12)} ${
    "─".repeat(12)
  } ${"─".repeat(10)}\n`

  for (const file of top10) {
    const savings = (((file.gzip - file.brotli) / file.gzip) * 100).toFixed(1)
    const name = file.path.length > 50
      ? `...${  file.path.slice(-47)}`
      : file.path

    output += `  ${name.padEnd(50)} ${formatSize(file.raw).padStart(12)} ${
      formatSize(file.gzip).padStart(12)
    } ${formatSize(file.brotli).padStart(12)} ${(`${savings  }%`).padStart(10)}\n`
  }

  return output
}

/**
 * Formats compression benchmark comparison
 * @param files
 */
function formatCompressionBenchmark(
  files: Array<FileSize>,
): { totalRaw: number; totalGzip: number; totalBrotli: number } {
  const totalRaw = files.reduce((sum, f) => sum + f.raw, 0)
  const totalGzip = files.reduce((sum, f) => sum + f.gzip, 0)
  const totalBrotli = files.reduce((sum, f) => sum + f.brotli, 0)

  const gzipRatio = (((totalRaw - totalGzip) / totalRaw) * 100).toFixed(1)
  const brotliRatio = (((totalRaw - totalBrotli) / totalRaw) * 100).toFixed(1)
  const brotliVsGzip = (((totalGzip - totalBrotli) / totalGzip) * 100).toFixed(
    1,
  )

  console.log(`  ${BLUE}Compression Benchmark:${RESET}`)
  console.log(
    `  Raw:    ${formatSize(totalRaw).padStart(12)} (baseline)`,
  )
  console.log(
    `  Gzip:   ${
      formatSize(totalGzip).padStart(12)
    } (${gzipRatio}% smaller, universal support)`,
  )
  console.log(
    `  Brotli: ${
      formatSize(totalBrotli).padStart(12)
    } (${brotliRatio}% smaller, ${brotliVsGzip}% better than gzip)`,
  )
  console.log("")

  return { totalRaw, totalGzip, totalBrotli }
}

/**
 * Gets total raw size of files (no compression)
 * @param dirPath
 */
async function getTotalRawSize(dirPath: string): Promise<number> {
  const files = await getDirectoryFiles(dirPath)
  return files.reduce((sum, f) => sum + f.raw, 0)
}

/**
 * Checks bundle sizes against limits
 */
async function checkBundleSizes(): Promise<void> {
  console.log(
    `🔍 Checking bundle sizes (JS/CSS only, ${COMPRESSION_METHOD} compressed)...\n`,
  )

  let allPassed = true

  // Check compressed bundles (critical for performance)
  for (const config of limits) {
    const files = await getDirectoryFiles(config.path)

    if (files.length === 0) {
      console.log(`${YELLOW}⚠${RESET} ${config.name}: No files found\n`)
      continue
    }

    const { totalBrotli, totalGzip, totalRaw } = formatCompressionBenchmark(
      files,
    )

    const totalCompressed = COMPRESSION_METHOD === "brotli"
      ? totalBrotli
      : totalGzip
    const sizeKB = totalCompressed / 1024
    const limitKB = config.limit
    const passed = sizeKB <= limitKB
    const percentage = ((sizeKB / limitKB) * 100).toFixed(1)

    const status = passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
    const color = passed ? GREEN : sizeKB > limitKB * 0.9 ? RED : YELLOW

    console.log(
      `${status} ${config.name}: ${color}${
        formatSize(totalCompressed)
      }${RESET} ${COMPRESSION_METHOD}`,
    )
    console.log(
      `  Limit: ${
        formatSize(limitKB * 1024)
      } | Usage: ${color}${percentage}%${RESET}`,
    )

    if (!passed) {
      allPassed = false
      const excess = sizeKB - limitKB
      console.log(
        `  ${RED}Exceeds limit by ${formatSize(excess * 1024)}${RESET}`,
      )
      console.log(formatBreakdown(files, limitKB))
    }

    console.log("")
  }

  // Sanity checks (raw size only, no compression needed)
  for (const check of sanityChecks) {
    const totalRaw = await getTotalRawSize(check.path)

    if (totalRaw === 0) {
      console.log(`${YELLOW}⚠${RESET} ${check.name}: No files found\n`)
      continue
    }

    const sizeKB = totalRaw / 1024
    const limitKB = check.limitRaw
    const passed = sizeKB <= limitKB
    const percentage = ((sizeKB / limitKB) * 100).toFixed(1)

    const status = passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`
    const color = passed ? GREEN : sizeKB > limitKB * 0.9 ? RED : YELLOW

    console.log(
      `${status} ${check.name}: ${color}${
        formatSize(totalRaw)
      }${RESET} raw (sanity check)`,
    )
    console.log(
      `  Limit: ${
        formatSize(limitKB * 1024)
      } | Usage: ${color}${percentage}%${RESET}`,
    )

    if (!passed) {
      allPassed = false
      const excess = sizeKB - limitKB
      console.log(
        `  ${RED}Exceeds limit by ${
          formatSize(excess * 1024)
        } - likely bundling assets accidentally${RESET}`,
      )
    }

    console.log("")
  }

  if (!allPassed) {
    console.error(`${RED}❌ Bundle size check failed!${RESET}`)
    console.error(
      `${YELLOW}Optimize large files or increase limits in scripts/check-bundle-size.ts${RESET}\n`,
    )
    process.exit(1)
  }

  console.log(`${GREEN}✅ All bundle size checks passed!${RESET}`)
  console.log(
    `${CYAN}Using ${COMPRESSION_METHOD} compression (modern browsers + CDNs)${RESET}`,
  )
  console.log(
    `${CYAN}Change COMPRESSION_METHOD in scripts/check-bundle-size.ts to switch${RESET}\n`,
  )
}

checkBundleSizes()
