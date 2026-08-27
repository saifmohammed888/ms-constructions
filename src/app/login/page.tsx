"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/password-field";
import { Spinner } from "@/components/ui/spinner";

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
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-stone-100 p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.92_0.04_70),_transparent_55%)]" />
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl border bg-background/95 p-7 shadow-lg backdrop-blur"
      >
        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="size-5" />
        </div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">MS Constructions</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Site tracker</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Owner access only. Use the password set in Vercel (`APP_PASSWORD_HASH`), or set one here on first run.
        </p>
        <div className="mt-6">
          <Label htmlFor="password">Password</Label>
          <PasswordField
            id="password"
            autoFocus
            className="mt-1.5"
            value={password}
            onChange={setPassword}
          />
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-4 min-h-11 w-full gap-2" disabled={pending || !password}>
          {pending && <Spinner />}
          {pending ? "Signing in…" : "Enter"}
        </Button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
