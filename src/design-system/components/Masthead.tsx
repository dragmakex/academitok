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
      <header className="shrink-0 border-b-2 border-ink bg-paper px-[clamp(1rem,4vw,2.5rem)] pt-[max(0.35rem,env(safe-area-inset-top))] pb-[0.5rem]">
        <a
          className="mx-auto block w-fit font-masthead text-[clamp(1.4rem,3.2vw,2.2rem)] leading-[1] tracking-[-0.02em] text-ink no-underline"
          href="/"
        >
          AcademiTok
        </a>
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
