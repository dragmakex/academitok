import { Button } from "@/design-system/components/Button"
import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"
import { useFocusTrap } from "@/design-system/foundation/useFocusTrap"
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
  const drawerRef = useFocusTrap<HTMLElement>({
    active: open,
    onClose: () => onOpenChange(false),
  })

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
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.125rem)] left-[max(0.5rem,env(safe-area-inset-left))] z-30 lg:top-1/2 lg:bottom-auto lg:left-0 lg:-translate-y-1/2">
        <button
          type="button"
          aria-label={open ? "Close filters" : "Open filters"}
          aria-pressed={open}
          className="grid size-11 cursor-pointer place-items-center border border-ink bg-paper text-ink hover:bg-ink hover:text-paper focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-[-2px] lg:w-8"
          onClick={() => onOpenChange(!open)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
          >
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-ink/25"
            onClick={() => onOpenChange(false)}
          />

          <aside
            ref={drawerRef}
            aria-label={title}
            aria-modal="true"
            role="dialog"
            className="absolute inset-y-0 left-0 flex w-[min(24rem,88vw)] flex-col border-r-2 border-ink bg-paper motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:-translate-x-full"
          >
            <div className="border-b border-rule-soft px-m py-m">
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

            <div className="flex-1 overflow-y-auto px-m py-m">
              {children}
            </div>

            <div className="border-t border-rule-soft px-m py-m">
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
