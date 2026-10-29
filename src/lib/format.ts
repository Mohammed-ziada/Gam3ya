const arabicMonths = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0 }).format(value) + " ج.م";
}

export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

export function cycleDate(start: Date, cycle: number, paymentDay: number) {
  const result = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + cycle - 1, paymentDay, 12));
  return result;
}

export function cycleLabel(start: Date, cycle: number) {
  const date = cycleDate(start, cycle, 1);
  return `${arabicMonths[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString("base64url");
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}
