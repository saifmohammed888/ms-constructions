"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";

export function ProjectShell({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      return res.json();
    },
  });
  return <AppShell projectName={data?.projectName || "My Construction"}>{children}</AppShell>;
}
