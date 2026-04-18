import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { mockInvoices, mockPayments, pipelineVelocityData } from "@/lib/mock-data";
import { formatMoney } from "@/lib/format";
import { TrendingUp, TrendingDown, ArrowUpRight, Wallet } from "lucide-react";

export const Route = createFileRoute("/financials/reports")({
  component: ReportsPage,
});

const PRIMARY = "oklch(0.55 0.205 262)";
const SUCCESS = "oklch(0.62 0.16 152)";
const WARNING = "oklch(0.74 0.16 70)";
const DESTRUCTIVE = "oklch(0.577 0.245 27)";
const CHART2 = "oklch(0.65 0.16 220)";
const CHART5 = "oklch(0.55 0.18 300)";

function ReportsPage() {
  const collected = mockPayments.reduce((s, p) => s + p.amount, 0);
  const invoiced = mockInvoices.reduce((s, i) => s + i.amount, 0);
  const outstanding = mockInvoices
    .filter((i) => i.status !== "Paid" && i.status !== "Draft")
    .reduce((s, i) => s + i.amount, 0);
  const collectionRate = Math.round((collected / Math.max(1, invoiced)) * 100);

  const methodTotals = mockPayments.reduce<Record<string, number>>((acc, p) => {
    acc[p.method] = (acc[p.method] ?? 0) + p.amount;
    return acc;
  }, {});
  const methodData = Object.entries(methodTotals).map(([name, value]) => ({ name, value }));
  const methodColors = [PRIMARY, CHART2, SUCCESS, CHART5];

  const aging: { label: string; amount: number; color: string }[] = [
    { label: "Current", amount: 48200, color: SUCCESS },
    { label: "1–30 days", amount: 18400, color: PRIMARY },
    { label: "31–60 days", amount: 7200, color: WARNING },
    { label: "60+ days", amount: 3100, color: DESTRUCTIVE },
  ];
  const agingMax = Math.max(...aging.map((a) => a.amount));

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Revenue (12w)" value={formatMoney(collected)} delta="+18%" tone="up" icon={Wallet} />
        <SummaryCard label="Invoiced (12w)" value={formatMoney(invoiced)} delta="+9%" tone="up" icon={ArrowUpRight} />
        <SummaryCard label="Outstanding" value={formatMoney(outstanding)} delta="-4%" tone="down" icon={TrendingDown} />
        <SummaryCard label="Collection rate" value={`${collectionRate}%`} delta="+3pp" tone="up" icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Revenue trend</div>
              <div className="text-xs text-muted-foreground">Collected payments by week</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: PRIMARY }} />
              <span className="text-muted-foreground">Revenue</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={pipelineVelocityData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => formatMoney(Number(v))}
                />
                <Area type="monotone" dataKey="value" stroke={PRIMARY} fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold">Payments by method</div>
            <div className="text-xs text-muted-foreground">Share of received funds</div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={methodData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={36}
                  outerRadius={64}
                  paddingAngle={2}
                  stroke="none"
                >
                  {methodData.map((_, i) => (
                    <Cell key={i} fill={methodColors[i % methodColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => formatMoney(Number(v))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
            {methodData.map((m, i) => (
              <div key={m.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: methodColors[i % methodColors.length] }} />
                <span className="text-muted-foreground">{m.name}</span>
                <span className="ml-auto font-medium tabular-nums">{formatMoney(m.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Aging summary</div>
              <div className="text-xs text-muted-foreground">Outstanding by bucket</div>
            </div>
            <div className="text-xs font-semibold tabular-nums">
              {formatMoney(aging.reduce((s, a) => s + a.amount, 0))}
            </div>
          </div>
          <div className="space-y-3">
            {aging.map((a) => (
              <div key={a.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className="font-medium tabular-nums">{formatMoney(a.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(a.amount / agingMax) * 100}%`, background: a.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold">Deals closed per week</div>
            <div className="text-xs text-muted-foreground">Volume of won deals</div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineVelocityData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="deals" fill={CHART2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  );
}

function SummaryCard({
  label,
  value,
  delta,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "up" | "down";
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
          <div className={"mt-0.5 text-[11px] font-medium " + (tone === "up" ? "text-success" : "text-destructive")}>
            {delta} vs prior
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
