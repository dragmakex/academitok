import { Children, forwardRef, type ReactNode, type RefObject } from "react"

type SwipePagerProps = {
  /** One entry per page; the pager wraps each in a full-width snap page. */
  readonly children: ReadonlyArray<ReactNode>
  /** Ref to the scroll container, for pages that reposition the pager. */
  readonly scrollRef?: RefObject<HTMLDivElement | null> | undefined
}

/**
 * Horizontal scroll-snap pager: one full-width page per child, swiped with a
 * finger or repositioned programmatically through `scrollRef`. Chosen over a
 * transform carousel because native scrolling keeps iOS momentum, snap
 * physics, and pointer/touch/keyboard behaviour without a gesture engine.
 *
 * @param props - Pager props.
 * @param props.children - Page contents, one per page.
 * @param props.scrollRef - Receives the inner scroll container element.
 * @param props.ref - Forwarded pager container.
 * @returns The horizontal snap pager.
 */
export const SwipePager = forwardRef<HTMLDivElement, SwipePagerProps>(
  function SwipePager({ children, scrollRef }, ref) {
    return (
      <div
        ref={scrollRef ?? ref}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {Children.toArray(children).map((page, index) => (
          <div
            key={`pager-page-${index}`}
            className="flex h-full w-full shrink-0 snap-center flex-col overflow-y-auto"
          >
            {page}
          </div>
        ))}
      </div>
    )
  },
)
