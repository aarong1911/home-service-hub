import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/app-shell";
import {
  ArrowUpRight, ArrowDownRight, Briefcase, Target, TrendingUp, DollarSign,
  Plus, FileText, Workflow, UserPlus, Mail, Phone, CreditCard, CheckCircle2,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { pipelineVelocityData, recentActivity, upcomingTasks } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

const kpis = [
  {
    label: "Active Projects", value: "12", delta: "+2", trend: "up" as const,
    icon: Briefcase, href: "/projects",
    spark: [4, 5, 4, 6, 7, 6, 8, 9, 10, 11, 12, 12],
  },
  {
    label: "Open Leads", value: "47", delta: "+12.4%", trend: "up" as const,
    icon: Target, href: "/leads",
    spark: [22, 24, 28, 26, 30, 33, 35, 38, 40, 42, 45, 47],
  },
  {
    label: "Pipeline Value", value: "$684,200", delta: "+8.2%", trend: "up" as const,
    icon: TrendingUp, href: "/sales/pipeline",
    spark: [420, 460, 470, 510, 530, 560, 590, 605, 620, 640, 670, 684],
  },
  {
    label: "Revenue MTD", value: "$184,750", delta: "-2.1%", trend: "down" as const,
    icon: DollarSign, href: "/financials/invoices",
    spark: [200, 195, 198, 188, 190, 192, 188, 185, 184, 186, 185, 184],
  },
];

function formatDate() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Welcome back, Alex"
        subtitle={`Today is ${formatDate()} — here's what's happening at RenoMeta Builders.`}
        actions={
          <>
            <Button variant="outline" size="sm">
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Deal
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const TrendIcon = k.trend === "up" ? ArrowUpRight : ArrowDownRight;
          return (
            <Link key={k.label} to={k.href} className="group">
              <Card className="border-border transition-shadow hover:shadow-[var(--shadow-elev-2)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                      {k.label}
                    </div>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-semibold tracking-tight tabular-nums">{k.value}</div>
                      <div className={`mt-0.5 flex items-center gap-0.5 text-xs font-medium ${
                        k.trend === "up" ? "text-success" : "text-destructive"
                      }`}>
                        <TrendIcon className="h-3 w-3" />
                        {k.delta}
                        <span className="ml-1 font-normal text-muted-foreground">vs last period</span>
                      </div>
                    </div>
                    <div className="h-10 w-20">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={k.spark.map((v, i) => ({ i, v }))}>
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={k.trend === "up" ? "var(--color-primary)" : "var(--color-destructive)"}
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Velocity + Quick actions */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Pipeline Velocity</div>
                <div className="text-xs text-muted-foreground">Weighted value moved through stages — last 90 days</div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs">30d</Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs">90d</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs">1y</Button>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pipelineVelocityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="velocity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Value moved"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} fill="url(#velocity)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 text-sm font-semibold">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction to="/contacts" icon={UserPlus} label="New Contact" />
              <QuickAction to="/sales/pipeline" icon={Plus} label="New Deal" />
              <QuickAction to="/financials/estimates" icon={FileText} label="New Estimate" />
              <QuickAction to="/automation/workflows" icon={Workflow} label="Run Workflow" />
            </div>
            <Separator className="my-4" />
            <div className="mb-2 text-sm font-semibold">Upcoming Tasks</div>
            <div className="space-y-2">
              {upcomingTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2 rounded-md border border-border bg-card p-2.5">
                  <div className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    t.priority === "high" ? "bg-destructive" : t.priority === "med" ? "bg-warning" : "bg-muted-foreground/40"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">{t.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Recent Activity</div>
              <Button variant="ghost" size="sm" className="h-7 text-xs">View all</Button>
            </div>
            <div className="divide-y divide-border">
              {recentActivity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-3">
                  <ActivityIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px]">
                      <span className="font-medium">{a.who}</span>
                      <span className="text-muted-foreground"> {a.what}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{a.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Team Today</div>
              <Badge variant="secondary" className="text-[10px]">5 online</Badge>
            </div>
            <div className="space-y-2.5">
              {[
                { name: "Alex Romero", role: "Owner", status: "On site · Maple St." },
                { name: "Priya Shah", role: "Sales Lead", status: "Following up · 4 leads" },
                { name: "Jamal Burke", role: "Project Manager", status: "Reviewing estimates" },
                { name: "Mei Lin", role: "Estimator", status: "Site visit · 3pm" },
              ].map((m) => (
                <div key={m.name} className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary-soft text-[10px] font-medium text-primary">
                      {m.name.split(" ").map((p) => p[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">
                      {m.name}
                      <span className="text-[11px] font-normal text-muted-foreground">· {m.role}</span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{m.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-start gap-1.5 rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-border-strong hover:bg-secondary"
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="text-[12px] font-medium">{label}</div>
    </Link>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, { Icon: React.ComponentType<{ className?: string }>; color: string }> = {
    deal: { Icon: TrendingUp, color: "text-primary bg-primary-soft" },
    lead: { Icon: Target, color: "text-primary bg-primary-soft" },
    payment: { Icon: CreditCard, color: "text-success bg-success/10" },
    email: { Icon: Mail, color: "text-muted-foreground bg-muted" },
    project: { Icon: CheckCircle2, color: "text-success bg-success/10" },
    automation: { Icon: Workflow, color: "text-warning bg-warning/10" },
    sms: { Icon: Phone, color: "text-muted-foreground bg-muted" },
  };
  const { Icon, color } = map[type] ?? map.email;
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${color}`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}
