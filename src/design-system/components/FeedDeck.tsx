import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react"
import { Masthead } from "./Masthead"

type FeedDeckProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  readonly announcement?: string | undefined
  readonly children: ReactNode
  /**
   * One-clipping-per-viewport snapping for the swipe feed. Form-like surfaces
   * (onboarding, states) must scroll freely, so they opt out.
   */
  readonly snap?: boolean | undefined
  /** Ref to the scroll container, for surfaces that reposition it (onboarding). */
  readonly scrollRef?: RefObject<HTMLDivElement | null> | undefined
}

/**
 * Keeps the softened newspaper stationary behind the scrolling paper.
 * @param props - Slides, live announcement, section attributes, snap toggle.
 * @param props.snap - Whether the scroll container snaps one slide per viewport.
 * @param props.scrollRef - Receives the inner scroll container element.
 * @param props.ref - Forwarded deck section.
 * @returns The reading deck.
 */
export const FeedDeck = forwardRef<HTMLElement, FeedDeckProps>(
  function FeedDeck(
    { announcement, children, scrollRef, snap = true, ...props },
    ref,
  ) {
    return (
      <section
        {...props}
        ref={ref}
        aria-label="Academic paper feed"
        tabIndex={0}
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-paper text-ink focus:outline-none lg:bg-[url('/newsprint.webp')] lg:bg-cover lg:bg-center lg:bg-no-repeat"
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <Masthead variant="banner" />
        <div
          ref={scrollRef}
          className={`mx-auto min-h-0 w-full flex-1 overflow-y-auto overscroll-y-contain bg-paper pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:w-[min(94%,max(54vw,40rem))] lg:border-x lg:border-rule-soft ${
            snap ? "snap-y snap-mandatory" : ""
          }`}
        >
          {children}
        </div>
      </section>
    )
  },
)
