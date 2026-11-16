import { Button } from "@/design-system/components/Button"
import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"
import { useFocusTrap } from "@/design-system/foundation/useFocusTrap"
import { Inline } from "@/design-system/primitives/Inline"
import { Stack } from "@/design-system/primitives/Stack"
import { X } from "lucide-react"

type ShortcutSheetItem = {
  readonly keys: string
  readonly description: string
}

type ShortcutSheetProps = {
  readonly items: ReadonlyArray<ShortcutSheetItem>
  readonly open: boolean
  readonly title: string
  readonly onOpenChange: (open: boolean) => void
}

/**
 * Renders a focus-trapped sheet of keyboard bindings.
 * @param root0 - Sheet props.
 * @param root0.items - Key text and description rows.
 * @param root0.onOpenChange - Open-state callback.
 * @param root0.open - Whether the sheet is open.
 * @param root0.title - Accessible title.
 * @returns Shortcut sheet.
 */
export function ShortcutSheet(
  { items, onOpenChange, open, title }: ShortcutSheetProps,
) {
  const sheetRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onClose: () => onOpenChange(false),
  })

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label={`Close ${title}`}
        className="absolute inset-0 bg-black/30"
        onClick={() => onOpenChange(false)}
      />

      <div
        ref={sheetRef}
        aria-label={title}
        aria-modal="true"
        role="dialog"
        className="absolute top-1/2 left-1/2 w-[min(30rem,92vw)] -translate-x-1/2 -translate-y-1/2 border border-border-default bg-bg-canvas px-l py-l shadow-md"
      >
        <Stack gap="m">
          <Inline align="between" gap="m">
            <Heading as="h2" tone="section">
              {title}
            </Heading>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              <X size={16} />
              Close
            </Button>
          </Inline>

          <ul className="m-0 flex list-none flex-col p-0">
            {items.map((item) => (
              <li
                key={item.description}
                className="border-t border-border-default py-s"
              >
                <Inline align="between" gap="m">
                  <Text tone="label" as="span">
                    {item.keys}
                  </Text>
                  <Text tone="muted" as="span">
                    {item.description}
                  </Text>
                </Inline>
              </li>
            ))}
          </ul>
        </Stack>
      </div>
    </div>
  )
}
