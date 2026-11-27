import { initClient, SentryErrorBoundary } from "@/lib/client-init"
import { loadReactGrab } from "@/lib/react-grab-loader"
import { RegistryProvider } from "@effect/atom-react"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { useEffect } from "react"
import * as React from "react"
import appCss from "../styles.css?url"

export const rootHead = () => ({
  meta: [
    {
      charSet: "utf-8",
    },
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1, viewport-fit=cover",
    },
    {
      title: "AcademiTok Gazette",
    },
    {
      name: "description",
      content:
        "A full-screen, swipe-native feed of academic papers set like a print-era broadsheet. Metadata and open-access links from OpenAlex; no PDFs, no paywall.",
    },
    {
      name: "theme-color",
      content: "oklch(0.18 0.012 60)",
    },
    {
      name: "apple-mobile-web-app-capable",
      content: "yes",
    },
    {
      name: "apple-mobile-web-app-status-bar-style",
      content: "black-translucent",
    },
    {
      name: "apple-mobile-web-app-title",
      content: "AcademiTok",
    },
    { property: "og:site_name", content: "AcademiTok" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://academitok.com/" },
    {
      property: "og:image",
      content: "https://academitok.com/apple-touch-icon.png",
    },
    { name: "twitter:card", content: "summary" },
    {
      name: "twitter:title",
      content: "AcademiTok — academic papers, one swipe at a time",
    },
    {
      name: "twitter:description",
      content:
        "A full-screen, swipe-native feed of academic papers set like a print-era broadsheet.",
    },
    {
      name: "twitter:image",
      content: "https://academitok.com/apple-touch-icon.png",
    },
  ],
  links: [
    {
      rel: "canonical",
      href: "https://academitok.com/",
    },
    {
      rel: "icon",
      href: "/mark.svg",
      type: "image/svg+xml",
    },
    {
      rel: "apple-touch-icon",
      href: "/apple-touch-icon.png",
      sizes: "180x180",
    },
    {
      rel: "manifest",
      href: "/manifest.json",
    },
    {
      rel: "sitemap",
      href: "/sitemap.xml",
    },
    {
      rel: "llms",
      href: "/llms.txt",
    },
    {
      rel: "stylesheet",
      href: appCss,
    },
  ],
  scripts: [
    {
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "AcademiTok",
        alternateName: "AcademiTok Gazette",
        url: "https://academitok.com/",
        description:
          "A full-screen, swipe-native feed of academic papers set like a print-era broadsheet. Metadata and open-access links from OpenAlex.",
        inLanguage: "en",
        isAccessibleForFree: true,
      }),
    },
  ],
})

/** Longest preview copy a search engine or chat client prints. */
const headCopyLimit = 160

/**
 * Clamps preview copy, cutting on a word boundary.
 * @param text - Raw title or description.
 * @returns Single-line copy no longer than {@link headCopyLimit} characters.
 */
function clampHeadCopy(text: string): string {
  const collapsed = text.replaceAll(/\s+/g, " ").trim()
  if (collapsed.length <= headCopyLimit) {
    return collapsed
  }
  const cut = collapsed.slice(0, headCopyLimit)
  const boundary = cut.lastIndexOf(" ")
  return (boundary > 0 ? cut.slice(0, boundary) : cut).trimEnd()
}

/**
 * Builds the title and preview entries for one surface.
 * @param options - Copy for the surface.
 * @param options.title - Page title.
 * @param options.description - Preview copy; omitted when the surface has none.
 * @param options.noindex - Whether the surface is reader-local and unindexed.
 * @returns Head meta carrying the title, description and their Open Graph twins.
 */
export function pageHead(
  { title, description, noindex }: {
    title: string
    description?: string
    noindex?: boolean
  },
) {
  const headline = clampHeadCopy(title)
  const summary = description === undefined
    ? undefined
    : clampHeadCopy(description)

  return {
    meta: [
      { title: headline },
      ...(summary === undefined
        ? []
        : [{ name: "description", content: summary }]),
      ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      { property: "og:title", content: headline },
      ...(summary === undefined
        ? []
        : [{ property: "og:description", content: summary }]),
    ],
  }
}

export const Route = createRootRoute({
  head: rootHead,

  shellComponent: RootDocument,
})

/**
 * The root document component for the application.
 *
 * @param props - The properties for the RootDocument component.
 * @param props.children - The child elements to be rendered within the document.
 * @returns The rendered HTML document.
 */
function RootDocument({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initClient()
    void loadReactGrab()
  }, [])

  const [isClient, setIsClient] = React.useState(false)

  React.useEffect(() => {
    setIsClient(true)
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SentryErrorBoundary
          fallback={
            <div>
              Something went wrong
            </div>
          }
        >
          <RegistryProvider defaultIdleTTL={60_000}>
            {children}
          </RegistryProvider>
        </SentryErrorBoundary>
        {isClient && import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
