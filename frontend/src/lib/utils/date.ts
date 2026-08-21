/** Dates rendered for the UI, always in Spanish (Argentina). */
const dayFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "19 ago 2026" from an ISO timestamp. */
export function formatDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}
