// Pure queue reordering for the team queue (drag, up/down, priority change). Isomorphic.
import { PRIORITIES, type Priority } from "@/lib/jobs/priority";

type Item = { id: string; priority: Priority };

/** The queue as priority groups, most urgent first, keeping each group's order. */
export function groupQueue<T extends Item>(items: T[]): { priority: Priority; items: T[] }[] {
  return PRIORITIES.map((priority) => ({ priority, items: items.filter((i) => i.priority === priority) }));
}

/**
 * Move `id` into the `priority` group at `index` (clamped; Infinity = the end), and return the whole queue
 * in display order. Unknown ids leave the queue unchanged.
 */
export function moveInQueue<T extends Item>(items: T[], id: string, priority: Priority, index: number): T[] {
  const moving = items.find((i) => i.id === id);
  if (!moving) return items;
  const groups = groupQueue(items.filter((i) => i.id !== id));
  const target = groups.find((g) => g.priority === priority)!;
  const at = Math.max(0, Math.min(index, target.items.length));
  target.items.splice(at, 0, { ...moving, priority });
  return groups.flatMap((g) => g.items);
}

/**
 * Positions for the top of a queue after a reorder. `items` is the visible top of the queue in display
 * order; `floors` is, per priority, the smallest position among that group's jobs below the visible part.
 * Each group's visible jobs are numbered upward so they all stay above those hidden jobs.
 */
export function assignPlaces<T extends Item>(items: T[], floors: Partial<Record<Priority, number>>): (T & { place: number })[] {
  return groupQueue(items).flatMap((g) => {
    const floor = floors[g.priority];
    return g.items.map((item, i) => ({ ...item, place: floor === undefined ? i + 1 : floor - (g.items.length - i) }));
  });
}
