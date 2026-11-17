import { CopyBlock } from "./CopyBlock"
import { LinkButton } from "./LinkButton"

type PaperPageProps = {
  readonly abstract: string
  readonly accessLabel: string
  readonly authors: ReadonlyArray<string>
  readonly bibtexHref: string
  readonly citation: string
  readonly citations: number
  readonly externalUrl: string | undefined
  readonly likedByReaders: number
  readonly openedByReaders: number
  readonly readMinutes: number
  readonly savedByReaders: number
  readonly siteLabel: string
  readonly title: string
  readonly topics: ReadonlyArray<string>
  readonly venue: string
  readonly year: number
}

const factLabelClass =
  "m-0 font-label text-[0.62rem] uppercase tracking-[0.16em] text-ink-muted"

/**
 * Renders the canonical broadsheet clipping for one paper.
 * @param props - Paper metadata and the prepared citation.
 * @param props.citation - Plain-text citation copied to the clipboard.
 * @param props.bibtexHref - Download URL for the clipping's BibTeX entry.
 * @returns Full clipping with metadata and citation.
 */
export function PaperPage(props: PaperPageProps) {
  return (
    <article className="mx-auto w-full max-w-[58rem] bg-paper text-ink">
      <header className="flex flex-wrap items-center justify-between gap-s border-b border-ink pb-xs font-label text-[0.68rem] uppercase tracking-[0.16em] text-ink-muted">
        <a
          className="text-ink no-underline hover:text-stamp focus-visible:outline-2 focus-visible:outline-focus-ring"
          href="/"
        >
          AcademiTok
        </a>
        <span>
          Canonical clipping · Metadata only
        </span>
      </header>

      <div className="mt-l grid gap-l md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <p className="m-0 font-label text-[0.72rem] uppercase tracking-[0.18em] text-stamp">
            {props.topics.join(" / ") || "Research"}
          </p>
          <h1 className="mt-s m-0 font-display text-[clamp(2rem,5vw,3.4rem)] leading-[1.02] font-bold tracking-[-0.035em]">
            {props.title}
          </h1>
          <p className="mt-m m-0 font-body text-[0.9rem] font-semibold">
            {props.authors.join(", ")}
          </p>
          <p className="mt-2xs m-0 font-label text-[0.68rem] uppercase tracking-[0.08em] text-ink-muted">
            {props.venue} · {props.year}
          </p>
          <p className="mt-l max-w-[62ch] font-body text-[1.05rem] leading-[1.5] first-letter:float-left first-letter:mr-xs first-letter:font-display first-letter:text-[3.2rem] first-letter:leading-[0.8] first-letter:text-stamp">
            {props.abstract}
          </p>
        </div>

        <aside className="border-t border-rule pt-m md:border-t-0 md:border-l md:pl-m">
          <dl className="m-0 grid grid-cols-2 gap-s">
            <div>
              <dt className={factLabelClass}>
                Filed under
              </dt>
              <dd className="m-0 font-body text-[0.85rem] leading-tight">
                {props.topics.join(", ") || "Research"}
              </dd>
            </div>
            <div>
              <dt className={factLabelClass}>
                Access
              </dt>
              <dd className="m-0 font-body text-[0.85rem] leading-tight">
                {props.accessLabel}
              </dd>
            </div>
            <div>
              <dt className={factLabelClass}>
                Source
              </dt>
              <dd className="m-0 font-body text-[0.85rem] leading-tight">
                {props.siteLabel}
              </dd>
            </div>
            <div>
              <dt className={factLabelClass}>
                Citations
              </dt>
              <dd className="m-0 font-body text-[0.85rem] leading-tight">
                {props.citations}
              </dd>
            </div>
            {props.savedByReaders === 0 ? null : (
              <div>
                <dt className={factLabelClass}>
                  Filed by
                </dt>
                <dd className="m-0 font-body text-[0.85rem] leading-tight">
                  {`${props.savedByReaders} ${
                    props.savedByReaders === 1 ? "reader" : "readers"
                  }`}
                </dd>
              </div>
            )}
            {props.openedByReaders === 0 ? null : (
              <div>
                <dt className={factLabelClass}>
                  Opened by
                </dt>
                <dd className="m-0 font-body text-[0.85rem] leading-tight">
                  {`${props.openedByReaders} ${
                    props.openedByReaders === 1 ? "reader" : "readers"
                  }`}
                </dd>
              </div>
            )}
            {props.likedByReaders === 0 ? null : (
              <div>
                <dt className={factLabelClass}>
                  Liked by
                </dt>
                <dd className="m-0 font-body text-[0.85rem] leading-tight">
                  {`${props.likedByReaders} ${
                    props.likedByReaders === 1 ? "reader" : "readers"
                  }`}
                </dd>
              </div>
            )}
            <div>
              <dt className={factLabelClass}>
                Reading time
              </dt>
              <dd className="m-0 font-body text-[0.85rem] leading-tight">
                {props.readMinutes} min
              </dd>
            </div>
            <div>
              <dt className={factLabelClass}>
                Year
              </dt>
              <dd className="m-0 font-body text-[0.85rem] leading-tight">
                {props.year}
              </dd>
            </div>
          </dl>

          <div className="mt-l">
            <CopyBlock
              actionLabel="Copy citation"
              announcement="Citation copied to the clipboard"
              label="Cite this"
              text={props.citation}
            />
            <div className="mt-s">
              <LinkButton
                href={props.bibtexHref}
                target="_self"
                variant="primary"
                download="academitok-clipping.bib"
              >
                Export BibTeX
              </LinkButton>
            </div>
          </div>

          <div className="mt-l flex flex-col gap-xs">
            {props.externalUrl === undefined
              ? null
              : (
                <a
                  className="font-label text-[0.62rem] uppercase tracking-[0.14em] text-ink underline-offset-4 hover:text-stamp focus-visible:outline-2 focus-visible:outline-focus-ring"
                  href={props.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source in a new tab
                </a>
              )}
            <a
              className="font-label text-[0.62rem] uppercase tracking-[0.14em] text-ink-muted no-underline hover:text-stamp focus-visible:outline-2 focus-visible:outline-focus-ring"
              href="/"
            >
              Back to the edition
            </a>
          </div>
        </aside>
      </div>
    </article>
  )
}
