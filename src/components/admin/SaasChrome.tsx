/**
 * Platform-driven pieces shown inside the restaurant admin:
 * viewing-as bar, plan/usage strip, announcements, suspended lock, feature lock.
 */
import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Crown, Eye, Lock, Megaphone, Sparkles, X } from "lucide-react";

import { api } from "@/lib/api/client";
import { setTenantSlug } from "@/lib/tenant";
import {
  ADMIN_SAAS, FEATURE_LABEL, PATH_FEATURE, daysLeft, endImpersonation, readImpersonation,
  sampleAnnouncements, usagePct, useEntitlement, type Announcement,
} from "@/lib/subscription";

export function ImpersonationBar() {
  const [imp, setImp] = useState<ReturnType<typeof readImpersonation>>(null);
  useEffect(() => setImp(readImpersonation()), []);
  if (!imp) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-azure/40 bg-azure/10 px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-frost">
        <Eye className="h-4 w-4 text-azure" />
        You are viewing <b>{imp.name}</b> as the platform owner. Everything you change is logged.
      </span>
      <button
        className="btn-ghost-lux"
        onClick={() => { endImpersonation(); setTenantSlug(null); window.location.href = "/platform"; }}
      >
        Exit to platform
      </button>
    </div>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = usagePct(used, limit);
  const tone = pct >= 90 ? "bg-ruby" : pct >= 75 ? "bg-amber-lux" : "bg-jade";
  return (
    <div className="min-w-[140px] flex-1">
      <div className="flex justify-between text-[11px] text-mist">
        <span>{label}</span>
        <span className="num-lux">{used}/{limit >= 99999 ? "∞" : limit}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-deep/70">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PlanBar() {
  const { ent } = useEntitlement();
  if (!ent) return null;
  const trial = ent.status === "trialing" ? daysLeft(ent.trial_ends_at) : null;
  const nearLimit = usagePct(ent.usage.orders_today, ent.limits.orders_per_day) >= 90;
  return (
    <div className="panel-lux mb-4 flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-lux" />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-lux/70">Your plan</p>
          <p className="text-sm font-bold text-frost">
            {ent.plan_name}
            {trial !== null ? <span className="ml-2 rounded-full bg-amber-lux/15 px-2 py-0.5 text-[10px] text-amber-lux">Trial · {trial} days left</span> : null}
            {ent.status === "past_due" ? <span className="ml-2 rounded-full bg-ruby/15 px-2 py-0.5 text-[10px] text-ruby">Payment due</span> : null}
          </p>
        </div>
      </div>
      <Meter label="Orders today" used={ent.usage.orders_today} limit={ent.limits.orders_per_day} />
      <Meter label="Staff seats" used={ent.usage.staff_seats} limit={ent.limits.staff_seats} />
      <Meter label="Branches" used={ent.usage.branches} limit={ent.limits.branches} />
      <Link to="/admin/subscription" className={nearLimit || trial !== null ? "btn-lux" : "btn-ghost-lux"}>
        <Sparkles className="h-3.5 w-3.5" /> {nearLimit ? "Near limit · Upgrade" : "Plan & billing"}
      </Link>
    </div>
  );
}

export function AnnouncementStrip() {
  const [items, setItems] = useState<Announcement[]>([]);
  useEffect(() => {
    api.get(ADMIN_SAAS.announcements)
      .then((r) => setItems((Array.isArray(r) ? r : (r as { results?: Announcement[] })?.results ?? []) as Announcement[]))
      .catch(() => setItems(sampleAnnouncements()));
  }, []);
  const unread = items.filter((a) => !a.read);
  if (!unread.length) return null;
  const a = unread[0]!;
  const dismiss = () => {
    setItems((p) => p.map((x) => (x.id === a.id ? { ...x, read: true } : x)));
    api.post(ADMIN_SAAS.announcementRead(a.id), {}).catch(() => {});
  };
  const tone = a.level === "warning" ? "border-amber-lux/40 bg-amber-lux/10" : "border-lux/30 bg-lux/5";
  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${tone}`}>
      <Megaphone className={`mt-0.5 h-4 w-4 shrink-0 ${a.level === "warning" ? "text-amber-lux" : "text-lux"}`} />
      <div className="flex-1">
        <p className="font-bold text-frost">{a.title}</p>
        <p className="text-xs text-mist">{a.body}</p>
        {unread.length > 1 ? <Link to="/admin/support" className="mt-1 inline-block text-xs text-lux underline">+{unread.length - 1} more from the platform</Link> : null}
      </div>
      <button aria-label="Dismiss" onClick={dismiss} className="text-slate-dim hover:text-frost"><X className="h-4 w-4" /></button>
    </div>
  );
}

/** Wraps the admin pages: locks everything when suspended, locks a page when its feature is off. */
export function SaasGate({ children }: { children: React.ReactNode }) {
  const { ent } = useEntitlement();
  const { pathname } = useLocation();
  if (!ent) return <>{children}</>;
  const billingPath = pathname.startsWith("/admin/subscription") || pathname.startsWith("/admin/support");

  if ((ent.status === "suspended" || ent.status === "cancelled") && !billingPath) {
    return (
      <div className="panel-lux mx-auto mt-10 max-w-lg p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-ruby" />
        <h2 className="mt-3 font-hero num-lux text-3xl">Your restaurant is paused</h2>
        <p className="mt-2 text-sm text-mist">
          {ent.suspended_reason || "Your subscription invoice is unpaid."} Customers can't place online orders right now.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/admin/subscription" className="btn-lux">Pay invoice</Link>
          <Link to="/admin/support" className="btn-ghost-lux">Contact support</Link>
        </div>
      </div>
    );
  }

  const hit = PATH_FEATURE.find(([p]) => pathname.startsWith(p));
  if (hit && ent.features[hit[1]] === false) {
    return (
      <div className="panel-lux mx-auto mt-10 max-w-lg p-8 text-center">
        <Lock className="mx-auto h-10 w-10 text-lux" />
        <h2 className="mt-3 font-hero num-lux text-3xl">{FEATURE_LABEL[hit[1]]} is a higher-plan feature</h2>
        <p className="mt-2 text-sm text-mist">Your {ent.plan_name} plan doesn't include it. Upgrade to unlock it straight away.</p>
        <Link to="/admin/subscription" className="btn-lux mt-5 inline-flex"><Sparkles className="h-3.5 w-3.5" /> See plans</Link>
      </div>
    );
  }
  return <>{children}</>;
}
