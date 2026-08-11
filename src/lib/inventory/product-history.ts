import type {
  InventoryHistoryPoint,
  InventoryItem,
  InventorySnapshot,
  ProductHistoryEvent,
  ProductHistoryPayload,
} from "@/types/inventory";

type CurrentHistoryValue = Pick<
  InventoryItem,
  "available" | "snapshotId" | "sourceExportedAt"
>;

export function buildProductHistory(
  history: InventoryHistoryPoint[],
  current: CurrentHistoryValue | null,
  snapshots: Pick<InventorySnapshot, "id" | "filename">[],
): ProductHistoryPayload {
  const filenames = new Map(
    snapshots.map((snapshot) => [snapshot.id, snapshot.filename]),
  );
  const valuesBySnapshot = new Map<
    string,
    { snapshotId: string; date: string; available: number }
  >();

  for (const point of history) {
    valuesBySnapshot.set(point.snapshotId, {
      snapshotId: point.snapshotId,
      date: point.date,
      available: point.available,
    });
  }

  if (current?.snapshotId) {
    valuesBySnapshot.set(current.snapshotId, {
      snapshotId: current.snapshotId,
      date: current.sourceExportedAt,
      available: current.available,
    });
  }

  const chronological = [...valuesBySnapshot.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const events: ProductHistoryEvent[] = [];

  for (const [index, value] of chronological.entries()) {
    const previousAvailable = chronological[index - 1]?.available ?? null;
    const change =
      previousAvailable === null ? null : value.available - previousAvailable;
    if (change === 0) continue;

    events.push({
      ...value,
      filename:
        filenames.get(value.snapshotId) ??
        `Carga del ${value.date.slice(0, 10)}`,
      previousAvailable,
      change,
      kind:
        change === null
          ? "initial"
          : change > 0
            ? "increase"
            : "decrease",
    });
  }

  const firstAvailable = chronological[0]?.available ?? 0;
  const lastAvailable = chronological.at(-1)?.available ?? firstAvailable;

  return {
    events: events.reverse(),
    changes: events.filter((event) => event.change !== null).length,
    netChange: lastAvailable - firstAvailable,
  };
}
