# Structure

```mermaid
graph TD
    App[Route /] --> Hydration[HydrationBoundary]
    Hydration --> Registry[RegistryProvider]
    Hydration --> AppUI[App]
    AppUI --> CreateForm[CreateTodoForm]
    AppUI --> TodoList[TodoList]
    TodoList --> TodosAtom[todosAtom]
    TodosAtom --> RemoteAtom[remoteAtom (serializable)]
    RemoteAtom --> ApiClient[ApiClient]
```
