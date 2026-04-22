import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { PageHeader } from "@/components/layout/app-shell";
import { toast } from "sonner";
import {
  ArrowUpRight, ArrowDownRight, Briefcase, Target, TrendingUp, DollarSign,
  Plus, FileText, Workflow, UserPlus, Mail, Phone, CreditCard, CheckCircle2,
  Calendar, Clock, User, MapPin, AlignLeft,
} from "lucide-react";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import {
  pipelineVelocityData, recentActivity, upcomingTasks,
  mockDeals, mockContacts, mockProjects, mockInvoices,
} from "@/lib/mock-data";

// Map each activity row to a concrete deep-link target.
// Picks real records from mock data so drawers open with valid IDs.
type ActivityLink =
  | { kind: "deal"; dealId: string }
  | { kind: "contact"; contactId: string }
  | { kind: "invoice"; invoiceId: string }
  | { kind: "project"; clientSlug: string }
  | { kind: "inbox" }
  | { kind: "workflows" };

const activityLinks: Record<number, ActivityLink> = {
  1: { kind: "deal", dealId: mockDeals[0]?.id ?? "" },              // signed proposal → deal drawer
  2: { kind: "contact", contactId: mockContacts[0]?.id ?? "" },     // new lead → contact drawer
  3: { kind: "invoice", invoiceId: mockInvoices[0]?.id ?? "" },     // paid invoice → invoices
  4: { kind: "inbox" },                                              // email reply → inbox
  5: { kind: "project", clientSlug: mockProjects[0]?.slug ?? "" },  // job complete → project page
  6: { kind: "workflows" },                                          // automation → workflows
};

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

type TaskDetail = {
  assignee: string;
  location?: string;
  description: string;
  related?: string;
  duration: string;
};

const taskDetails: Record<number, TaskDetail> = {
  1: { assignee: "Alex Romero", location: "14 Elm St., Brookline", description: "Walk through with homeowner to confirm scope for kitchen + half-bath remodel. Bring measuring kit and material samples.", related: "Deal: Elm St. Kitchen", duration: "1h 30m" },
  2: { assignee: "Priya Shah", description: "Send refined proposal v2 with updated tile selections and revised timeline. Reference last week's call notes.", related: "Deal: Thorne Residence", duration: "30m" },
  3: { assignee: "Priya Shah", description: "Call to confirm budget alignment and next-step site visit for the master bath remodel.", related: "Lead: Becker Family", duration: "20m" },
  4: { assignee: "Jamal Burke", description: "Place cabinet order with Apex Cabinetry — confirm finish (Matte Linen) and delivery to staging warehouse.", related: "Project: Miller Kitchen", duration: "45m" },
  5: { assignee: "Alex Romero", description: "Review Q4 pipeline forecast and revenue projections with leadership team.", duration: "1h" },
};

function priorityLabel(p: string) {
  return p === "high" ? "High priority" : p === "med" ? "Medium priority" : "Low priority";
}

function DashboardPage() {
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const activeTask = upcomingTasks.find((t) => t.id === activeTaskId) ?? null;
  const activeDetail = activeTaskId != null ? taskDetails[activeTaskId] : null;

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
                    formatter={(v) => [`$${Number(v).toLocaleString()}`, "Value moved"]}
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
              <QuickAction to={ROUTES.WORKFLOWS} icon={Workflow} label="Run Workflow" />
            </div>
            <Separator className="my-4" />
            <div className="mb-2 text-sm font-semibold">Upcoming Tasks</div>
            <div className="space-y-2">
              {upcomingTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTaskId(t.id)}
                  className="flex w-full items-start gap-2 rounded-md border border-border bg-card p-2.5 text-left transition-colors hover:border-border-strong hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    t.priority === "high" ? "bg-destructive" : t.priority === "med" ? "bg-warning" : "bg-muted-foreground/40"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">{t.time}</div>
                  </div>
                </button>
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
                <ActivityRow key={a.id} activity={a} link={activityLinks[a.id]} />
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

      <Sheet open={activeTaskId !== null} onOpenChange={(o) => !o && setActiveTaskId(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {activeTask && activeDetail && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    activeTask.priority === "high" ? "bg-destructive" : activeTask.priority === "med" ? "bg-warning" : "bg-muted-foreground/40"
                  }`} />
                  <Badge variant="secondary" className="text-[10px]">{priorityLabel(activeTask.priority)}</Badge>
                </div>
                <SheetTitle className="text-left">{activeTask.title}</SheetTitle>
                <SheetDescription className="text-left">Task details and context.</SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-4">
                <TaskFact icon={Calendar} label="When" value={activeTask.time} />
                <TaskFact icon={Clock} label="Duration" value={activeDetail.duration} />
                <TaskFact icon={User} label="Assigned to" value={activeDetail.assignee} />
                {activeDetail.location && <TaskFact icon={MapPin} label="Location" value={activeDetail.location} />}
                {activeDetail.related && <TaskFact icon={Briefcase} label="Related" value={activeDetail.related} />}

                <Separator />

                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AlignLeft className="h-3.5 w-3.5" /> Description
                  </div>
                  <p className="text-sm leading-relaxed">{activeDetail.description}</p>
                </div>
              </div>

              <SheetFooter className="mt-6 flex-row gap-2 sm:justify-end">
                <SheetClose asChild>
                  <Button variant="outline" size="sm">Close</Button>
                </SheetClose>
                <Button
                  size="sm"
                  onClick={() => {
                    toast.success("Task marked complete", { description: activeTask.title });
                    setActiveTaskId(null);
                  }}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark complete
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TaskFact({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <div className="text-[13px]">{value}</div>
      </div>
    </div>
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

function ActivityRow({
  activity,
  link,
}: {
  activity: { id: number; who: string; what: string; when: string; type: string };
  link?: ActivityLink;
}) {
  const content = (
    <>
      <ActivityIcon type={activity.type} />
      <div className="min-w-0 flex-1 text-left">
        <div className="text-[13px]">
          <span className="font-medium">{activity.who}</span>
          <span className="text-muted-foreground"> {activity.what}</span>
        </div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{activity.when}</div>
      </div>
    </>
  );

  const className =
    "flex w-full items-start gap-3 py-3 text-left transition-colors -mx-2 px-2 rounded-md hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none";

  if (!link) return <div className={className}>{content}</div>;

  switch (link.kind) {
    case "deal":
      return (
        <Link to="/sales/pipeline" search={{ dealId: link.dealId }} className={className}>
          {content}
        </Link>
      );
    case "contact":
      return (
        <Link to="/contacts" search={{ contactId: link.contactId }} className={className}>
          {content}
        </Link>
      );
    case "invoice":
      return (
        <Link to="/financials/invoices" className={className}>
          {content}
        </Link>
      );
    case "project":
      return (
        <Link to="/projects/$clientSlug" params={{ clientSlug: link.clientSlug }} className={className}>
          {content}
        </Link>
      );
    case "inbox":
      return (
        <Link to="/inbox" className={className}>
          {content}
        </Link>
      );
    case "workflows":
      return (
        <Link to={ROUTES.WORKFLOWS} className={className}>
          {content}
        </Link>
      );
  }
}
