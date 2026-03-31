import { useAtomRefresh } from "@effect/atom-react"
import { todoGroupsAtom, todosAtom, todoStatsAtom } from "./atoms"

/**
 * Returns a stable callback that refreshes all dashboard read models.
 *
 * @returns A callback that refreshes todos, stats, and groups.
 */
export function useRefreshDashboard() {
  const refreshTodos = useAtomRefresh(todosAtom)
  const refreshStats = useAtomRefresh(todoStatsAtom)
  const refreshGroups = useAtomRefresh(todoGroupsAtom)

  return () => {
    refreshTodos()
    refreshStats()
    refreshGroups()
  }
}
