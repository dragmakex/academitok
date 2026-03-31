import { Button } from "@/design-system/components/Button"
import { Card } from "@/design-system/components/Card"
import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"
import { Stack } from "@/design-system/primitives/Stack"

type ErrorStateProps = {
  readonly title: string
  readonly description: string
  readonly actionLabel: string
  readonly onAction: () => void
}

/**
 * Renders the standard error-state pattern.
 *
 * @param props - Error-state props.
 * @param props.title - Error title.
 * @param props.description - Supporting error text.
 * @param props.actionLabel - Recovery action label.
 * @param props.onAction - Recovery action handler.
 * @returns An error-state surface.
 */
export function ErrorState(
  { actionLabel, description, onAction, title }: ErrorStateProps,
) {
  return (
    <Card tone="danger">
      <div className="p-xl">
        <Stack gap="s" align="center">
          <Heading as="h2" tone="section">
            {title}
          </Heading>
          <Text tone="muted">
            <span className="text-center block">
              {description}
            </span>
          </Text>
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </Stack>
      </div>
    </Card>
  )
}
