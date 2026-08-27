import { ProjectShell } from "@/components/project-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ProjectShell>{children}</ProjectShell>;
}
