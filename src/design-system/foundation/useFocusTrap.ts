import { useEffect, useRef } from "react"

const focusableSelector =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

type FocusTrapOptions = {
  readonly active: boolean
  readonly onClose: () => void
}

/**
 * Keeps keyboard focus inside an open panel and restores it on close.
 * @param options - Trap options.
 * @param options.active - Whether the panel is open.
 * @param options.onClose - Called when Escape is pressed.
 * @returns Ref to attach to the panel element.
 */
export function useFocusTrap<T extends HTMLElement>(
  { active, onClose }: FocusTrapOptions,
) {
  const ref = useRef<T | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const container = ref.current
    if (!active || container === null) {
      return
    }

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const focusable = () => [...container
      .querySelectorAll<HTMLElement>(focusableSelector)]
    focusable()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== "Tab") {
        return
      }

      const elements = focusable()
      const first = elements[0]
      const last = elements.at(-1)
      if (first === undefined || last === undefined) {
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      previousFocus?.focus()
    }
  }, [active])

  return ref
}
