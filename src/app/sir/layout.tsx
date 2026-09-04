import { SirShell } from "@/components/sir/sir-shell";

export default function SirLayout({ children }: { children: React.ReactNode }) {
  return <SirShell>{children}</SirShell>;
}
