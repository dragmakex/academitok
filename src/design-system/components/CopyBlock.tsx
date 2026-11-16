import { useState } from "react"

type CopyBlockProps = {
  readonly actionLabel: string
  readonly announcement: string
  readonly label: string
  readonly text: string
}

const labelClass =
  "m-0 font-label text-[0.62rem] uppercase tracking-[0.16em] text-ink-muted"

/**
 * Renders a quoted plain-text block with a clipboard control.
 * @param props - Block props.
 * @param props.actionLabel - Control text while idle.
 * @param props.announcement - Live-region message after a successful copy.
 * @param props.label - Kicker above the quoted text.
 * @param props.text - Plain text written to the clipboard.
 * @returns Quoted block, copy control and polite status region.
 */
export function CopyBlock(
  { actionLabel, announcement, label, text }: CopyBlockProps,
) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => setStatus("copied"),
      () => setStatus("failed"),
    )
  }

  return (
    <div className="border border-rule px-s py-m">
      <p className={labelClass}>
        {label}
      </p>
      <p className="mt-xs m-0 whitespace-pre-line break-words font-body text-[0.82rem] leading-[1.45]">
        {text}
      </p>
      <button
        className="mt-s min-h-11 w-full border border-stamp bg-transparent px-s py-xs font-label text-[0.62rem] uppercase tracking-[0.14em] text-stamp cursor-pointer hover:bg-stamp hover:text-paper disabled:cursor-not-allowed disabled:border-rule disabled:text-ink-muted disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-focus-ring"
        type="button"
        disabled={text === ""}
        onClick={copy}
      >
        {status === "copied"
          ? "Copied"
          : status === "failed"
          ? "Copy failed"
          : actionLabel}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status === "copied"
          ? announcement
          : status === "failed"
          ? "Could not copy to the clipboard"
          : ""}
      </span>
    </div>
  )
}
