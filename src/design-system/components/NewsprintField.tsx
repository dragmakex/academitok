/**
 * The newsprint the app is printed on.
 *
 * One page, never a pattern: the whole viewport sits inside a single blurred
 * broadsheet, so swiping papers feels like moving a clipping across a page
 * rather than scrolling a wall of newspapers.
 */

type NewsprintFieldProps = {
  readonly variant: "band" | "page"
}

const fieldClass = {
  band:
    "pointer-events-none absolute inset-0 bg-[url('/newsprint.svg')] bg-cover bg-center bg-no-repeat opacity-60 blur-[2px]",
  page:
    "pointer-events-none absolute inset-0 bg-[url('/newsprint.svg')] bg-cover bg-center bg-no-repeat opacity-70 blur-[4px] scale-105",
} as const

/**
 * Renders one blurred newsprint field.
 *
 * @param props - Field props.
 * @param props.variant - Full-page desk field or the nameplate band.
 * @returns A decorative, unfocusable texture layer.
 */
export function NewsprintField({ variant }: NewsprintFieldProps) {
  return <div aria-hidden="true" className={fieldClass[variant]} />
}
