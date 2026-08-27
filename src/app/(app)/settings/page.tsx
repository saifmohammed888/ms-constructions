"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, formatInr } from "@/lib/format";

function SettingsInner() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [cats, setCats] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");

  useEffect(() => {
    const g = params.get("google");
    if (g === "ok") toast.success("Google connected. Drive folders are ready.");
    if (g === "error") toast.error("Google connect failed. Try again.");
    if (g === "denied") toast.error("Google access was not granted.");
  }, [params]);

  useEffect(() => {
    if (!settings.data) return;
    setName(settings.data.projectName ?? "");
    setBudget(settings.data.budgetTotal != null ? String(settings.data.budgetTotal) : "");
    const next: Record<string, string> = {};
    for (const c of EXPENSE_CATEGORIES) {
      next[c] = settings.data.budgetByCategory?.[c] != null ? String(settings.data.budgetByCategory[c]) : "";
    }
    setCats(next);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const budgetByCategory: Record<string, number> = {};
      for (const [k, v] of Object.entries(cats)) {
        if (v) budgetByCategory[k] = Number(v);
      }
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: name,
          budgetTotal: budget ? Number(budget) : null,
          budgetByCategory,
          setupComplete: true,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      return data;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      setPassword("");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backup = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/backup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backup failed");
      return data;
    },
    onSuccess: () => {
      toast.success("Backup uploaded to Drive");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="pn">Project name</Label>
            <Input id="pn" className="mt-1.5 min-h-11" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="budget">Total budget (₹)</Label>
            <Input id="budget" className="mt-1.5 min-h-11" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} />
            {budget && <p className="mt-1 text-xs text-muted-foreground">{formatInr(Number(budget) || 0)}</p>}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Per-category budgets</p>
            <div className="grid gap-2">
              {EXPENSE_CATEGORIES.map((c) => (
                <div key={c} className="grid grid-cols-2 items-center gap-2">
                  <Label>{EXPENSE_CATEGORY_LABELS[c]}</Label>
                  <Input
                    className="min-h-11"
                    inputMode="numeric"
                    value={cats[c] ?? ""}
                    onChange={(e) => setCats({ ...cats, [c]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
          <Button className="min-h-11" onClick={() => save.mutate()} disabled={save.isPending}>
            Save project
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Google</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            Calendar: {settings.data?.gcalConnected ? "Connected" : "Not connected"} · Drive:{" "}
            {settings.data?.driveConnected ? "Connected" : "Not connected"}
          </p>
          {!settings.data?.googleConfigured && (
            <p className="text-muted-foreground">
              Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_URL on Vercel, then reconnect.
            </p>
          )}
          <Button className="min-h-11" onClick={() => (window.location.href = "/api/auth/google")}>
            {settings.data?.gcalConnected ? "Reconnect Google" : "Connect Google"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            Last backup: {settings.data?.lastBackupAt ? formatDate(settings.data.lastBackupAt) : "Not yet"}
          </p>
          <p className="text-muted-foreground">Weekly Sunday 8:00 pm IST to Drive/Backups, plus this manual button.</p>
          <Button variant="outline" className="min-h-11" onClick={() => backup.mutate()} disabled={backup.isPending}>
            {backup.isPending ? "Backing up…" : "Backup now"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {settings.data?.hasEnvPassword && (
            <p className="text-sm text-muted-foreground">
              A password hash is set in APP_PASSWORD_HASH and takes priority. Changing it here stores a fallback hash.
            </p>
          )}
          <Input
            type="password"
            className="min-h-11"
            placeholder="New password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button className="min-h-11" variant="outline" onClick={() => save.mutate()} disabled={!password}>
            Change password
          </Button>
          <Button className="min-h-11" variant="ghost" onClick={logout}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
