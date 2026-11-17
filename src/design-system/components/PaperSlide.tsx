import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  EyeOff,
  Heart,
  Link2,
} from "lucide-react"
import { forwardRef } from "react"

const railButtonClass =
  "flex min-h-12 w-full flex-col items-center justify-center gap-2xs border-0 border-t border-rule bg-transparent px-2xs py-xs font-label text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted cursor-pointer first:border-t-0 hover:text-stamp focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-[-2px] aria-pressed:text-stamp"

type ActionHandlers = {
  readonly onLike: () => void
  readonly onBookmark: () => void
  readonly onHide: () => void
  readonly onOpenSite: () => void
  readonly onPrevious: () => void
  readonly onNext: () => void
}

type PaperMeta = {
  readonly id: string
  readonly title: string
  readonly authors: string
  readonly venue: string
  readonly year: number
  readonly abstract: string
  readonly accessLabel: string
  readonly siteLabel: string
  readonly citations: number
  readonly readMinutes: number
  readonly topics: ReadonlyArray<string>
  readonly externalUrl: string | undefined
}

type DeckPaperSlideProps = PaperMeta & {
  readonly variant?: "deck" | undefined
  readonly origin: "pool" | "live" | "seed"
  readonly pinned: boolean
  readonly alsoKeptBy?: number | undefined
  readonly alsoLikedBy?: number | undefined
  readonly again: boolean
  readonly rationale: ReadonlyArray<string>
  readonly liked: boolean
  readonly bookmarked: boolean
  readonly actions: ActionHandlers
  readonly position: number
  readonly total: number
  readonly skeleton: boolean
}

type CompactPaperSlideProps = PaperMeta & {
  readonly variant: "compact"
  readonly filedByOthers?: number | undefined
  readonly onUnsave: () => void
}

type PaperSlideProps = DeckPaperSlideProps | CompactPaperSlideProps

