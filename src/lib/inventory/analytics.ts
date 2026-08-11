import type {
  InventoryHistoryPoint,
  InventoryItem,
  LineMetric,
  ProductMovement,
} from "@/types/inventory";

const itemKey = (item: Pick<InventoryItem, "sku" | "warehouse">) =>
  `${item.sku}::${item.warehouse}`;

export function aggregateLineMetrics(
  current: InventoryItem[],
  previous: InventoryItem[],
  lowStockThreshold: number,
): LineMetric[] {
  const previousByLine = new Map<string, number>();
  for (const item of previous) {
    previousByLine.set(
      item.productLine,
      (previousByLine.get(item.productLine) ?? 0) + item.available,
    );
  }

  const grouped = new Map<
    string,
    {
      available: number;
      skus: Set<string>;
      exhausted: number;
      lowStock: number;
    }
  >();

  for (const item of current) {
    const entry = grouped.get(item.productLine) ?? {
      available: 0,
      skus: new Set<string>(),
      exhausted: 0,
      lowStock: 0,
    };
    entry.available += item.available;
    entry.skus.add(item.sku);
    if (item.available <= 0) entry.exhausted += 1;
    else if (item.available <= lowStockThreshold) entry.lowStock += 1;
    grouped.set(item.productLine, entry);
  }

  return [...grouped.entries()]
    .map(([line, entry]) => {
      const previousAvailable = previousByLine.get(line) ?? 0;
      const change = entry.available - previousAvailable;
      return {
        line,
        available: entry.available,
        references: entry.skus.size,
        exhausted: entry.exhausted,
        lowStock: entry.lowStock,
        change,
        changePercent:
          previousAvailable === 0 ? 0 : (change / previousAvailable) * 100,
      };
    })
    .sort((a, b) => b.available - a.available);
}

export function calculateProductMovements(
  current: InventoryItem[],
  previous: InventoryItem[],
): ProductMovement[] {
  const previousMap = new Map(previous.map((item) => [itemKey(item), item]));

  return current
    .map((item) => {
      const oldItem = previousMap.get(itemKey(item));
      const previousAvailable = oldItem?.available ?? 0;
      const change = item.available - previousAvailable;
      return {
        sku: item.sku,
        productName: item.productName,
        productLine: item.productLine,
        warehouse: item.warehouse,
        current: item.available,
        previous: previousAvailable,
        change,
        changePercent:
          previousAvailable === 0 ? 0 : (change / previousAvailable) * 100,
      };
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export function summarizeNegativeMovementsByLine(
  movements: ProductMovement[],
) {
  const grouped = new Map<string, { unitsOut: number; products: number }>();

  for (const movement of movements) {
    if (movement.change >= 0) continue;
    const entry = grouped.get(movement.productLine) ?? {
      unitsOut: 0,
      products: 0,
    };
    entry.unitsOut += Math.abs(movement.change);
    entry.products += 1;
    grouped.set(movement.productLine, entry);
  }

  return [...grouped.entries()]
    .map(([line, values]) => ({ line, ...values }))
    .sort((a, b) => b.unitsOut - a.unitsOut);
}

export function buildInventoryTrend(
  history: InventoryHistoryPoint[],
  current: InventoryItem[],
  productLines?: readonly string[],
) {
  const includedLines = productLines ? new Set(productLines) : null;
  const includesLine = (line: string) =>
    includedLines === null || includedLines.has(line);
  const grouped = new Map<
    string,
    { snapshotId: string; date: string; available: number }
  >();

  for (const point of history) {
    if (!includesLine(point.productLine)) continue;
    const entry = grouped.get(point.snapshotId) ?? {
      snapshotId: point.snapshotId,
      date: point.date,
      available: 0,
    };
    entry.available += point.available;
    if (point.date > entry.date) entry.date = point.date;
    grouped.set(point.snapshotId, entry);
  }

  const currentDate = current[0]?.sourceExportedAt;
  if (currentDate) {
    const currentSnapshotId =
      current.find((item) => item.snapshotId)?.snapshotId ??
      `current:${currentDate}`;
    grouped.set(currentSnapshotId, {
      snapshotId: currentSnapshotId,
      date: currentDate,
      available: current
        .filter((item) => includesLine(item.productLine))
        .reduce((sum, item) => sum + item.available, 0),
    });
  }

  return [...grouped.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export function buildLineTrend(
  history: InventoryHistoryPoint[],
  days: number,
  line?: string,
  warehouse?: string,
) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const grouped = new Map<string, Map<string, number>>();

  for (const point of history) {
    const pointDate = new Date(point.date);
    if (pointDate < cutoff) continue;
    if (line && line !== "all" && point.productLine !== line) continue;
    if (warehouse && warehouse !== "all" && point.warehouse !== warehouse) {
      continue;
    }

    const dateKey = point.date.slice(0, 10);
    const lineMap = grouped.get(dateKey) ?? new Map<string, number>();
    lineMap.set(
      point.productLine,
      (lineMap.get(point.productLine) ?? 0) + point.available,
    );
    grouped.set(dateKey, lineMap);
  }

  const allLines = [
    ...new Set(
      [...grouped.values()].flatMap((lineMap) => [...lineMap.keys()]),
    ),
  ].sort();

  const data = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      ...Object.fromEntries(allLines.map((name) => [name, values.get(name) ?? 0])),
    }));

  return { data, lines: allLines };
}

export function inventorySummary(
  current: InventoryItem[],
  lowStockThreshold: number,
) {
  return {
    references: new Set(current.map((item) => item.sku)).size,
    available: current.reduce((sum, item) => sum + item.available, 0),
    exhausted: current.filter((item) => item.available <= 0).length,
    lowStock: current.filter(
      (item) => item.available > 0 && item.available <= lowStockThreshold,
    ).length,
    lines: new Set(current.map((item) => item.productLine)).size,
  };
}
