import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pipelineVelocityData } from "@/lib/mock-data";

export const Route = createFileRoute("/financials/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold">Revenue (last 12 weeks)</div>
          <div className="text-xs text-muted-foreground">Collected payments by week</div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={pipelineVelocityData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.55 0.205 262)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.55 0.205 262)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="oklch(0.55 0.205 262)" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="p-4">
        <div className="mb-3 text-sm font-semibold">Aging summary</div>
        <div className="space-y-3 text-sm">
          {[
            ["Current", 48200, "bg-success"],
            ["1–30 days", 18400, "bg-primary"],
            ["31–60 days", 7200, "bg-warning"],
            ["60+ days", 3100, "bg-destructive"],
          ].map(([label, amount, color]) => (
            <div key={label as string}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">${(amount as number).toLocaleString()}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className={`h-full ${color as string}`} style={{ width: `${((amount as number) / 48200) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
