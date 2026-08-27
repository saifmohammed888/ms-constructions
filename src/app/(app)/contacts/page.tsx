"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, Plus, Pencil, Trash2 } from "lucide-react";
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
        <ul className="grid gap-3 md:grid-cols-2">
          {list.data!.map((c) => (
            <li key={c.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left" onClick={() => setDetail(c.id)}>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{CONTACT_ROLE_LABELS[c.role as ContactRole]}</p>
                </button>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
                  >
                    <Phone className="size-4" /> Call
                  </a>
                )}
              </div>
              <div className="mt-3 flex gap-1">
                <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => { setEditing(c); setOpen(true); }}>
                  <Pencil className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => del.mutate(c.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ContactForm key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} initial={editing ?? undefined} />
      <ContactDetail id={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

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
