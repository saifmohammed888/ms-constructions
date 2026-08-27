"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed. Check Vercel env vars.");
        return;
      }
      router.push(params.get("next") || "/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">MS Constructions</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Site tracker</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Single-owner access. If this is the first time, the password you type becomes the app password.
        </p>
        <div className="mt-6">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoFocus
            className="mt-1.5 min-h-11"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="mt-4 min-h-11 w-full" disabled={pending}>
          {pending ? "Checking…" : "Enter"}
        </Button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
