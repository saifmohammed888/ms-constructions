"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { ArrowRight, LockKeyhole } from "lucide-react";
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
    <main className="min-h-dvh bg-[#edece8] p-3 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/10 sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.15fr_.85fr]">
        <div className="relative min-h-[42dvh] overflow-hidden bg-[#e6e1d8] lg:min-h-0">
          <Image src="/floor-plans/premium-2bhk-4-options-sheet.png" alt="Kothanur construction floor plan" fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover object-center opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#171512]/80 via-[#171512]/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-10">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/70">A place taking shape</p>
            <p className="mt-2 max-w-md text-2xl font-semibold tracking-tight sm:text-4xl">Every detail of your build, in one calm place.</p>
          </div>
        </div>
        <div className="flex items-center p-7 sm:p-12 lg:p-14">
          <form onSubmit={submit} className="w-full max-w-sm">
            <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-[#171512] text-sm font-bold tracking-tight text-white">MS</div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">MS Ventures</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">Kothanur Construction</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Your private project space.</p>
            <div className="mt-9">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative mt-2">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <PasswordField id="password" autoFocus className="min-h-12 pl-10" value={password} onChange={setPassword} />
              </div>
            </div>
        {error && (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-5 min-h-12 w-full justify-between rounded-xl px-4 text-sm" disabled={pending || !password}>
          {pending && <Spinner />}
          <span>{pending ? "Signing in…" : "Enter project"}</span>
          {!pending && <ArrowRight className="size-4" />}
        </Button>
          </form>
        </div>
      </div>
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
