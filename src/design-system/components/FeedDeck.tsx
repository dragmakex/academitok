import { forwardRef, type HTMLAttributes, type ReactNode } from "react"
import { Masthead } from "./Masthead"

type FeedDeckProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  readonly announcement?: string | undefined
  readonly children: ReactNode
}

/**
 * Keeps the softened newspaper stationary behind the scrolling paper.
 * @param props - Slides, live announcement and section attributes.
 * @param ref - Forwarded deck section.
 * @returns The reading deck.
 */
export const FeedDeck = forwardRef<HTMLElement, FeedDeckProps>(
  function FeedDeck({ announcement, children, ...props }, ref) {
    return (
      <section
        {...props}
        ref={ref}
        aria-label="Academic paper feed"
        tabIndex={0}
        className="flex h-[100dvh] flex-col overflow-hidden bg-paper bg-[url('/newsprint.webp')] bg-cover bg-center bg-no-repeat text-ink focus:outline-none"
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <Masthead variant="banner" />
        <div className="mx-auto min-h-0 w-[min(94%,max(54vw,40rem))] flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain border-x border-rule-soft bg-paper pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          {children}
        </div>
      </section>
    )
  },
)
