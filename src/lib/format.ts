// SSR-safe formatters (UTC, en-US) to avoid hydration mismatches.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const dateShortFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}
export function formatDateShort(iso: string) {
  return dateShortFmt.format(new Date(iso));
}
export function formatMoney(n: number) {
  return moneyFmt.format(n);
}

const NOW_UTC = Date.UTC(2026, 3, 18);
export function daysFromNow(iso: string) {
  return Math.round((new Date(iso).getTime() - NOW_UTC) / 86_400_000);
}
