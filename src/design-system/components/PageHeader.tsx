import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"
import { Inline } from "@/design-system/primitives/Inline"
import { Stack } from "@/design-system/primitives/Stack"
import type { ReactNode } from "react"

type PageHeaderProps = {
  readonly title: string
  readonly description: string
  readonly actions?: ReactNode | undefined
}

/**
 * Renders the standard page header pattern for application surfaces.
 *
 * @param props - Page header props.
 * @param props.title - Page title.
 * @param props.description - Supporting page description.
 * @param props.actions - Optional action area.
 * @returns A semantic page header.
 */
export function PageHeader({ actions, description, title }: PageHeaderProps) {
  return (
    <Inline align="between" wrap>
      <Stack gap="2xs">
        <Heading as="h1" tone="page">
          {title}
        </Heading>
        <Text tone="muted">
          {description}
        </Text>
      </Stack>
      {actions && (
        <div>
          {actions}
        </div>
      )}
    </Inline>
  )
}
