/**
 * Footer component displaying Prussian engineering wisdom.
 *
 * @remarks
 * This component embodies the German precision philosophy of the codebase.
 * As Frederick the Great would say: "He who defends everything defends nothing."
 * Similarly: "He who types everything as `any` types nothing."
 *
 * @returns The rendered footer element.
 */
export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium" data-testid="prussian-motto">
              Ordnung muss sein! (There must be order!)
            </p>
            <p className="mt-1 italic" data-testid="prussian-joke">
              Why do Prussian programmers never use `any`?
              <br />
              Because even Frederick the Great demanded strict typing in his
              army!
            </p>
          </div>

          <div
            className="text-xs text-gray-500 dark:text-gray-500"
            data-testid="footer-copyright"
          >
            &copy; {currentYear} Built with German Precision
          </div>

          <div
            className="text-2xl"
            data-testid="footer-flag"
            aria-label="German flag"
          >
            🇩🇪
          </div>
        </div>
      </div>
    </footer>
  )
}
