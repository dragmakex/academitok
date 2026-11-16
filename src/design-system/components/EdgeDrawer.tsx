import { Button } from "@/design-system/components/Button"
import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"
import { Stack } from "@/design-system/primitives/Stack"
import { X } from "lucide-react"
import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

type EdgeDrawerProps = {
  readonly children: ReactNode
  readonly description?: ReactNode | undefined
  readonly open: boolean
  readonly title: string
  readonly onOpenChange: (open: boolean) => void
}

const leftEdgeActivationWidth = 36
const swipeDistance = 72

/**
 * Renders a focus-trapped edge drawer.
 * @param root0 - Drawer props.
 * @param root0.children - Drawer content.
 * @param root0.description - Optional description.
 * @param root0.onOpenChange - Open-state callback.
 * @param root0.open - Whether the drawer is open.
 * @param root0.title - Accessible title.
 * @returns Edge drawer.
 */
export function EdgeDrawer(
  { children, description, onOpenChange, open, title }: EdgeDrawerProps,
) {
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const gestureOrigin = useRef<"edge" | "drawer" | null>(null)
  const drawerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open || drawerRef.current === null) {
      return
    }

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const drawer = drawerRef.current
    const focusable = () => [...drawer.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    )]
    focusable()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onOpenChange(false)
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
  }, [onOpenChange, open])

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (touch === undefined) {
        return
      }

      touchStartX.current = touch.clientX
      touchStartY.current = touch.clientY
      gestureOrigin.current = open
        ? touch.clientX <= window.innerWidth * 0.82
          ? "drawer"
          : null
        : touch.clientX <= leftEdgeActivationWidth
        ? "edge"
        : null
    }

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      const startX = touchStartX.current
      const startY = touchStartY.current
      if (
        touch === undefined
        || startX === null
        || startY === null
        || gestureOrigin.current === null
      ) {
        return
      }

      const deltaX = touch.clientX - startX
      const deltaY = Math.abs(touch.clientY - startY)
      if (deltaY > 48) {
        gestureOrigin.current = null
        return
      }

      if (gestureOrigin.current === "edge" && deltaX > swipeDistance) {
        onOpenChange(true)
        gestureOrigin.current = null
      }

      if (gestureOrigin.current === "drawer" && deltaX < -swipeDistance) {
        onOpenChange(false)
        gestureOrigin.current = null
      }
    }

    const clearGesture = () => {
      touchStartX.current = null
      touchStartY.current = null
      gestureOrigin.current = null
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", clearGesture)
    window.addEventListener("touchcancel", clearGesture)

    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", clearGesture)
      window.removeEventListener("touchcancel", clearGesture)
    }
  }, [onOpenChange, open])

  return (
    <>
      <div className="pointer-events-none fixed inset-y-0 left-0 z-30 w-9">
        <div className="absolute inset-y-[20%] left-0 flex items-center">
          <button
            type="button"
            aria-label={open ? "Close filters" : "Open filters"}
            aria-pressed={open}
            className="pointer-events-auto rounded-r-lg border border-l-0 border-border-default bg-bg-surface px-s py-m text-xs font-semibold tracking-[0.16em] uppercase shadow-sm"
            onClick={() => onOpenChange(!open)}
          >
            Desk
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 transition-opacity duration-200">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/30"
            onClick={() => onOpenChange(false)}
          />

          <aside
            ref={drawerRef}
            aria-label={title}
            aria-modal="true"
            role="dialog"
            className="absolute inset-y-0 left-0 flex w-[min(24rem,88vw)] flex-col border-r border-border-default bg-bg-canvas shadow-md"
          >
            <div className="border-b border-border-default px-l py-l">
              <div className="flex items-start justify-between gap-m">
                <Stack gap="xs">
                  <Heading as="h2" tone="section">
                    {title}
                  </Heading>
                  {description}
                </Stack>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  <X size={16} />
                  Close
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-l py-l">
              {children}
            </div>

            <div className="border-t border-border-default px-l py-m">
              <Text tone="caption">
                Swipe in from the left edge to open this desk.
              </Text>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
