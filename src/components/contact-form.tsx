"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveForm } from "@/components/responsive-form";
import { CONTACT_ROLES, CONTACT_ROLE_LABELS } from "@/lib/constants";

type Contact = {
  id?: string;
  name: string;
  role: string;
  phone?: string | null;
  altPhone?: string | null;
  email?: string | null;
  notes?: string | null;
  tags?: string[];
};

export function ContactForm({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Contact | null;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "contractor");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [altPhone, setAltPhone] = useState(initial?.altPhone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        role,
        phone: phone || null,
        altPhone: altPhone || null,
        email: email || null,
        notes: notes || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const url = initial?.id ? `/api/contacts/${initial.id}` : "/api/contacts";
      const res = await fetch(url, {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save contact");
      return data;
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Contact updated" : "Contact added");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <ResponsiveForm open={open} onOpenChange={onOpenChange} title={initial?.id ? "Edit contact" : "Add contact"}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" className="mt-1.5 min-h-11" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => v && setRole(String(v))}>
            <SelectTrigger className="mt-1.5 min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {CONTACT_ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" className="mt-1.5 min-h-11" inputMode="tel" value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="alt">Alt phone</Label>
          <Input id="alt" className="mt-1.5 min-h-11" inputMode="tel" value={altPhone ?? ""} onChange={(e) => setAltPhone(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" className="mt-1.5 min-h-11" value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" className="mt-1.5 min-h-11" placeholder="steel, plumbing…" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" className="mt-1.5" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button type="submit" className="min-h-11" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save contact"}
        </Button>
      </form>
    </ResponsiveForm>
  );
}
