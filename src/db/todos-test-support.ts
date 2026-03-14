import type { TodoSeed } from "@/db/todos-repository"
import { TodosService } from "@/routes/api/-lib/todos-service"

export const todoSeeds = {
  empty: [] satisfies TodoSeed,
  singleCompleted: [
    {
      title: "Seeded completed todo",
      completed: true,
    },
  ] satisfies TodoSeed,
  mixedState: [
    {
      title: "Alpha todo",
      completed: false,
    },
    {
      title: "Bravo done",
      completed: true,
    },
    {
      title: "Charlie todo",
      completed: false,
    },
  ] satisfies TodoSeed,
} as const

export type TodoSeedName = keyof typeof todoSeeds

export const makeTodosServiceTestLayer = (
  seedName: TodoSeedName = "empty",
) => TodosService.layerFromSeed(todoSeeds[seedName])
