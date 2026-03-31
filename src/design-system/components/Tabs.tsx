import { cx } from "@/design-system/foundation/classes"
import type { ReactNode } from "react"
import { Badge } from "./Badge"

type TabItem<T extends string> = {
  readonly key: T
  readonly label: string
  readonly count?: number | undefined
}

type TabsProps<T extends string> = {
  readonly activeTab: T
  readonly items: ReadonlyArray<TabItem<T>>
  readonly onChange: (nextTab: T) => void
}

const tabBase =
  "inline-flex items-center gap-xs min-h-10 px-m border border-transparent rounded-md bg-transparent text-text-secondary cursor-pointer"
const tabActive = "border-accent-wash bg-bg-surface text-text-primary shadow-sm"

/**
 * Semantic tab list with ARIA roles.
 *
 * Renders a `role="tablist"` container with `role="tab"` children.
 * Pair with `TabPanel` for the corresponding content.
 *
 * @param props - Tabs props.
 * @param props.activeTab - Currently active tab key.
 * @param props.items - Available tab items.
 * @param props.onChange - Selection callback.
 * @returns A semantic tab list.
 */
export function Tabs<T extends string>(
  { activeTab, items, onChange }: TabsProps<T>,
) {
  return (
    <div
      role="tablist"
      className="p-xs border border-border-default rounded-lg bg-bg-subtle flex flex-wrap gap-xs"
    >
      {items.map((item) => {
        const active = item.key === activeTab
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={cx(tabBase, active && tabActive)}
            onClick={() => onChange(item.key)}
          >
            <span>
              {item.label}
            </span>
            {typeof item.count === "number" && (
              <Badge tone={active ? "accent" : "neutral"}>
                {item
                  .count}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Semantic tab panel wrapper.
 *
 * @param props - Panel props.
 * @param props.children - Panel content.
 * @returns A semantic tab panel.
 */
export function TabPanel({ children }: { readonly children: ReactNode }) {
  return (
    <div role="tabpanel">
      {children}
    </div>
  )
}
