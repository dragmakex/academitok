import { cx } from "@/design-system/foundation/classes"
import type { ReactNode } from "react"

const metaClass =
  "font-label text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-muted"

type MastheadProps = {
  readonly left?: ReactNode | undefined
  readonly right?: ReactNode | undefined
  readonly section?: ReactNode | undefined
  readonly trailing?: ReactNode | undefined
  /** `banner` is the narrow strip that stays above a full-screen surface. */
  readonly variant?: "page" | "banner" | undefined
}

/**
 * Renders the nameplate every printed page shares: a folio line over a centred
 * blackletter wordmark, closed by a heavy rule.
 *
 * In the `banner` variant it keeps only the wordmark, so it can hold the top of
 * a swipe deck without eating a slide's worth of space.
 *
 * @param props - Nameplate props.
 * @param props.left - Folio line, left cell (edition, number).
 * @param props.right - Folio line, right cell (position, notice).
 * @param props.section - Section slug printed left of the wordmark.
 * @param props.trailing - Optional control printed right of the wordmark.
 * @param props.variant - Full nameplate or the persistent banner strip.
 * @returns A newspaper nameplate band.
 */
export function Masthead(
  { left, right, section, trailing, variant = "page" }: MastheadProps,
) {
  if (variant === "banner") {
    return (
      <header className="shrink-0 bg-paper px-[clamp(0.65rem,2vw,4rem)] pt-[max(0.5rem,env(safe-area-inset-top))] text-center">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-s pb-xs">
          <span className="hidden w-fit border border-ink px-m py-xs font-body text-[clamp(0.8rem,1.2vw,1.6rem)] font-bold leading-tight sm:block">
            The papers<br />worth reading
          </span>
          <a
            className="col-start-2 block font-masthead text-[clamp(3rem,min(10vw,11vh),10rem)] leading-none tracking-tight text-ink no-underline"
            href="/"
          >
            AcademiTok
          </a>
          <span className="hidden justify-self-end font-label text-[clamp(0.72rem,1.1vw,1.4rem)] font-bold uppercase sm:block">
            Research edition
          </span>
        </div>
        <div className="flex justify-between border-y border-rule py-2xs font-label text-[clamp(0.65rem,0.85vw,1.15rem)] font-bold uppercase tracking-wider">
          <span>
            Science &amp; scholarship
          </span>
          <span>
            Front page
          </span>
        </div>
        <p className="my-xs font-display text-[clamp(1.8rem,min(6.8vw,8vh),8rem)] font-bold uppercase leading-none tracking-tight">
          The Research Dispatch
        </p>
        <p className="mx-auto mb-s w-fit border-t border-rule px-m pt-2xs font-display text-[clamp(1rem,2.3vw,3rem)] italic leading-none">
          Papers from across the disciplines
        </p>
      </header>
    )
  }

  return (
    <header className="border-b-2 border-ink px-[clamp(1rem,4vw,2.5rem)] pt-[max(0.75rem,env(safe-area-inset-top))] pb-xs">
      <div className="flex items-baseline justify-between gap-m border-b border-rule-soft pb-2xs">
        <span className={metaClass}>
          {left}
        </span>
        <span className={metaClass}>
          {right}
        </span>
      </div>
      <div className="mt-2xs grid grid-cols-3 items-end gap-m">
        <span className={metaClass}>
          {section}
        </span>
        <a
          className="justify-self-center font-masthead text-[clamp(2.3rem,7vw,4.6rem)] leading-[0.8] tracking-[-0.03em] text-ink no-underline hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ink"
          href="/"
        >
          AcademiTok
        </a>
        <span className={cx(metaClass, "justify-self-end")}>
          {trailing}
        </span>
      </div>
    </header>
  )
}
