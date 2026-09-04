import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineCard } from "@/components/sir/deadline-card";
import { SIR_DEADLINES, SIR_DOCUMENTS, SIR_FORMS, SIR_OFFICIAL_LINKS } from "@/lib/sir-data";

const STEPS = [
  {
    title: "Check the draft roll",
    body: "Search your name on the official CEO Karnataka draft roll. If rationalisation moved your booth, check neighbouring parts too.",
  },
  {
    title: "Respond before 23 Sep 2026",
    body: "File Form 6 if excluded, Form 8 for corrections, or Form 7 to object to wrongful inclusions. Online via NVSP or in person at your ERO/BLO.",
  },
  {
    title: "If you receive a notice",
    body: "BLOs deliver notices to your registered address with an inquiry/hearing date. Attendance is mandatory — carry documents and sign the attendance register.",
  },
  {
    title: "After rejection — appeal",
    body: "Appeal to the District Magistrate / Deputy Commissioner within 15 days, then to the CEO within 30 days if needed.",
  },
];

export default function SirGuidePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SIR process guide</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          What Karnataka voters should do during the Special Intensive Revision — from draft roll verification to notice
          hearings and appeals.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {STEPS.map((step, i) => (
          <Card key={step.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                  {i + 1}
                </span>
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{step.body}</CardContent>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Election forms</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SIR_FORMS.map((form) => (
            <Card key={form.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{form.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>{form.purpose}</p>
                <p className="text-xs text-muted-foreground">{form.when}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Documents to keep ready</h2>
        <Card>
          <CardContent className="grid gap-2 pt-6 sm:grid-cols-2">
            {SIR_DOCUMENTS.map((doc) => (
              <div key={doc} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                {doc}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Key dates</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SIR_DEADLINES.map((d) => (
            <DeadlineCard key={d.id} deadline={d} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Official links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {SIR_OFFICIAL_LINKS.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block underline-offset-2 hover:underline">
                {link.label}
              </a>
            ))}
          </CardContent>
        </Card>
        <Card className="flex flex-col justify-between bg-emerald-50/60">
          <CardHeader>
            <CardTitle className="text-base">Track your notices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Log each family member&apos;s notice status, hearing date, and document readiness in one place.
            </p>
            <Link href="/sir/track" className={buttonVariants({ className: "min-h-11 bg-emerald-700 hover:bg-emerald-800" })}>
              Open my notices <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
