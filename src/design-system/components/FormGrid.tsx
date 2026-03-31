import type { FormHTMLAttributes, ReactNode } from "react"

type FormGridProps = Omit<FormHTMLAttributes<HTMLFormElement>, "className"> & {
  readonly children: ReactNode
}

/**
 * Responsive form layout grid for inline field groups.
 *
 * @param props - Form props.
 * @param props.children - Field and action content.
 * @returns A responsive form grid.
 */
export function FormGrid({ children, ...props }: FormGridProps) {
  return (
    <form
      {...props}
      className="grid gap-m grid-cols-1 min-[880px]:grid-cols-[minmax(0,1.8fr)_minmax(10rem,1fr)_auto]"
    >
      {children}
    </form>
  )
}
