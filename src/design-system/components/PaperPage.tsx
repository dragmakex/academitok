import { CopyBlock } from "./CopyBlock"
import { LinkButton } from "./LinkButton"
import { Masthead } from "./Masthead"

type PaperPageProps = {
  readonly abstract: string
  readonly accessLabel: string
  readonly authors: ReadonlyArray<string>
  readonly bibtexHref: string
  readonly citation: string
  readonly citations: number
  readonly externalUrl: string | undefined
  readonly hiddenByReaders: number
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
  "m-0 font-label text-[0.62rem] font-bold uppercase tracking-[0.16em] text-ink-muted"
const factValueClass = "m-0 font-body text-[0.9rem] leading-[1.3]"
const linkClass =
  "font-label text-[0.64rem] font-bold uppercase tracking-[0.14em] text-ink underline underline-offset-4 hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"

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
      <Masthead
        left="Clipping"
        right="Metadata only"
        section="The archive"
      />

      <div className="mt-l grid gap-l md:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="min-w-0">
          <p className="m-0 border-y border-rule-soft py-2xs text-center font-label text-[0.66rem] font-bold uppercase tracking-[0.22em] text-ink">
            {props.topics.join(" / ") || "Research"}
          </p>
          <h1 className="mt-s m-0 text-center font-display text-[clamp(2rem,4.6vw,3.1rem)] leading-[1.03] font-bold tracking-[-0.025em]">
            {props.title}
          </h1>
          <p className="mt-s m-0 text-center font-body text-[0.95rem] font-bold">
            By {props.authors.join(", ")}
          </p>
          <div className="mx-auto mt-s h-px w-16 bg-ink" />
          <p className="mt-s max-w-[62ch] mx-auto hyphens-auto text-justify font-body text-[1.0625rem] leading-[1.45]">
            {props.abstract}
          </p>
        </div>

        <aside className="border-t-2 border-ink pt-s md:border-t-0 md:border-l md:border-l-rule-soft md:pl-m">
          <p className="m-0 font-label text-[0.62rem] font-bold uppercase tracking-[0.16em]">
            The record
          </p>
          <dl className="mt-xs m-0 grid grid-cols-2 gap-x-s gap-y-xs">
            <div>
              <dt className={factLabelClass}>
                Filed under
              </dt>
              <dd className={factValueClass}>
                {props.topics.join(", ") || "Research"}
              </dd>
            </div>
            <div>
              <dt className={factLabelClass}>
                Access
              </dt>
              <dd className={factValueClass}>
                {props.accessLabel}
              </dd>
            </div>
            <div>
              <dt className={factLabelClass}>
                Source
              </dt>
              <dd className={factValueClass}>
                {props.siteLabel}
              </dd>
            </div>
            <div>
              <dt className={factLabelClass}>
                Citations
              </dt>
              <dd className={factValueClass}>
                {props.citations}
              </dd>
            </div>
            {props.savedByReaders === 0 ? null : (
              <div>
                <dt className={factLabelClass}>
                  Filed by
                </dt>
                <dd className={factValueClass}>
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
                <dd className={factValueClass}>
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
                <dd className={factValueClass}>
                  {`${props.likedByReaders} ${
                    props.likedByReaders === 1 ? "reader" : "readers"
                  }`}
                </dd>
              </div>
            )}
            {props.hiddenByReaders === 0 ? null : (
              <div>
                <dt className={factLabelClass}>
                  Hidden by
                </dt>
                <dd className={factValueClass}>
                  {`${props.hiddenByReaders} ${
                    props.hiddenByReaders === 1 ? "reader" : "readers"
                  }`}
                </dd>
              </div>
            )}
            <div>
              <dt className={factLabelClass}>
                Abstract read time
              </dt>
              <dd className={factValueClass}>
                {props.readMinutes} min
              </dd>
            </div>
            <div>
              <dt className={factLabelClass}>
                Year
              </dt>
              <dd className={factValueClass}>
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
                variant="secondary"
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
                  className={linkClass}
                  href={props.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source
                </a>
              )}
            <a className={linkClass} href="/">
              Back to the edition
            </a>
          </div>
        </aside>
      </div>
    </article>
  )
}
