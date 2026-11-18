import { forwardRef, type HTMLAttributes, type ReactNode } from "react"
import { Masthead } from "./Masthead"
import { NewsprintField } from "./NewsprintField"

type ColumnStory = {
  readonly id: string
  readonly title: string
  readonly summary: string
}
type FeedDeckProps = Omit<HTMLAttributes<HTMLElement>, "className"> & {
  readonly announcement?: string | undefined
  readonly stories?: ReadonlyArray<ColumnStory>
  readonly children: ReactNode
}

/**
 * Sets real abstracts alongside the interactive centre column.
 * @param props - Column contents.
 * @param props.stories - Papers from this edition.
 * @returns A decorative column excluded from the reading order.
 */
function PrintColumn(
  { stories }: { readonly stories: ReadonlyArray<ColumnStory> },
) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none hidden min-h-0 select-none overflow-hidden px-[1.4vw] md:block"
    >
      {stories.map(story => (
        <div key={story.id} className="mb-m border-t border-rule pt-xs">
          <p className="m-0 text-center font-display text-[clamp(1rem,1.75vw,2.75rem)] font-bold leading-[1.04]">
            {story
              .title}
          </p>
          <p className="mx-auto my-xs w-9 border-t border-rule" />
          <p className="m-0 text-justify font-body text-[clamp(0.72rem,1.04vw,1.5rem)] leading-[1.18] hyphens-auto">
            {story
              .summary}
          </p>
        </div>
      ))}
    </div>
  )
}

/**
 * The centre column replaces the photograph well of a printed front page.
 * @param props - Edition, slides and section attributes.
 * @param ref - Forwarded deck section.
 * @returns A stationary front page surrounding a scrolling feed.
 */
export const FeedDeck = forwardRef<HTMLElement, FeedDeckProps>(
  function FeedDeck({ announcement, children, stories = [], ...props }, ref) {
    return (
      <section
        {...props}
        ref={ref}
        aria-label="Academic paper feed"
        tabIndex={0}
        className="flex h-[100dvh] flex-col overflow-hidden bg-paper text-ink focus:outline-none"
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </div>
        <Masthead variant="banner" />
        <div className="grid min-h-0 flex-1 pl-[max(2vw,env(safe-area-inset-left))] pr-[max(2vw,env(safe-area-inset-right))] md:grid-cols-[1fr_2.3fr_1fr]">
          <PrintColumn stories={stories.slice(1, 4)} />
          <div className="min-h-0 min-w-0 snap-y snap-mandatory overflow-y-auto overscroll-y-contain md:border-x md:border-rule-soft">
            {children}
          </div>
          <PrintColumn stories={stories.slice(4, 7)} />
        </div>
        <footer
          aria-hidden="true"
          className="relative mt-xs h-[max(4vh,env(safe-area-inset-bottom))] shrink-0 overflow-hidden border-t border-rule"
        >
          <NewsprintField variant="band" />
        </footer>
      </section>
    )
  },
)
