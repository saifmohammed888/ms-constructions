import { TZ } from "@/lib/constants";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatInr(amount: number | string, withPaise = false) {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return "₹0";
  return (withPaise ? inrWithPaise : inr).format(n);
}

export function todayIso(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso.includes("T") ? iso : `${iso}T00:00:00+05:30`) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function isoWeekKey(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00+05:30`);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function formatWeekLabel(key: string) {
  const [y, w] = key.split("-W");
  return `Week ${Number(w)}, ${y}`;
}

export function formatMonthLabel(key: string) {
  const [y, m] = key.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

export function lastNMonths(n: number) {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
