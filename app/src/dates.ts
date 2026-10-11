export function dateLabel(value: string, withTime = false) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-SV", {
    timeZone: "America/El_Salvador",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime && value.length > 10
      ? ({ hour: "2-digit", minute: "2-digit", hour12: false } as const)
      : {}),
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
