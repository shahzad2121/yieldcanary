/**
 * Consistent date display (MM-DD-YYYY) for ETF deep dive: charts, tables, header.
 */

export function formatMMDDYYYY(input: string | null | undefined): string {
  if (input == null) return "—";
  const raw = String(input).trim();
  if (!raw) return "—";

  const datePart = raw.split("T")[0].split(" ")[0];

  let m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[2]}-${m[3]}-${m[1]}`;

  m = datePart.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}-01-${m[1]}`;

  m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    return `${mm}-${dd}-${m[3]}`;
  }

  return datePart;
}

/** News / datetime: MM-DD-YYYY HH:mm (local) */
export function formatNewsDateTime(input: string | null | undefined): string {
  if (input == null || !String(input).trim()) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return formatMMDDYYYY(input);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
}
