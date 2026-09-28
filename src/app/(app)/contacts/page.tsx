"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Phone, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContactForm } from "@/components/contact-form";
import { formatInr, formatDate } from "@/lib/format";
import { CONTACT_ROLES, CONTACT_ROLE_LABELS, type ContactRole } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardSkeleton } from "@/components/ui/spinner";

type Contact = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  altPhone: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
};

export default function ContactsPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: "name" | "role"; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });

  const list = useQuery({
    queryKey: ["contacts", role, q],
    queryFn: () => {
      const s = new URLSearchParams();
      if (role) s.set("role", role);
      if (q) s.set("q", q);
      return fetch(`/api/contacts?${s}`).then((r) => r.json()) as Promise<Contact[]>;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast.success("Contact deleted. Expenses stay, payee is cleared.");
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
  const items = useMemo(() => [...(list.data ?? [])].sort((a, b) => { const av = a[sort.key].toLowerCase(); const bv = b[sort.key].toLowerCase(); return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.direction === "asc" ? 1 : -1); }), [list.data, sort]);
  const toggleSort = (key: "name" | "role") => setSort((s) => ({ key, direction: s.key === key && s.direction === "asc" ? "desc" : "asc" }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">Tap call on site. Keep architect, contractor, and vendors here.</p>
        </div>
        <Button className="min-h-11" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <Input className="min-h-11" placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-2 overflow-x-auto">
        <Button size="sm" className="min-h-9" variant={role === "" ? "default" : "outline"} onClick={() => setRole("")}>
          All
        </Button>
        {CONTACT_ROLES.map((r) => (
          <Button key={r} size="sm" className="min-h-9" variant={role === r ? "default" : "outline"} onClick={() => setRole(r)}>
            {CONTACT_ROLE_LABELS[r]}
          </Button>
        ))}
      </div>

      {list.isLoading ? (
        <CardSkeleton rows={4} />
      ) : (list.data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No contacts yet</p>
          <Button className="mt-4 min-h-11" onClick={() => setOpen(true)}>
            Add your first contact
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[680px] text-sm"><thead className="border-b bg-zinc-50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3"><SortButton label="Name" onClick={() => toggleSort("name")} /></th><th className="px-4 py-3"><SortButton label="Role" onClick={() => toggleSort("role")} /></th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Email</th><th className="w-32 px-4 py-3" /></tr></thead><tbody>{items.map((c) => <tr key={c.id} className="border-b last:border-0 hover:bg-zinc-50"><td className="px-4 py-3"><button className="font-medium hover:underline" onClick={() => setDetail(c.id)}>{c.name}</button></td><td className="px-4 py-3 text-muted-foreground">{CONTACT_ROLE_LABELS[c.role as ContactRole] ?? c.role}</td><td className="px-4 py-3">{c.phone ? <a className="inline-flex items-center gap-1 text-sm underline" href={`tel:${c.phone}`}><Phone className="size-3.5" />{c.phone}</a> : "—"}</td><td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td><td className="px-4 py-2"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div>
      )}

      <ContactForm key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} initial={editing ?? undefined} />
      <ContactDetail id={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) { return <button className="inline-flex items-center gap-1" onClick={onClick}>{label}<ChevronsUpDown className="size-3.5" /></button>; }

function ContactDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["contact", id],
    enabled: Boolean(id),
    queryFn: () => fetch(`/api/contacts/${id}`).then((r) => r.json()),
  });
  const d = q.data;
  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d?.name ?? "Contact"}</DialogTitle>
        </DialogHeader>
        {d && (
          <div className="flex flex-col gap-3 text-sm">
            <p>{d.notes || "No notes"}</p>
            {d.phone && (
              <a className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary text-primary-foreground" href={`tel:${d.phone}`}>
                Call {d.phone}
              </a>
            )}
            <p className="font-medium">Paid to this person: {formatInr(d.totalPaid ?? 0)}</p>
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {(d.expenses ?? []).map((e: { id: string; amount: string; date: string; category: string }) => (
                <li key={e.id} className="flex justify-between border-b py-1">
                  <span>{formatDate(e.date)}</span>
                  <span>{formatInr(e.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
