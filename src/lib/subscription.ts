/**
 * Platform → restaurant link. Everything the platform owner decides about a
 * restaurant (plan, features, limits, status, invoices, announcements,
 * tickets) is read here by the restaurant admin.
 * Each loader tries the real endpoint and falls back to sample data.
 * Endpoints are documented in do_backend.md, section D.
 */
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";

export const ADMIN_SAAS = {
  subscription: "/admin/subscription/",
  invoices: "/admin/subscription/invoices/",
  invoiceProof: (id: string | number) => `/admin/subscription/invoices/${id}/proof/`,
  upgrade: "/admin/subscription/upgrade/",
  plans: "/admin/subscription/plans/",
  announcements: "/admin/announcements/",
  announcementRead: (id: string | number) => `/admin/announcements/${id}/read/`,
  tickets: "/admin/support/tickets/",
  ticketReply: (id: string | number) => `/admin/support/tickets/${id}/reply/`,
} as const;

export type FeatureKey = "pos" | "whatsapp" | "riders" | "coupons" | "reviews" | "inventory" | "branches" | "reports";

export type Entitlement = {
  plan_slug: string;
  plan_name: string;
  price_pkr: number;
  status: "active" | "trialing" | "past_due" | "suspended" | "cancelled";
  trial_ends_at: string | null;
  renews_at: string | null;
  suspended_reason?: string | null;
  features: Record<FeatureKey, boolean>;
  limits: { orders_per_day: number; staff_seats: number; branches: number };
  usage: { orders_today: number; staff_seats: number; branches: number };
};

export type SaasInvoice = {
  id: number | string;
  number: string;
  plan_name: string;
  amount_pkr: number;
  status: "pending" | "paid" | "overdue" | "under_review";
  period_start: string;
  period_end: string;
  due_date: string;
  paid_at: string | null;
  proof_url: string | null;
  pay_to: { method: string; number: string; title: string };
};

export type Announcement = { id: number | string; title: string; body: string; level: "info" | "feature" | "warning"; at: string; read: boolean };
export type TicketMsg = { from: "restaurant" | "platform"; author: string; body: string; at: string };
export type Ticket = { id: number | string; subject: string; category: string; priority: "low" | "normal" | "high"; status: "open" | "waiting" | "resolved"; created_at: string; messages: TicketMsg[] };

export type SaasPlan = { slug: string; name: string; price_pkr: number; orders_per_day: number; staff_seats: number; branches: number; features: FeatureKey[] };

export const FEATURE_LABEL: Record<FeatureKey, string> = {
  pos: "Counter POS", whatsapp: "WhatsApp", riders: "Riders & delivery", coupons: "Coupons",
  reviews: "Reviews", inventory: "Inventory", branches: "Branches", reports: "Sales reports",
};

/** Which admin path needs which feature. */
export const PATH_FEATURE: [string, FeatureKey][] = [
  ["/admin/pos", "pos"], ["/admin/whatsapp", "whatsapp"], ["/admin/riders", "riders"],
  ["/admin/coupons", "coupons"], ["/admin/reviews", "reviews"], ["/admin/inventory", "inventory"],
  ["/admin/branches", "branches"], ["/admin/reports", "reports"],
];

const day = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

export const sampleEntitlement = (): Entitlement => ({
  plan_slug: "growth", plan_name: "Growth", price_pkr: 4999, status: "trialing",
  trial_ends_at: iso(9 * day), renews_at: iso(9 * day), suspended_reason: null,
  features: { pos: true, whatsapp: true, riders: true, coupons: true, reviews: true, inventory: true, branches: false, reports: false },
  limits: { orders_per_day: 150, staff_seats: 8, branches: 1 },
  usage: { orders_today: 112, staff_seats: 6, branches: 1 },
});

