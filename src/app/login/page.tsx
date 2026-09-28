"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { ArrowRight, Compass, LockKeyhole } from "lucide-react";
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
    <main className="min-h-dvh bg-[#e9e7e1] p-3 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-[#fbfaf8] shadow-[0_24px_80px_rgba(28,25,20,.16)] sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.08fr_.92fr]">
        <div className="relative min-h-[47dvh] overflow-hidden bg-[#202b2d] lg:min-h-0">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(235,214,169,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(235,214,169,.55)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(221,183,111,.23),transparent_52%)]" />
          <div className="absolute inset-6 rounded-[1.5rem] border border-[#d9bd83]/30 sm:inset-10" />
          <div className="absolute inset-8 sm:inset-14">
            <Image src="/login-site-photo.png" alt="Kothanur construction site" fill priority sizes="(max-width: 1024px) 100vw, 58vw" className="object-cover p-2 opacity-90 sm:p-5" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#11191a] via-[#11191a]/80 to-transparent p-7 pt-28 text-white sm:p-10 sm:pt-36">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-[#e4c98f]"><Compass className="size-4" /> Site plan / 01</div>
            <p className="mt-3 max-w-md text-2xl font-semibold tracking-tight sm:text-4xl">A clear view of what we’re building.</p>
            <p className="mt-2 text-sm text-white/60">Kothanur · Bengaluru</p>
          </div>
        </div>
        <div className="flex items-center p-7 sm:p-12 lg:p-16">
          <form onSubmit={submit} className="w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-[#202b2d] text-sm font-bold tracking-tight text-[#e4c98f]">MS</div><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">MS Ventures</p><p className="mt-0.5 text-xs text-muted-foreground">Private project space</p></div></div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-zinc-950 sm:text-5xl">Welcome back<span className="text-primary">.</span></h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">Continue managing your Kothanur construction project.</p>
            <div className="mt-10">
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
        <Button type="submit" className="mt-5 min-h-12 w-full justify-between rounded-xl bg-[#202b2d] px-4 text-sm text-white hover:bg-[#2c3b3d]" disabled={pending || !password}>
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
