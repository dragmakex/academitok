import { Stack } from "@/design-system/primitives/Stack"
import type { InputHTMLAttributes, ReactNode } from "react"
import { Text } from "./Text"

type CheckboxProps =
  & Omit<InputHTMLAttributes<HTMLInputElement>, "className">
  & {
    readonly label: ReactNode
    readonly hint?: ReactNode | undefined
  }

/**
 * Renders a semantic checkbox control.
 *
 * @param props - Checkbox props.
 * @param props.hint - Optional helper text.
 * @param props.label - Checkbox label content.
 * @returns A styled checkbox field.
 */
export function Checkbox({ hint, label, ...props }: CheckboxProps) {
  return (
    <label className="inline-flex items-start gap-s text-text-primary">
      <input
        {...props}
        type="checkbox"
        className="mt-[0.2rem] w-[1.1rem] h-[1.1rem] accent-accent-solid"
      />
      <Stack gap="2xs">
        <Text as="span">
          {label}
        </Text>
        {hint && (
          <Text as="span" tone="caption">
            {hint}
          </Text>
        )}
      </Stack>
    </label>
  )
}
