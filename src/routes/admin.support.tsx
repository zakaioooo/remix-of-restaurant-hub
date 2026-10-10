import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LifeBuoy, Megaphone, Plus, Send } from "lucide-react";

import { PageHeader, SampleNote } from "@/components/admin/SampleNote";
import { useAdminResource } from "@/lib/admin-extras";
import { api } from "@/lib/api/client";
import { ADMIN_SAAS, sampleAnnouncements, sampleTickets, type Announcement, type Ticket } from "@/lib/subscription";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { title: "Help & News — Restaurant Console" },
      { name: "description", content: "Open support tickets with the platform team and read platform announcements." },
      { property: "og:title", content: "Help & News — Restaurant Console" },
      { property: "og:description", content: "Support tickets and platform announcements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

const when = (s: string) => new Date(s).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ST: Record<Ticket["status"], string> = { open: "bg-azure/15 text-azure", waiting: "bg-amber-lux/15 text-amber-lux", resolved: "bg-jade/15 text-jade" };
const input = "mt-1 w-full rounded-xl border border-lux/20 bg-ink-deep/60 px-3 py-2 text-sm text-frost outline-none focus:border-lux/60";

function SupportPage() {
  const t = useAdminResource<Ticket[]>(ADMIN_SAAS.tickets, sampleTickets);
  const a = useAdminResource<Announcement[]>(ADMIN_SAAS.announcements, sampleAnnouncements);
  const [openId, setOpenId] = useState<Ticket["id"] | null>(null);
  const [creating, setCreating] = useState(false);
  const [reply, setReply] = useState("");
  const [f, setF] = useState({ subject: "", category: "Orders", priority: "normal" as Ticket["priority"], body: "" });
  const current = t.data.find((x) => x.id === openId) ?? null;

  const create = async () => {
    if (!f.subject.trim() || !f.body.trim()) return;
    const now = new Date().toISOString();
    const tk: Ticket = { id: Date.now(), subject: f.subject, category: f.category, priority: f.priority, status: "open", created_at: now, messages: [{ from: "restaurant", author: "You", body: f.body, at: now }] };
    const ok = await t.mutate("Ticket sent to the platform team", () => api.post(ADMIN_SAAS.tickets, f), (p) => [tk, ...p]);
    if (ok) { setCreating(false); setOpenId(tk.id); setF({ subject: "", category: "Orders", priority: "normal", body: "" }); }
  };
  const send = async () => {
    if (!current || !reply.trim()) return;
    const msg = { from: "restaurant" as const, author: "You", body: reply, at: new Date().toISOString() };
    await t.mutate("Reply sent", () => api.post(ADMIN_SAAS.ticketReply(current.id), { body: reply }), (p) => p.map((x) => (x.id === current.id ? { ...x, status: "open", messages: [...x.messages, msg] } : x)));
    setReply("");
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Platform" title="Help & news" sub="Talk to the platform team and see what's new." actions={<button className="btn-lux" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New ticket</button>} />
      <SampleNote show={t.sample || a.sample} what="Help & news" />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="panel-lux p-3">
          <p className="eyebrow px-2 pb-2">Your tickets</p>
          {t.data.length === 0 ? <p className="px-2 py-6 text-center text-sm text-slate-dim">No tickets yet.</p> : null}
          {t.data.map((x) => (
            <button key={x.id} onClick={() => { setOpenId(x.id); setCreating(false); }} className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left transition ${openId === x.id ? "bg-lux/10" : "hover:bg-ink-deep/50"}`}>
              <div className="flex items-center justify-between gap-2"><b className="truncate text-sm text-frost">{x.subject}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${ST[x.status]}`}>{x.status}</span></div>
              <p className="text-[11px] text-slate-dim">#{x.id} · {x.category} · {when(x.created_at)}</p>
            </button>
          ))}
        </div>

        <div className="panel-lux p-5">
          {creating ? (
            <div className="space-y-3">
              <h3 className="font-hero num-lux text-2xl">New ticket</h3>
              <label className="block text-xs text-mist">Subject<input className={input} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="What's wrong?" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-mist">Topic<select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{["Orders", "Payments", "WhatsApp", "Menu", "Billing", "Other"].map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="text-xs text-mist">How urgent<select className={input} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Ticket["priority"] })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">Urgent</option></select></label>
              </div>
              <label className="block text-xs text-mist">Details<textarea rows={5} className={input} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
              <div className="flex justify-end gap-2"><button className="btn-ghost-lux" onClick={() => setCreating(false)}>Cancel</button><button className="btn-lux" onClick={create}><Send className="h-3.5 w-3.5" /> Send</button></div>
            </div>
          ) : current ? (
            <div className="flex h-full flex-col">
              <h3 className="font-hero num-lux text-2xl">{current.subject}</h3>
              <p className="text-xs text-slate-dim">#{current.id} · {current.category} · {current.priority} priority</p>
              <div className="mt-4 flex-1 space-y-3">
                {current.messages.map((m, i) => (
                  <div key={i} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.from === "restaurant" ? "ml-auto bg-lux/10 text-frost" : "bg-ink-deep/60 text-mist"}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-lux/70">{m.author} · {when(m.at)}</p>
                    <p className="mt-1">{m.body}</p>
                  </div>
                ))}
              </div>
              {current.status !== "resolved" ? (
                <div className="mt-4 flex gap-2"><input className={input + " mt-0"} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" onKeyDown={(e) => e.key === "Enter" && send()} /><button className="btn-lux" onClick={send}><Send className="h-3.5 w-3.5" /></button></div>
              ) : <p className="mt-4 text-center text-xs text-jade">This ticket is resolved.</p>}
            </div>
          ) : (
            <div className="grid h-full place-items-center py-10 text-center text-sm text-slate-dim"><div><LifeBuoy className="mx-auto mb-2 h-8 w-8 text-lux/60" />Pick a ticket or open a new one.</div></div>
          )}
        </div>
      </div>

      <section className="panel-lux p-5">
        <h2 className="mb-3 flex items-center gap-2 font-hero num-lux text-2xl"><Megaphone className="h-5 w-5 text-lux" /> News from the platform</h2>
        <div className="space-y-2">
          {a.data.map((n) => (
            <div key={n.id} className="rounded-xl border border-lux/10 bg-ink-deep/40 px-4 py-3">
              <div className="flex items-center justify-between"><b className="text-sm text-frost">{n.title}</b><span className="text-[11px] text-slate-dim">{when(n.at)}</span></div>
              <p className="text-xs text-mist">{n.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
