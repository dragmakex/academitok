import { forwardRef, type HTMLAttributes, type ReactNode } from "react"
import { Masthead } from "./Masthead"
import { NewsprintField } from "./NewsprintField"

type FeedDeckProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  readonly announcement?: string | undefined
  readonly children: ReactNode
}

/**
 * Snap-scrolling paper deck with a nameplate banner that never scrolls away.
 *
 * The banner is a sibling of the scroller, not a slide: it keeps the masthead on
 * screen for every paper without shortening the slide it sits above.
 *
 * @param props - Deck props.
 * @param props.announcement - Polite live-region text for the active paper.
 * @param props.children - Slides.
 * @param ref - Forwarded ref to the deck section.
 * @returns A full-viewport deck with a fixed nameplate.
 */
export const FeedDeck = forwardRef<HTMLElement, FeedDeckProps>(
  function FeedDeck({ announcement, children, ...props }, ref) {
    return (
      <section
        {...props}
        ref={ref}
        aria-label="Academic paper feed"
        className="relative flex h-[100dvh] flex-col overflow-hidden bg-paper-deep focus:outline-none"
        tabIndex={0}
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <NewsprintField variant="page" />
        <Masthead variant="banner" />
        <div className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          {children}
        </div>
      </section>
    )
  },
)
