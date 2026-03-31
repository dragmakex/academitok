# Design System Patterns

## Page layout

Use a calm, enterprise-style hierarchy:

```tsx
<PageShell>
  <PageContent>
    <Stack gap="xl">
      <PageHeader title="…" description="…" />
      {/* page sections */}
    </Stack>
  </PageContent>
</PageShell>
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

## Forms

Use design-system field components:

```tsx
<Inline gap="s" align="start" wrap>
  <TextField label="Title" value={title} onChange={…} />
  <Button type="submit">Add</Button>
</Inline>
```

## Empty, loading, and error states

Every major data surface must define all three states.
Use dedicated components:

```tsx
<EmptyState title="No items" description="Add one to get started." />
<ErrorState title="Failed" description="…" actionLabel="Retry" onAction={retry} />
<Text tone="muted">Loading…</Text>
```

## Destructive actions

Destructive actions should:

- Be visually distinct but not dominant (`Button variant="danger"`)
- Require clear labeling
- Remain available in consistent locations

## Todo item layout

```tsx
<Card tone={hasError ? "danger" : "default"}>
  <Stack gap="m">
    <TodoRow>
      <TodoMain>
        <Checkbox … />
      </TodoMain>
      <TodoActions>
        <Button variant="ghost">Edit</Button>
        <Button variant="danger">Delete</Button>
      </TodoActions>
    </TodoRow>
  </Stack>
</Card>
```