export const samplePlans = (): SaasPlan[] => [
  { slug: "starter", name: "Starter", price_pkr: 2499, orders_per_day: 60, staff_seats: 3, branches: 1, features: ["pos", "whatsapp", "coupons"] },
  { slug: "growth", name: "Growth", price_pkr: 4999, orders_per_day: 150, staff_seats: 8, branches: 1, features: ["pos", "whatsapp", "riders", "coupons", "reviews", "inventory"] },
  { slug: "pro", name: "Pro", price_pkr: 9999, orders_per_day: 100000, staff_seats: 25, branches: 5, features: ["pos", "whatsapp", "riders", "coupons", "reviews", "inventory", "branches", "reports"] },
];

export const sampleInvoices = (): SaasInvoice[] => [
  { id: 1042, number: "INV-1042", plan_name: "Growth", amount_pkr: 4999, status: "pending", period_start: iso(-1 * day), period_end: iso(29 * day), due_date: iso(6 * day), paid_at: null, proof_url: null, pay_to: { method: "JazzCash", number: "0300-0000000", title: "Platform Account" } },
  { id: 1011, number: "INV-1011", plan_name: "Starter", amount_pkr: 2499, status: "paid", period_start: iso(-31 * day), period_end: iso(-1 * day), due_date: iso(-24 * day), paid_at: iso(-26 * day), proof_url: null, pay_to: { method: "JazzCash", number: "0300-0000000", title: "Platform Account" } },
];

export const sampleAnnouncements = (): Announcement[] => [
  { id: 1, title: "New: split payments in the POS", body: "Take part cash, part JazzCash on one bill. Open Counter POS → Pay.", level: "feature", at: iso(-1 * day), read: false },
  { id: 2, title: "Planned maintenance Sunday 3–4 AM", body: "Online ordering may pause for a few minutes.", level: "warning", at: iso(-3 * day), read: false },
];

export const sampleTickets = (): Ticket[] => [
  { id: 77, subject: "WhatsApp messages not sending", category: "WhatsApp", priority: "high", status: "waiting", created_at: iso(-2 * day),
    messages: [
      { from: "restaurant", author: "Owner", body: "Customers aren't getting order messages since yesterday.", at: iso(-2 * day) },
      { from: "platform", author: "Support team", body: "Please rescan the QR on the WhatsApp page and tell us if it works.", at: iso(-1.5 * day) },
    ] },
];

/* ---------- shared entitlement store (one fetch for the whole admin) ---------- */

let cache: { data: Entitlement; sample: boolean } | null = null;
let inflight: Promise<void> | null = null;
const subs = new Set<() => void>();

const notBuilt = (e: unknown) => e instanceof ApiError && (e.isNetwork || [404, 405, 501].includes(e.status));

async function fetchEntitlement() {
  try {
    const r = (await api.get(ADMIN_SAAS.subscription)) as Entitlement;
    cache = { data: { ...sampleEntitlement(), ...r }, sample: false };
  } catch (e) {
    if (!notBuilt(e)) console.warn("[subscription]", e);
    cache = { data: sampleEntitlement(), sample: true };
  }
  subs.forEach((f) => f());
}

export function refreshEntitlement() {
  inflight = fetchEntitlement().finally(() => (inflight = null));
  return inflight;
}

export function useEntitlement() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    if (!cache && !inflight) void refreshEntitlement();
    return () => void subs.delete(f);
  }, []);
  return { ent: cache?.data ?? null, sample: cache?.sample ?? false };
}

export const daysLeft = (isoDate: string | null) =>
  isoDate ? Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / day)) : null;

export const usagePct = (used: number, limit: number) => (limit >= 99999 ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100)));

/* ---------- "viewing as" (platform owner opened a restaurant) ---------- */

const IMP_KEY = "kmg.impersonating";
export function startImpersonation(name: string, slug: string) {
  sessionStorage.setItem(IMP_KEY, JSON.stringify({ name, slug, at: new Date().toISOString() }));
}
export function readImpersonation(): { name: string; slug: string; at: string } | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(sessionStorage.getItem(IMP_KEY) || "null"); } catch { return null; }
}
export function endImpersonation() {
  sessionStorage.removeItem(IMP_KEY);
}
