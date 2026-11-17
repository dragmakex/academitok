import { Card } from "@/design-system/components/Card"
import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"

type StatCardProps = {
  readonly label: string
  readonly value: number | string
  readonly helper?: string | undefined
  readonly tone?: "default" | "accent" | "danger" | undefined
}

/**
 * Renders one ruled readout row: label on the left, figure on the right.
 *
 * @param props - Stat card props.
 * @param props.label - Metric label.
 * @param props.value - Metric value.
 * @param props.helper - Optional helper copy.
 * @param props.tone - Surface tone role.
 * @returns A summary card.
 */
export function StatCard(
  { helper, label, tone = "default", value }: StatCardProps,
) {
  return (
    <Card tone={tone === "default" ? "subtle" : tone}>
      <div className="flex items-baseline justify-between gap-s">
        <Text tone="label" as="span">
          {label}
        </Text>
        <Heading as="h3" tone="display">
          {value}
        </Heading>
      </div>
      {helper && (
        <div className="mt-2xs">
          <Text tone="caption">
            {helper}
          </Text>
        </div>
      )}
    </Card>
  )
}