export const PaperSlide = forwardRef<HTMLElement, PaperSlideProps>(
  function PaperSlide(props, ref) {
    const headlineId = `paper-headline-${
      props.id.replaceAll(/[^a-zA-Z0-9_-]/g, "-")
    }`

    if (props.variant === "compact") {
      const {
        abstract,
        accessLabel,
        authors,
        citations,
        externalUrl,
        filedByOthers,
        id,
        onUnsave,
        readMinutes,
        siteLabel,
        title,
        topics,
        venue,
        year,
      } = props

      return (
        <article
          ref={ref}
          aria-labelledby={headlineId}
          className="border-t border-rule bg-paper px-[clamp(1.25rem,5vw,3rem)] py-m text-ink first:border-t-0"
        >
          <p className="m-0 font-label text-[0.68rem] uppercase tracking-[0.18em] text-stamp">
            {topics[0] ?? "Research"}
          </p>
          <h2
            id={headlineId}
            className="mt-xs m-0 font-display text-[clamp(1.35rem,3vw,1.85rem)] leading-[1.08] font-bold tracking-[-0.02em]"
          >
            <a
              className="text-ink no-underline focus-visible:outline-2 focus-visible:outline-focus-ring"
              href={`/paper/${encodeURIComponent(id)}`}
            >
              {title}
            </a>
          </h2>
          <p className="mt-s m-0 line-clamp-2 max-w-[60ch] font-body text-[0.95rem] leading-[1.45]">
            {abstract}
          </p>
          <div className="mt-s flex flex-wrap items-center justify-between gap-s border-t border-rule pt-xs">
            <p className="m-0 font-body text-[0.8rem] text-ink-muted">
              {authors} · {venue} · {year}
            </p>
            <div className="flex flex-wrap items-center gap-m">
              <span className="font-label text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted">
                {siteLabel} · {citations} citations · {readMinutes} min ·{" "}
                {accessLabel}
              </span>
              {filedByOthers === undefined || filedByOthers === 0
                ? null
                : (
                  <span className="font-label text-[0.62rem] uppercase tracking-[0.12em] text-stamp">
                    {`Also kept by ${filedByOthers} ${
                      filedByOthers === 1 ? "reader" : "readers"
                    }`}
                  </span>
                )}
              {externalUrl === undefined
                ? null
                : (
                  <a
                    className="font-label text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted hover:text-stamp focus-visible:outline-2 focus-visible:outline-focus-ring"
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open source for ${title} in a new tab`}
                  >
                    Source
                  </a>
                )}
              <button
                className="border-0 bg-transparent p-0 font-label text-[0.62rem] uppercase tracking-[0.12em] text-stamp cursor-pointer focus-visible:outline-2 focus-visible:outline-focus-ring aria-pressed:text-ink-muted"
                type="button"
                onClick={onUnsave}
                aria-label={`Remove ${title} from saved`}
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      )
    }

    const {
      abstract,
      accessLabel,
      actions,
      again,
      alsoKeptBy,
      alsoLikedBy,
      authors,
      bookmarked,
      citations,
      externalUrl,
      id,
      liked,
      position,
      rationale,
      readMinutes,
      origin,
      pinned,
      siteLabel,
      skeleton,
      title,
      topics,
      total,
      venue,
      year,
    } = props

    return (
      <article
        ref={ref}
        aria-labelledby={headlineId}
        className="grid h-[100dvh] min-h-[100dvh] snap-start snap-always grid-cols-[minmax(0,1fr)_4.25rem] overflow-hidden bg-paper text-ink"
        onDoubleClick={actions.onLike}
      >
        {skeleton
          ? (
            <div className="col-span-2 flex h-full items-center justify-center px-l font-label text-xs uppercase tracking-[0.18em] text-ink-muted">
              Setting the next clipping…
            </div>
          )
          : (
            <>
              <div className="flex min-w-0 flex-col px-[clamp(1.25rem,5vw,4rem)] py-[clamp(1rem,3vh,2rem)] pt-[max(clamp(1rem,3vh,2rem),env(safe-area-inset-top))]">
                <header className="flex items-center justify-between gap-m border-b border-ink pb-xs font-label text-[0.62rem] uppercase tracking-[0.16em] text-ink-muted sm:text-[0.68rem]">
                  <strong className="text-ink">
                    AcademiTok
                  </strong>
                  <span>
                    {origin === "seed" ? "Offline Edition" : "Evening Edition"}
                    {" · No. "}
                    {String(position).padStart(3, "0")}
                  </span>
                  {pinned
                    ? (
                      <a
                        className="font-label text-[0.62rem] uppercase tracking-[0.16em] text-stamp hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring sm:text-[0.68rem]"
                        href="/"
                      >
                        Your edition
                      </a>
                    )
                    : null}
                </header>

                <div className="mx-auto flex w-full max-w-[62ch] flex-1 flex-col justify-center py-[clamp(1rem,4vh,3rem)]">
                  <p className="mb-m font-label text-[0.72rem] uppercase tracking-[0.18em] text-stamp">
                    {topics[0] ?? "Research"}
                    {again ? " · Again" : null}
                  </p>
                  <h2
                    id={headlineId}
                    className="line-clamp-2 overflow-wrap-anywhere m-0 font-display text-[clamp(2rem,7vw,3.4rem)] leading-[1.02] font-bold tracking-[-0.035em]"
                  >
                    {title}
                  </h2>
                  <p className="mt-l line-clamp-5 max-w-[60ch] font-body text-[clamp(1rem,2.4vw,1.125rem)] leading-[1.45] text-ink first-letter:float-left first-letter:mr-xs first-letter:font-display first-letter:text-[3.2rem] first-letter:leading-[0.8] first-letter:text-stamp">
                    {abstract}
                  </p>

                  <div className="mt-l border-t border-rule pt-m">
                    <p className="m-0 font-body text-[0.85rem] font-semibold">
                      {authors}
                    </p>
                    <p className="mt-xs font-label text-[0.68rem] uppercase tracking-[0.08em] text-ink-muted">
                      {venue} · {year} · {siteLabel} · {citations} citations ·
                      {" "}
                      {readMinutes} min
                    </p>
                    {alsoKeptBy === undefined || alsoKeptBy === 0
                      ? null
                      : (
                        <p className="mt-xs font-label text-[0.68rem] uppercase tracking-[0.08em] text-stamp">
                          {`Also kept by ${alsoKeptBy} ${
                            alsoKeptBy === 1 ? "reader" : "readers"
                          }`}
                        </p>
                      )}
                    {alsoLikedBy === undefined || alsoLikedBy === 0
                      ? null
                      : (
                        <p className="mt-xs font-label text-[0.68rem] uppercase tracking-[0.08em] text-stamp">
                          {`Also liked by ${alsoLikedBy} ${
                            alsoLikedBy === 1 ? "reader" : "readers"
                          }`}
                        </p>
                      )}
                  </div>

                  <div className="mt-l flex items-end justify-between gap-m">
                    <div className="max-w-[25rem] -rotate-1 border-2 border-stamp px-m py-s text-stamp">
                      <p className="m-0 font-label text-[0.62rem] font-bold uppercase tracking-[0.16em]">
                        Why this
                      </p>
                      <p className="mt-2xs font-body text-[0.85rem] leading-tight">
                        {rationale.join(" · ")}
                      </p>
                    </div>
                    <span className="border border-rule px-xs py-2xs font-label text-[0.62rem] uppercase tracking-[0.12em] text-ink-muted">
                      {accessLabel}
                    </span>
                  </div>
                </div>

                <footer className="flex items-center justify-between border-t border-ink pt-xs pb-[env(safe-area-inset-bottom)] font-label text-[0.62rem] uppercase tracking-[0.14em] text-ink-muted">
                  <span>
                    {position} of {total}
                  </span>
                  <span>
                    Metadata only · Source opens separately
                  </span>
                </footer>
              </div>

              <div
                role="group"
                aria-label="Paper actions"
                className="flex h-full flex-col border-l border-rule bg-paper-deep pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
              >
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onPrevious}
                  aria-label="Previous paper"
                >
                  <ChevronUp size={18} aria-hidden="true" /> Prev
                </button>
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onNext}
                  aria-label="Next paper"
                >
                  <ChevronDown size={18} aria-hidden="true" /> Next
                </button>
                <div className="flex-1" />
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onLike}
                  aria-label={liked ? "Unlike paper" : "Like paper"}
                  aria-pressed={liked}
                >
                  <Heart
                    size={18}
                    fill={liked ? "currentColor" : "none"}
                    aria-hidden="true"
                  />{" "}
                  Like
                </button>
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onBookmark}
                  aria-label={bookmarked ? "Remove saved paper" : "Save paper"}
                  aria-pressed={bookmarked}
                >
                  <Bookmark
                    size={18}
                    fill={bookmarked ? "currentColor" : "none"}
                    aria-hidden="true"
                  />{" "}
                  Save
                </button>
                <button
                  className={railButtonClass}
                  type="button"
                  onClick={actions.onHide}
                  aria-label="Hide paper"
                >
                  <EyeOff size={18} aria-hidden="true" /> Hide
                </button>
                <a
                  className={railButtonClass}
                  href={`/paper/${encodeURIComponent(id)}`}
                  aria-label="Open the permalink page for this paper"
                >
                  <Link2 size={18} aria-hidden="true" /> Link
                </a>
                {externalUrl === undefined
                  ? null
                  : (
                    <a
                      className={railButtonClass}
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={actions.onOpenSite}
                      aria-label="Open paper source in a new tab"
                    >
                      <ExternalLink size={18} aria-hidden="true" /> Open
                    </a>
                  )}
              </div>
            </>
          )}
      </article>
    )
  },
)
