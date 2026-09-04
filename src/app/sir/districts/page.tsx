"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SIR_DISTRICTS, SIR_STATE_STATS, formatIndianNumber } from "@/lib/sir-data";

const REGIONS = [...new Set(SIR_DISTRICTS.map((d) => d.region))];

export default function SirDistrictsPage() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("all");

  const filtered = useMemo(() => {
    return SIR_DISTRICTS.filter((d) => {
      const matchesQuery = !query || d.name.toLowerCase().includes(query.toLowerCase());
      const matchesRegion = region === "all" || d.region === region;
      return matchesQuery && matchesRegion;
    }).sort((a, b) => b.notices - a.notices);
  }, [query, region]);

  const maxNotices = SIR_DISTRICTS[0]?.notices ?? 1;
  const bengaluruTotal = SIR_DISTRICTS.filter((d) => d.region === "Bengaluru").reduce((s, d) => s + d.notices, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">District-wise notices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Published figures for voters receiving SIR discrepancy notices ({formatIndianNumber(SIR_STATE_STATS.noticesTotal)} statewide).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 text-sm">
            <p className="text-muted-foreground">Statewide notices</p>
            <p className="mt-1 text-2xl font-semibold">{formatIndianNumber(SIR_STATE_STATS.noticesTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-sm">
            <p className="text-muted-foreground">Bengaluru region</p>
            <p className="mt-1 text-2xl font-semibold">{formatIndianNumber(bengaluruTotal)}</p>
            <p className="text-xs text-muted-foreground">
              {((bengaluruTotal / SIR_STATE_STATS.noticesTotal) * 100).toFixed(1)}% of all notices
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-sm">
            <p className="text-muted-foreground">Lowest (published)</p>
            <p className="mt-1 text-2xl font-semibold">Davanagere · 7,088</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search district…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-11 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRegion("all")}
            className={`min-h-10 rounded-full px-3 text-xs font-medium ${region === "all" ? "bg-emerald-700 text-white" : "bg-muted text-muted-foreground"}`}
          >
            All regions
          </button>
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={`min-h-10 rounded-full px-3 text-xs font-medium ${region === r ? "bg-emerald-700 text-white" : "bg-muted text-muted-foreground"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Districts with published notice counts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No districts match your search.</p>
          ) : (
            filtered.map((d) => (
              <div key={d.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{d.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {d.region}
                    </Badge>
                  </div>
                  <span className="font-semibold tabular-nums">{formatIndianNumber(d.notices)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all"
                    style={{ width: `${(d.notices / maxNotices) * 100}%` }}
                  />
                </div>
              </div>
            ))
          )}
          <p className="text-xs text-muted-foreground">
            Figures sourced from Karnataka CEO press releases and published media reports (Aug 2026). Other districts
            are receiving notices but detailed counts were not yet published when this tracker was built.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
