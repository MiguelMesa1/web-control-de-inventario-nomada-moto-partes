const BOGOTA_TIME_ZONE = "America/Bogota";

const bogotaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOGOTA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getBogotaCalendarDate(date = new Date()) {
  const parts = new Map(
    bogotaDateFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`;
}

export function inventorySourceDateToIso(calendarDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
    throw new Error("Selecciona una fecha válida para el inventario.");
  }

  const date = new Date(`${calendarDate}T00:00:00-05:00`);
  if (
    !Number.isFinite(date.getTime()) ||
    getBogotaCalendarDate(date) !== calendarDate
  ) {
    throw new Error("Selecciona una fecha válida para el inventario.");
  }

  return date.toISOString();
}

export function isValidInventorySourceDate(
  value: string,
  now = new Date(),
) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;

  const sourceCalendarDate = date.toISOString().slice(0, 10);
  return sourceCalendarDate <= getBogotaCalendarDate(now);
}
