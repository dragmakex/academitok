import { forwardRef, type HTMLAttributes, type ReactNode } from "react"

type FeedDeckProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  readonly announcement?: string | undefined
  readonly children: ReactNode
}

export const FeedDeck = forwardRef<HTMLElement, FeedDeckProps>(
  function FeedDeck({ announcement, children, ...props }, ref) {
    return (
      <section
        {...props}
        ref={ref}
        aria-label="Academic paper feed"
        className="h-[100dvh] overflow-y-auto overscroll-y-contain bg-paper-deep snap-y snap-mandatory focus:outline-none"
        tabIndex={0}
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        {children}
      </section>
    )
  },
)
