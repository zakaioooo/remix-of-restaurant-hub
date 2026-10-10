import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Check, Crown, FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api/client";
import { PageHeader, SampleNote } from "@/components/admin/SampleNote";
import { useAdminResource } from "@/lib/admin-extras";
import {
  ADMIN_SAAS, FEATURE_LABEL, daysLeft, refreshEntitlement, sampleInvoices, samplePlans, usagePct, useEntitlement,
  type FeatureKey, type SaasInvoice, type SaasPlan,
} from "@/lib/subscription";

export const Route = createFileRoute("/admin/subscription")({
  head: () => ({
    meta: [
      { title: "Plan & Billing — Restaurant Console" },
      { name: "description", content: "See your plan, usage, invoices from the platform and upload payment receipts." },
      { property: "og:title", content: "Plan & Billing — Restaurant Console" },
      { property: "og:description", content: "Your plan, usage, invoices and receipts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionPage,
});

const money = (n: number) => `₨${n.toLocaleString()}`;
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const STATUS: Record<SaasInvoice["status"], string> = {
  paid: "bg-jade/15 text-jade", pending: "bg-amber-lux/15 text-amber-lux", overdue: "bg-ruby/15 text-ruby", under_review: "bg-azure/15 text-azure",
};

function SubscriptionPage() {
  const { ent, sample } = useEntitlement();
  const plans = useAdminResource<SaasPlan[]>(ADMIN_SAAS.plans, samplePlans);
  const inv = useAdminResource<SaasInvoice[]>(ADMIN_SAAS.invoices, sampleInvoices);
  const [paying, setPaying] = useState<SaasInvoice | null>(null);
  const [upgradeTo, setUpgradeTo] = useState<SaasPlan | null>(null);

  if (!ent) return <p className="text-mist">Loading your plan…</p>;
  const trial = ent.status === "trialing" ? daysLeft(ent.trial_ends_at) : null;
  const due = inv.data.filter((i) => i.status === "pending" || i.status === "overdue");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Plan & billing" sub="What you pay the platform, what your plan includes, and how much you've used today." />
      <SampleNote show={sample || inv.sample} what="Plan & billing" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel-lux p-5 lg:col-span-1">
          <p className="eyebrow">Current plan</p>
          <p className="mt-2 flex items-center gap-2 font-hero num-lux text-3xl"><Crown className="h-6 w-6 text-lux" />{ent.plan_name}</p>
          <p className="mt-1 text-sm text-mist">{money(ent.price_pkr)} / month</p>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-dim">Status</dt><dd className="font-bold capitalize text-frost">{ent.status.replace("_", " ")}</dd></div>
            {trial !== null ? <div className="flex justify-between"><dt className="text-slate-dim">Trial ends</dt><dd className="text-amber-lux">{trial} days</dd></div> : null}
            <div className="flex justify-between"><dt className="text-slate-dim">Next renewal</dt><dd className="text-frost">{date(ent.renews_at)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-dim">Amount due</dt><dd className="num-lux text-lux">{money(due.reduce((a, i) => a + i.amount_pkr, 0))}</dd></div>
          </dl>
        </div>

        <div className="panel-lux p-5 lg:col-span-2">
          <p className="eyebrow">Usage against your plan</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {([
              ["Orders today", ent.usage.orders_today, ent.limits.orders_per_day],
              ["Staff seats", ent.usage.staff_seats, ent.limits.staff_seats],
              ["Branches", ent.usage.branches, ent.limits.branches],
            ] as const).map(([l, u, m]) => {
              const pct = usagePct(u, m);
              return (
                <div key={l} className="rounded-2xl border border-lux/15 bg-ink-deep/40 p-4">
                  <p className="text-xs text-mist">{l}</p>
                  <p className="num-lux mt-1 text-2xl text-frost">{u}<span className="text-sm text-slate-dim"> / {m >= 99999 ? "∞" : m}</span></p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-deep/70"><div className={`h-full ${pct >= 90 ? "bg-ruby" : pct >= 75 ? "bg-amber-lux" : "bg-jade"}`} style={{ width: `${pct}%` }} /></div>
                  {pct >= 90 ? <p className="mt-1 text-[11px] text-ruby">Almost full — new ones will be blocked</p> : null}
                </div>
              );
            })}
          </div>
          <p className="eyebrow mt-5">Features included</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(Object.keys(FEATURE_LABEL) as FeatureKey[]).map((k) => (
              <span key={k} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${ent.features[k] ? "border-jade/30 text-jade" : "border-lux/10 text-slate-dim line-through"}`}>
                {ent.features[k] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}{FEATURE_LABEL[k]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-hero num-lux text-2xl">Change plan</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.data.map((p) => {
            const current = p.slug === ent.plan_slug;
            return (
              <div key={p.slug} className={`panel-lux flex flex-col p-5 ${current ? "border-lux/60" : ""}`}>
                <p className="font-bold text-frost">{p.name}{current ? <span className="ml-2 text-[10px] uppercase text-lux">Current</span> : null}</p>
                <p className="num-lux mt-1 text-3xl text-lux">{money(p.price_pkr)}<span className="text-xs text-slate-dim"> /mo</span></p>
                <ul className="mt-3 flex-1 space-y-1 text-xs text-mist">
                  <li>{p.orders_per_day >= 99999 ? "Unlimited" : p.orders_per_day} orders a day</li>
                  <li>{p.staff_seats} staff · {p.branches} branch{p.branches > 1 ? "es" : ""}</li>
                  {p.features.map((f) => <li key={f} className="flex items-center gap-1"><Check className="h-3 w-3 text-jade" />{FEATURE_LABEL[f]}</li>)}
                </ul>
                <button disabled={current} onClick={() => setUpgradeTo(p)} className={`mt-4 ${current ? "btn-ghost-lux opacity-50" : "btn-lux"}`}>
                  {current ? "Your plan" : p.price_pkr > ent.price_pkr ? "Upgrade" : "Switch"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel-lux overflow-hidden">
        <div className="flex items-center justify-between border-b border-lux/10 px-5 py-3">
          <h2 className="font-hero num-lux text-2xl">Invoices from the platform</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-dim">
              <tr><th className="px-5 py-2">Invoice</th><th>Period</th><th>Due</th><th>Amount</th><th>Status</th><th className="pr-5 text-right">Action</th></tr>
            </thead>
            <tbody>
              {inv.data.map((i) => (
                <tr key={i.id} className="border-t border-lux/5">
                  <td className="px-5 py-3"><b className="text-frost">{i.number}</b><div className="text-xs text-slate-dim">{i.plan_name}</div></td>
                  <td className="text-mist">{date(i.period_start)} – {date(i.period_end)}</td>
                  <td className="text-mist">{date(i.due_date)}</td>
                  <td className="num-lux text-lux">{money(i.amount_pkr)}</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS[i.status]}`}>{i.status.replace("_", " ")}</span></td>
                  <td className="pr-5 text-right">
                    {i.status === "pending" || i.status === "overdue"
                      ? <button className="btn-lux" onClick={() => setPaying(i)}><Upload className="h-3.5 w-3.5" /> Pay & upload</button>
                      : i.proof_url ? <a className="btn-ghost-lux" href={i.proof_url} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" /> Receipt</a>
                      : <span className="text-xs text-slate-dim">{i.paid_at ? `Paid ${date(i.paid_at)}` : "Waiting for check"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {paying ? <PayDialog inv={paying} onClose={() => setPaying(null)} onDone={(url) => {
        inv.setData((p) => p.map((x) => (x.id === paying.id ? { ...x, status: "under_review", proof_url: url } : x)));
        setPaying(null);
      }} /> : null}

      {upgradeTo ? (
        <Modal onClose={() => setUpgradeTo(null)} title={`Move to ${upgradeTo.name}?`}>
          <p className="text-sm text-mist">You'll get a new invoice for {money(upgradeTo.price_pkr)}. Features unlock once the platform confirms payment.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-ghost-lux" onClick={() => setUpgradeTo(null)}>Cancel</button>
            <button className="btn-lux" onClick={async () => {
              try { await api.post(ADMIN_SAAS.upgrade, { plan_slug: upgradeTo.slug }); toast.success("Upgrade requested"); void refreshEntitlement(); void inv.reload(); }
              catch { toast.info("Upgrade requested (on this screen only)", { description: "The server part isn't ready yet." }); }
              setUpgradeTo(null);
            }}>Request {upgradeTo.name}</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-deep/80 p-4" onClick={onClose}>
      <div className="panel-lux w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="font-hero num-lux text-2xl">{title}</h3><button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-slate-dim" /></button></div>
        {children}
      </div>
    </div>
  );
}

function PayDialog({ inv, onClose, onDone }: { inv: SaasInvoice; onClose: () => void; onDone: (url: string) => void }) {
  const [tid, setTid] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const submit = async () => {
    if (!tid.trim() || !file) return toast.error("Add the transaction ID and a screenshot");
    setBusy(true);
    const fd = new FormData();
    fd.append("transaction_id", tid.trim());
    fd.append("proof", file);
    const local = URL.createObjectURL(file);
    try { await api.post(ADMIN_SAAS.invoiceProof(inv.id), fd); toast.success("Receipt sent — the platform will check it"); }
    catch { toast.info("Receipt saved on this screen only", { description: "The server part isn't ready yet." }); }
    setBusy(false);
    onDone(local);
  };
  return (
    <Modal title={`Pay ${inv.number}`} onClose={onClose}>
      <div className="rounded-2xl border border-lux/20 bg-ink-deep/50 p-4 text-sm">
        <p className="text-slate-dim">Send {inv.pay_to.method} to</p>
        <p className="num-lux text-2xl text-lux">{inv.pay_to.number}</p>
        <p className="text-xs text-mist">{inv.pay_to.title} · Amount <b className="text-frost">{money(inv.amount_pkr)}</b></p>
      </div>
      <label className="mt-4 block text-xs text-mist">Transaction ID (TID)
        <input value={tid} onChange={(e) => setTid(e.target.value)} className="mt-1 w-full rounded-xl border border-lux/20 bg-ink-deep/60 px-3 py-2 text-frost outline-none focus:border-lux/60" placeholder="e.g. 0123456789" />
      </label>
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button className="btn-ghost-lux mt-3 w-full" onClick={() => ref.current?.click()}><Upload className="h-3.5 w-3.5" /> {file ? file.name : "Choose receipt screenshot"}</button>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost-lux" onClick={onClose}>Cancel</button>
        <button className="btn-lux" disabled={busy} onClick={submit}>{busy ? "Sending…" : "Send receipt"}</button>
      </div>
    </Modal>
  );
}
