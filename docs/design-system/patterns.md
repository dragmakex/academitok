# Design System Patterns

## Composition over components

The design system provides a small set of primitives and semantic components.
Application code composes them to build any layout.

**Do not create wrapper components for common layouts.**
Instead, compose `Stack`, `Inline`, `Grid`, and `Expand` directly.

## Page layout

```tsx
<Page>
  <Stack gap="xl">
    <PageHeader title="…" description="…" />
    {/* page sections */}
  </Stack>
</Page>
```

## Cards and surfaces

```tsx
<Card>
  <Stack gap="m">
    <Heading as="h2" tone="section">
      Title
    </Heading>
    <Text tone="muted">
      Description
    </Text>
  </Stack>
</Card>
```

Surface tones: `default`, `subtle`, `accent`, `danger`.

## Two-column dashboard layout

```tsx
<Grid layout="dashboard">
  <Card>
    {/* primary content */}
  </Card>
  <Stack gap="l">
    {/* sidebar sections */}
  </Stack>
</Grid>
```

## Stats row

```tsx
<Grid layout="stats">
  <StatCard label="Total" value={42} />
  <StatCard label="Active" value={10} tone="accent" />
</Grid>
```

## Forms

```tsx
<Grid layout="form" as="form" onSubmit={handleSubmit}>
  <TextField label="Title" value={title} onChange={…} />
  <TextField label="Due date" type="date" value={date} onChange={…} />
  <Button type="submit">Add</Button>
</Grid>
```

Or for simpler inline forms:

```tsx
<Inline gap="s" align="start" wrap>
  <TextField label="Title" value={title} onChange={…} />
  <Button type="submit">Add</Button>
</Inline>
```

## Content with actions (panel title rows, group headers)

Use `Inline align="between"` — no wrapper component needed:

```tsx
<Inline align="between">
  <Stack gap="2xs">
    <Heading as="h2" tone="section">
      Title
    </Heading>
    <Text tone="muted">
      Description
    </Text>
  </Stack>
  <Button variant="secondary">
    Action
  </Button>
</Inline>
```

## Lists

Use `Stack` with the appropriate gap:

```tsx
<Stack gap="s">
  {items.map(item => <TodoItem key={item.id} todo={item} />)}
</Stack>
```

## Row with growing content and trailing actions

Use `Inline align="between"` with `Expand` for the growing child:

```tsx
<Inline align="between" wrap>
  <Expand>
    <Checkbox label={…} />
  </Expand>
  <Inline gap="xs" wrap>
    <Button variant="ghost">Edit</Button>
    <Button variant="danger">Delete</Button>
  </Inline>
</Inline>
```

## Inline metadata

```tsx
<Inline gap="xs" wrap>
  <Badge tone="success">
    Completed
  </Badge>
  <Badge tone="accent">
    Due tomorrow
  </Badge>
</Inline>
```

## Empty, loading, and error states

Every major data surface must define all three states:

```tsx
<EmptyState title="No items" description="Add one to get started." />
<ErrorState title="Failed" description="…" actionLabel="Retry" onAction={retry} />
<Text tone="muted">Loading…</Text>
```

## Sidebar stacks

Just a `Stack` with wider spacing:

```tsx
<Stack gap="l">
  <RecentActivity />
  <Card>
    …
  </Card>
</Stack>
```

## Destructive actions

- Use `Button variant="danger"` — visually distinct but not dominant
- Keep in consistent locations (trailing action area)
- Label clearly
