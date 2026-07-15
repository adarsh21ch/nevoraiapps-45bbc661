import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

/**
 * Reusable virtualized list. Renders only rows in view + a small overscan
 * buffer, keeping DOM node count constant regardless of dataset size.
 *
 * Intended for long homogeneous lists (attendance rows, students, matches,
 * ball events). Not for grids with heavy per-row realtime; consumer stays
 * responsible for search/filter/selection state — this only virtualizes
 * the render.
 */
export function VirtualList<T>({
  items,
  estimateSize = 72,
  overscan = 8,
  className,
  containerClassName,
  renderItem,
  getKey,
  emptyState,
}: {
  items: T[];
  /** Estimated pixel height per row. Rows are auto-measured after mount. */
  estimateSize?: number;
  /** Rows to render beyond the visible window. */
  overscan?: number;
  /** Class for the scroll container (must have a bounded height). */
  className?: string;
  /** Class applied to each row wrapper. */
  containerClassName?: string;
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string;
  emptyState?: ReactNode;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (i) => getKey(items[i], i),
  });

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className={cn("overflow-auto", className)} style={{ contain: "strict" }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((v) => (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            className={containerClassName}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${v.start}px)`,
            }}
          >
            {renderItem(items[v.index], v.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
