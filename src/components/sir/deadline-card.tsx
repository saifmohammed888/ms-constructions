import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { daysUntil, deadlineStatus, type SirDeadline } from "@/lib/sir-data";
import { formatDate } from "@/lib/format";

export function DeadlineCard({ deadline }: { deadline: SirDeadline }) {
  const days = daysUntil(deadline.date);
  const status = deadlineStatus(deadline.date);

  return (
    <Card className={status === "urgent" ? "border-amber-300 bg-amber-50/60" : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{deadline.label}</CardTitle>
          {status === "past" ? (
            <Badge variant="secondary">Completed</Badge>
          ) : status === "urgent" ? (
            <Badge className="bg-amber-600 text-white hover:bg-amber-600">
              {days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} left`}
            </Badge>
          ) : (
            <Badge variant="outline">{days} days</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium text-emerald-900">{formatDate(deadline.date)}</p>
        <p className="text-muted-foreground">{deadline.description}</p>
      </CardContent>
    </Card>
  );
}
