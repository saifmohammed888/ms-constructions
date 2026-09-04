import Link from "next/link";
import { ArrowRight, ExternalLink, Users, FileWarning, MapPinned } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineCard } from "@/components/sir/deadline-card";
import {
  SIR_DEADLINES,
  SIR_OFFICIAL_LINKS,
  SIR_STATE_STATS,
  formatIndianNumber,
  daysUntil,
} from "@/lib/sir-data";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-emerald-900">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function SirOverviewPage() {
  const stats = SIR_STATE_STATS;
  const claimsDays = daysUntil("2026-09-23");
  const urgentDeadlines = SIR_DEADLINES.filter((d) => daysUntil(d.date) >= 0).slice(0, 3);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 text-white shadow-lg md:p-8">
        <p className="text-sm font-medium text-emerald-100/90">Karnataka · Chief Electoral Office</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          Track SIR notices &amp; deadlines
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-50/90 md:text-base">
          The Special Intensive Revision (SIR) draft roll was published on 24 Aug 2026. About{" "}
          {formatIndianNumber(stats.noticesTotal)} voters will receive discrepancy notices. Use this tracker to
          monitor key dates, district numbers, and your family&apos;s notice status.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sir/track"
            className={buttonVariants({
              className: "min-h-11 bg-white text-emerald-900 hover:bg-emerald-50",
            })}
          >
            Track my notices <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/sir/guide"
            className={buttonVariants({
              variant: "outline",
              className: "min-h-11 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white",
            })}
          >
            What to do next
          </Link>
        </div>
        {claimsDays >= 0 && (
          <p className="mt-4 text-sm font-medium text-amber-200">
            {claimsDays === 0
              ? "Claims & objections close today."
              : `${claimsDays} day${claimsDays === 1 ? "" : "s"} left to file claims & objections (till 23 Sep 2026).`}
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Draft roll electors"
          value={formatIndianNumber(stats.draftRollElectors)}
          sub="Included in first draft roll"
        />
        <StatTile
          label="ASDDO entries"
          value={formatIndianNumber(stats.asddoTotal)}
          sub="Absent, shifted, dead, duplicate, other"
        />
        <StatTile
          label="Discrepancy notices"
          value={formatIndianNumber(stats.noticesTotal)}
          sub={`${formatIndianNumber(stats.noticesLogicalDiscrepancy)} logical · ${formatIndianNumber(stats.noticesNoMapping)} no-mapping`}
        />
        <StatTile
          label="Polling stations"
          value={formatIndianNumber(stats.pollingStations)}
          sub="Up from 59,050 after rationalisation"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileWarning className="size-4 text-amber-600" />
              Upcoming deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {urgentDeadlines.map((d) => (
              <DeadlineCard key={d.id} deadline={d} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-emerald-700" />
              ASDDO breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {stats.asddoBreakdown.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium">{formatIndianNumber(row.count)}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              ASDDO entries can still seek reinstatement via claims during the active window.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Official resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {SIR_OFFICIAL_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-colors hover:bg-muted/60"
              >
                <ExternalLink className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                <span>
                  <span className="font-medium">{link.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{link.note}</span>
                </span>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPinned className="size-4 text-emerald-700" />
              Bengaluru concentration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Over <strong>24 lakh</strong> of Karnataka&apos;s 43.8 lakh SIR notices are in the Bengaluru region —
              check neighbouring booths when searching the draft roll; rationalisation may have moved your polling station.
            </p>
            <Link href="/sir/districts" className={buttonVariants({ variant: "outline", className: "min-h-11" })}>
              View district-wise numbers
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
