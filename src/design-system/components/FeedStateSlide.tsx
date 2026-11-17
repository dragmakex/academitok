import type { ReactNode } from "react"

type FeedStateSlideProps = {
  readonly children: ReactNode
}

/**
 * Centers a feed state in one viewport.
 * @param root0 - State slide props.
 * @param root0.children - State content.
 * @returns Full-screen state slide.
 */
export function FeedStateSlide({ children }: FeedStateSlideProps) {
  return (
    <section className="flex h-full min-h-full snap-start items-center justify-center-safe overflow-y-auto p-l">
      {children}
    </section>
  )
}
