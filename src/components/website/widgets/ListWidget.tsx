import { WidgetCard, EmptyLine } from "./WidgetCard";

export function ListWidget({
  title,
  items,
  render,
  empty = "No data yet.",
}: {
  title: string;
  items: Array<Record<string, unknown>>;
  render: (item: Record<string, unknown>) => React.ReactNode;
  empty?: string;
}) {
  if (!items?.length) {
    return (
      <WidgetCard title={title}>
        <EmptyLine>{empty}</EmptyLine>
      </WidgetCard>
    );
  }
  return (
    <WidgetCard title={title}>
      <ul className="divide-y divide-border">
        {items.slice(0, 6).map((item, i) => (
          <li key={(item.id as string) ?? i} className="py-2">
            {render(item)}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
