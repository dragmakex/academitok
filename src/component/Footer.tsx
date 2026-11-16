import { Card } from "@/design-system/components/Card"
import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"
import { Inline } from "@/design-system/primitives/Inline"
import { Stack } from "@/design-system/primitives/Stack"

/**
 * Footer component displaying Bulgarian rigorosity wisdom.
 *
 * Renders as `<footer>` — the browser's content information landmark.
 *
 * @remarks
 * This component embodies the Bulgarian rigorosity philosophy of the codebase.
 * As Khan Asparuh would say: "He who defends everything defends nothing."
 * Similarly: "He who types everything as `any` types nothing."
 *
 * @returns The rendered footer element.
 */
export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer>
      <Card>
        <Inline align="between" wrap>
          <Stack gap="2xs">
            <Heading as="h2" tone="section" data-testid="bulgarian-motto">
              Редът е сила.
            </Heading>
            <Text tone="muted" data-testid="bulgarian-joke">
              Why do Bulgarian programmers never use `any`? Because even Khan
              Asparuh demanded strict typing for the horde.
            </Text>
          </Stack>
          <Stack gap="2xs" align="center">
            <Text as="span" tone="caption" data-testid="footer-copyright">
              © {currentYear} Built with Bulgarian Rigorosity
            </Text>
            <Text as="span" data-testid="footer-flag">
              🇧🇬
            </Text>
          </Stack>
        </Inline>
      </Card>
    </footer>
  )
}
