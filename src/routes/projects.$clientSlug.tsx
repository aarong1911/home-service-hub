import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  ArrowRight,
  MoreHorizontal,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  Check,
  Plus,
  Search,
  Upload,
  Bed,
  Bath as BathIcon,
  Home,
} from "lucide-react";
import {
  getProjectBySlug,
  projectStages,
  projectTasks,
  projectSubs,
  projectTeam,
  projectSelections,
  projectDocuments,
  projectPermits,
  projectInvoices,
  projectActivities,
  type Project,
  type ProjectStage,
  type ProjectTask,
} from "@/lib/mock-data";

export const Route = createFileRoute("/projects/$clientSlug")({
  loader: ({ params }) => {
    const project = getProjectBySlug(params.clientSlug);
    if (!project) throw notFound();
    return { project };
  },
  component: ProjectDetailPage,
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-sm text-muted-foreground">Project not found.</p>
      <Link to="/projects" className="mt-3 inline-block text-sm text-primary hover:underline">
        ← Back to Projects
      </Link>
    </div>
  ),
});

type TabKey =
  | "overview"
  | "financials"
  | "schedule"
  | "team"
  | "selections"
  | "documents"
  | "communications";

function ProjectDetailPage() {
  const { project } = Route.useLoaderData();
  const [tab, setTab] = useState<TabKey>("overview");

  const tasks = projectTasks[project.id] ?? [];
  const overdueCount = tasks.filter((t) => t.status === "overdue").length;
  const financialsBadge = projectInvoices[project.id]?.find((i) => i.status === "Overdue")?.daysOverdue;
  const selectionsCount = projectSelections[project.id]?.length ?? 0;
  const commsCount = 2;

  return (
    <>
      <PageHeader
        title=""
        breadcrumb={["Projects", project.status === "active" ? "Active Pipeline" : project.status === "on-hold" ? "On Hold" : "Cancelled", project.name]}
      />

      {/* Custom title row */}
      <div className="-mt-6 mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name} Remodel</h1>
            <StageInline stage={project.stage} />
            <Badge variant="secondary" className="h-6 rounded bg-pink-100 px-2 text-[11px] font-medium text-pink-700">
              {project.type}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {project.client} · {project.address} · #{project.projectNumber}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Message
          </Button>
          <Button size="sm" className="h-8">
            Advance Stage <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Top stat strip */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatBlock
          label="Budget"
          mainValue={`$${project.budget.toLocaleString()}`}
          mainTag={{ text: "on track", tone: "success" }}
          sub={`$${project.invoiced.toLocaleString()} invoiced · $${(project.budget - project.invoiced).toLocaleString()} remaining`}
        />
        <StatBlock
          label="Timeline"
          mainValue="Apr 25"
          mainTag={{ text: "7 days left", tone: "muted" }}
          sub={`Started Mar 15 · 42-day project`}
        />
        <StatBlock
          label="Completion"
          mainValue={`${project.progress}%`}
          mainTag={null}
          sub={null}
          progress={project.progress}
        />
        <StatBlock
          label="Team"
          mainValue=""
          mainTag={null}
          sub={`2 internal · 5 subs`}
          team
        />
      </div>

      {/* Stage Stepper */}
      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-medium text-muted-foreground">Stage:</span>
        {projectStages.map((s, i) => {
          const idx = projectStages.findIndex((x) => x.id === project.stage);
          const isPast = i < idx;
          const isCurrent = i === idx;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    isPast ? "border-success bg-success text-success-foreground" :
                    isCurrent ? "border-primary bg-primary text-primary-foreground" :
                    "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {isPast ? <Check className="h-2.5 w-2.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className={`text-xs ${isCurrent ? "font-semibold text-foreground" : isPast ? "text-success" : "text-muted-foreground"}`}>
                  {s.name}
                </span>
              </div>
              {i < projectStages.length - 1 && (
                <span className={`h-px w-12 ${isPast ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-5 border-b border-border">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")} label="Overview" />
        <TabBtn active={tab === "financials"} onClick={() => setTab("financials")} label="Financials" badge={financialsBadge ? `${financialsBadge}OD` : undefined} badgeTone="warning" />
        <TabBtn active={tab === "schedule"} onClick={() => setTab("schedule")} label="Schedule & Tasks" badge={String(tasks.length)} badgeTone="muted" />
        <TabBtn active={tab === "team"} onClick={() => setTab("team")} label="Team & Subs" />
        <TabBtn active={tab === "selections"} onClick={() => setTab("selections")} label="Selections" badge={String(selectionsCount)} badgeTone="primary" />
        <TabBtn active={tab === "documents"} onClick={() => setTab("documents")} label="Documents & Permits" />
        <TabBtn active={tab === "communications"} onClick={() => setTab("communications")} label="Communications" badge={String(commsCount)} badgeTone="destructive" />
      </div>

      {tab === "overview" && <OverviewTab project={project} overdueCount={overdueCount} />}
      {tab === "financials" && <FinancialsTab project={project} />}
      {tab === "schedule" && <ScheduleTab project={project} />}
      {tab === "team" && <TeamTab project={project} />}
      {tab === "selections" && <SelectionsTab project={project} />}
      {tab === "documents" && <DocumentsTab project={project} />}
      {tab === "communications" && <CommunicationsTab project={project} />}
    </>
  );
}

function TabBtn({
  active, onClick, label, badge, badgeTone = "muted",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
  badgeTone?: "muted" | "warning" | "destructive" | "primary";
}) {
  const toneCls =
    badgeTone === "warning" ? "bg-warning/15 text-warning"
    : badgeTone === "destructive" ? "bg-destructive/15 text-destructive"
    : badgeTone === "primary" ? "bg-primary/10 text-primary"
    : "bg-secondary text-muted-foreground";
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-1 py-2.5 text-sm font-medium transition-colors ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {badge && (
        <span className={`flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-semibold ${toneCls}`}>
          {badge}
        </span>
      )}
      {active && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" />}
    </button>
  );
}

function StageInline({ stage }: { stage: ProjectStage }) {
  const meta = projectStages.find((s) => s.id === stage)!;
  return (
    <Badge variant="secondary" className="h-6 rounded bg-success/15 px-2 text-[11px] font-medium text-success">
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-success" />
      {meta.name}
    </Badge>
  );
}

function StatBlock({
  label, mainValue, mainTag, sub, progress, team,
}: {
  label: string;
  mainValue: string;
  mainTag: { text: string; tone: "success" | "muted" } | null;
  sub: string | null;
  progress?: number;
  team?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      {team ? (
        <div className="mt-1.5 flex items-center -space-x-1.5">
          {["bg-purple-100 text-purple-700", "bg-emerald-100 text-emerald-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700"].map((c, i) => (
            <span key={i} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-semibold ${c}`}>
              {["RM", "JT", "MR", "TC"][i]}
            </span>
          ))}
          <span className="ml-2 flex h-7 items-center rounded-full bg-secondary px-2 text-[11px] font-medium text-muted-foreground">+3</span>
        </div>
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-xl font-semibold tracking-tight">{mainValue}</span>
          {mainTag && (
            <span className={`text-[11px] font-medium ${mainTag.tone === "success" ? "text-success" : "text-muted-foreground"}`}>
              {mainTag.text}
            </span>
          )}
        </div>
      )}
      {progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      )}
      {sub && <div className="mt-1.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

// ============= OVERVIEW =============
function OverviewTab({ project, overdueCount }: { project: Project; overdueCount: number }) {
  const activities = projectActivities[project.id] ?? [];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {overdueCount > 0 && (
          <Card className="border-warning/40 bg-warning/5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                <div>
                  <div className="text-sm font-semibold">2 items need attention</div>
                  <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    <li>• Glass shower door delivery coordination — 2 days overdue</li>
                    <li>• Invoice INV-2026-0118-03 unpaid for 6 days</li>
                  </ul>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs">
                <button className="text-primary hover:underline">Resolve</button>
                <button className="text-primary hover:underline">Send reminder</button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Scope & Details</h3>
            <button className="text-xs text-primary hover:underline">Edit</button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            <KV label="Project Type" value={`${project.type} Remodel`} />
            <KV label="Square Footage" value={`${project.squareFootage} sq ft`} />
            <KV label="Contract Value" value={`$${project.contractValue.toLocaleString()} (+$${project.approvedCO.toLocaleString()} approved CO)`} />
            <KV label="Payment Terms" value={project.paymentTerms} />
            <KV label="Site Access" value={project.siteAccess} />
            <KV label="Working Hours" value={project.workingHours} />
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-muted-foreground">Scope Summary</div>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">{project.scopeSummary}</p>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <button className="text-xs text-primary hover:underline">View all</button>
          </div>
          <ul className="mt-3 space-y-3">
            {activities.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${a.color}`}>
                  {a.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="font-semibold">{a.who}</span> <span className="text-foreground/80">{a.what}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{a.when}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold">Primary Contact</h3>
          <div className="mt-3 flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
              {project.client.split(" ").map((s) => s[0]).join("").slice(0, 2)}
            </span>
            <div>
              <div className="text-sm font-semibold">{project.client}</div>
              <div className="text-xs text-muted-foreground">Homeowner</div>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-xs">
            <li className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> <a href="#" className="text-primary hover:underline">{project.clientEmail}</a></li>
            <li className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {project.clientPhone}</li>
            <li className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {project.address.split(",")[0]}</li>
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs">Email</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs">SMS</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs">Call</Button>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold">Budget Snapshot</h3>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Spent of revised budget</span>
              <span className="font-semibold">{Math.round((project.spent / project.budget) * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${(project.spent / project.budget) * 100}%` }} />
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-xs">
            <Row label="Original estimate" value={`$${(project.budget - project.approvedCO).toLocaleString()}`} />
            <Row label="Approved changes" value={`+$${project.approvedCO.toLocaleString()}`} valueClass="text-success" />
            <Row label="Revised budget" value={`$${project.budget.toLocaleString()}`} bold />
            <Row label="Spent to date" value={`$${project.spent.toLocaleString()}`} />
            <Row label="Remaining" value={`$${(project.budget - project.spent).toLocaleString()}`} />
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold">Next Key Dates</h3>
          <ul className="mt-3 space-y-3">
            {[
              { mon: "APR", day: "20", title: "Glass shower door install", sub: "Lone Star Glass · 9 AM" },
              { mon: "APR", day: "22", title: "Final plumbing inspection", sub: "City of Austin · scheduled" },
              { mon: "APR", day: "25", title: "Target completion", sub: "Client walkthrough" },
            ].map((d) => (
              <li key={d.day} className="flex items-start gap-3">
                <div className="flex w-9 shrink-0 flex-col items-center rounded border border-border bg-secondary/60 py-1">
                  <span className="text-[9px] font-semibold text-muted-foreground">{d.mon}</span>
                  <span className="text-sm font-bold leading-none">{d.day}</span>
                </div>
                <div>
                  <div className="text-xs font-medium">{d.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{d.sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function Row({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return (
    <li className={`flex items-center justify-between ${bold ? "border-t border-border pt-2 font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${valueClass ?? ""}`}>{value}</span>
    </li>
  );
}

// ============= FINANCIALS =============
function FinancialsTab({ project }: { project: Project }) {
  const [sub, setSub] = useState<"invoices" | "estimates" | "change" | "payments" | "expenses">("invoices");
  const invoices = projectInvoices[project.id] ?? [];
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <FinKpi label="Revised Budget" value={`$${project.budget.toLocaleString()}`} sub={`$${(project.budget - project.approvedCO).toLocaleString()} + 1 CO`} />
        <FinKpi label="Invoiced" value={`$${project.invoiced.toLocaleString()}`} sub={`${Math.round((project.invoiced / project.budget) * 100)}% of budget`} />
        <FinKpi label="Paid" value={`$${project.paid.toLocaleString()}`} sub="3 payments received" />
        <FinKpi label="Outstanding" value={`$${(project.invoiced - project.paid).toLocaleString()}`} sub="1 overdue (6d)" subTone="destructive" />
        <FinKpi label="Est. Margin" value="21.4%" sub="↑ 1.2% vs estimate" subTone="success" />
      </div>

      <div className="mb-3 flex items-center gap-5 border-b border-border">
        {(["invoices", "estimates", "change", "payments", "expenses"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSub(k)}
            className={`relative px-1 py-2 text-sm font-medium ${sub === k ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {k === "invoices" ? "Invoices" : k === "estimates" ? "Estimates" : k === "change" ? "Change Orders 1" : k === "payments" ? "Payments" : "Expenses"}
            {sub === k && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {sub === "invoices" && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h3 className="text-sm font-semibold">Invoices</h3>
              <p className="text-xs text-muted-foreground">Progress billing against approved contract</p>
            </div>
            <Button size="sm" className="h-8"><Plus className="mr-1.5 h-3.5 w-3.5" /> New Invoice</Button>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Invoice #</th>
                <th className="px-4 py-2.5 text-left font-medium">Description</th>
                <th className="px-4 py-2.5 text-left font-medium">Sent</th>
                <th className="px-4 py-2.5 text-left font-medium">Due</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="h-12 border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-4 font-medium">{i.number}</td>
                  <td className="px-4 text-muted-foreground">{i.description}</td>
                  <td className="px-4 text-muted-foreground">{i.sent ?? "—"}</td>
                  <td className="px-4 text-muted-foreground">
                    {i.due ?? "—"} {i.daysOverdue && <span className="ml-1 text-destructive">({i.daysOverdue}d over)</span>}
                  </td>
                  <td className="px-4 text-right font-medium tabular-nums">${i.amount.toLocaleString()}</td>
                  <td className="px-4"><InvoiceStatus status={i.status} /></td>
                  <td className="px-4 text-right">
                    {i.status === "Overdue" ? (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs">Remind</Button>
                    ) : (
                      <button className="text-muted-foreground hover:text-foreground">…</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {sub !== "invoices" && (
        <Card className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No data yet for this view.
        </Card>
      )}
    </>
  );
}

function FinKpi({ label, value, sub, subTone }: { label: string; value: string; sub: string; subTone?: "success" | "destructive" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      <div className={`mt-0.5 text-[11px] ${subTone === "success" ? "text-success" : subTone === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>
        {sub}
      </div>
    </Card>
  );
}

function InvoiceStatus({ status }: { status: "Paid" | "Sent" | "Overdue" | "Draft" }) {
  const map = {
    Paid: "bg-success/15 text-success",
    Sent: "bg-primary/10 text-primary",
    Overdue: "bg-destructive/15 text-destructive",
    Draft: "bg-secondary text-muted-foreground",
  } as const;
  return (
    <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] font-medium ${map[status]}`}>
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${status === "Paid" ? "bg-success" : status === "Sent" ? "bg-primary" : status === "Overdue" ? "bg-destructive" : "bg-muted-foreground"}`} />
      {status}
    </Badge>
  );
}

// ============= SCHEDULE & TASKS =============
function ScheduleTab({ project }: { project: Project }) {
  const tasks = projectTasks[project.id] ?? [];
  const cols: { key: ProjectTask["status"]; label: string; tone: string }[] = [
    { key: "not-started", label: "Not Started", tone: "muted" },
    { key: "in-progress", label: "In Progress", tone: "primary" },
    { key: "overdue", label: "Overdue", tone: "destructive" },
    { key: "completed", label: "Completed", tone: "success" },
    { key: "on-hold", label: "On Hold", tone: "warning" },
  ];
  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <FinKpi label="Total Tasks" value={String(tasks.length)} sub="" />
        <FinKpi label="In Progress" value={String(tasks.filter((t) => t.status === "in-progress").length)} sub="" subTone="success" />
        <FinKpi label="Completed" value={String(tasks.filter((t) => t.status === "completed").length)} sub="" subTone="success" />
        <FinKpi label="Overdue" value={String(tasks.filter((t) => t.status === "overdue").length)} sub="" subTone="destructive" />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {["Kanban", "List", "Gantt", "Calendar"].map((v, i) => (
            <Button key={v} size="sm" variant={i === 0 ? "secondary" : "ghost"} className="h-8 text-xs">{v}</Button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">Status: All</span>
          <span className="text-xs text-muted-foreground">Owner: All</span>
        </div>
        <Button size="sm" className="h-8"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Task</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cols.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          const tint =
            col.tone === "destructive" ? "bg-destructive/5 border-destructive/20" :
            col.tone === "success" ? "bg-success/5 border-success/20" :
            col.tone === "warning" ? "bg-warning/5 border-warning/20" :
            col.tone === "primary" ? "bg-primary/5 border-primary/20" :
            "bg-secondary/40 border-border";
          return (
            <div key={col.key} className={`rounded-lg border ${tint}`}>
              <div className="flex items-center justify-between border-b border-current/10 px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${col.tone === "destructive" ? "bg-destructive" : col.tone === "success" ? "bg-success" : col.tone === "warning" ? "bg-warning" : col.tone === "primary" ? "bg-primary" : "bg-muted-foreground"}`} />
                  <span className="text-xs font-semibold">{col.label}</span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground">{colTasks.length}</span>
              </div>
              <div className="space-y-2 p-2 min-h-[120px]">
                {colTasks.map((t) => (
                  <div key={t.id} className={`rounded border border-border bg-card p-2.5 ${t.status === "completed" ? "opacity-60" : ""}`}>
                    <div className={`text-xs font-medium ${t.status === "completed" ? "line-through" : ""}`}>{t.title}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className={`text-[10px] ${t.status === "overdue" ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                        {t.status === "overdue" ? "2 days overdue" : `Due ${new Date(t.due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                      </span>
                      <span className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-semibold ${t.assigneeColor}`}>
                        {t.assigneeInitials}
                      </span>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div className="py-8 text-center text-[11px] text-muted-foreground">No tasks</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ============= TEAM & SUBS =============
function TeamTab({ project }: { project: Project }) {
  const team = projectTeam[project.id] ?? [];
  const subs = projectSubs[project.id] ?? [];
  return (
    <>
      <div className="mb-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Internal Team</h3>
            <p className="text-xs text-muted-foreground">Marquez Construction staff assigned to this project</p>
          </div>
          <Button variant="outline" size="sm" className="h-8">Assign Staff</Button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {team.map((m) => (
            <Card key={m.id} className="p-3">
              <div className="flex items-start gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold ${m.color}`}>
                  {m.initials}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.role}</div>
                  <div className="mt-2 flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]">Email</Button>
                    <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]">Call</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Subcontractors</h3>
            <p className="text-xs text-muted-foreground">Trade partners scheduled for this project</p>
          </div>
          <Button size="sm" className="h-8"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Sub</Button>
        </div>
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Trade</th>
                <th className="px-4 py-2.5 text-left font-medium">Company</th>
                <th className="px-4 py-2.5 text-left font-medium">Primary Contact</th>
                <th className="px-4 py-2.5 text-left font-medium">Scheduled</th>
                <th className="px-4 py-2.5 text-left font-medium">Insurance</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-4 py-3"><span className="text-xs font-semibold text-amber-700">{s.trade}</span></td>
                  <td className="px-4 py-3 font-medium">{s.company}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{s.contact}</div>
                    <div className="text-[11px] text-muted-foreground">{s.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.scheduled}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${s.insurance.status === "current" ? "text-success" : "text-warning"}`}>
                      {s.insurance.status === "current" ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {s.insurance.status === "current" ? "Current" : "Exp"} · exp {s.insurance.exp}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="h-5 rounded bg-secondary px-1.5 text-[10px]">{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

// ============= SELECTIONS =============
function SelectionsTab({ project }: { project: Project }) {
  const selections = projectSelections[project.id] ?? [];
  const total = selections.length;
  const pending = selections.filter((s) => s.client === "Pending").length;
  const installed = selections.filter((s) => s.status === "Installed").length;
  const ordered = selections.filter((s) => s.status.toLowerCase().includes("production") || s.status.toLowerCase().includes("arriving") || s.status.toLowerCase().includes("delivered")).length;

  // Group by room
  const rooms = selections.reduce<Record<string, typeof selections>>((acc, s) => {
    (acc[s.room] ||= []).push(s);
    return acc;
  }, {});

  const roomIcon = (room: string) => {
    if (room.toLowerCase().includes("bath")) return <BathIcon className="h-4 w-4" />;
    if (room.toLowerCase().includes("bedroom")) return <Bed className="h-4 w-4" />;
    return <Home className="h-4 w-4" />;
  };

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        <FinKpi label="Total Selections" value={String(total)} sub="" />
        <FinKpi label="Pending Approval" value={String(pending)} sub="" subTone="destructive" />
        <FinKpi label="In Production / Ordered" value={String(ordered)} sub="" />
        <FinKpi label="Installed" value={String(installed)} sub="" subTone="success" />
        <FinKpi label="Selection Budget" value="$24,640" sub="of $25,000 allowance" />
      </div>

      <div className="space-y-4">
        {Object.entries(rooms).map(([room, items]) => {
          const subtotal = items.reduce((s, i) => s + i.price, 0);
          const pendingFlag = items.some((i) => i.client === "Pending");
          return (
            <Card key={room} className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary">
                    {roomIcon(room)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{room}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {items.length} selection{items.length === 1 ? "" : "s"} · ${subtotal.toLocaleString()}
                      {pendingFlag && <span className="ml-1 text-warning">· awaiting client approval</span>}
                    </div>
                  </div>
                </div>
                <button className="text-xs text-primary hover:underline">+ Add selection</button>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Item</th>
                    <th className="px-4 py-2 text-left font-medium">Chosen Spec</th>
                    <th className="px-4 py-2 text-left font-medium">Vendor</th>
                    <th className="px-4 py-2 text-right font-medium">Price</th>
                    <th className="px-4 py-2 text-left font-medium">Client</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 font-medium">{s.item}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.spec}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.vendor}</td>
                      <td className="px-4 py-3 text-right tabular-nums">${s.price.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs ${s.client === "Approved" ? "text-success" : "text-warning"}`}>
                          {s.client === "Approved" ? "✓" : "⏱"} {s.client}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${s.status === "Installed" ? "bg-success/15 text-success" : s.status === "Awaiting approval" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}>
                          {s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ============= DOCUMENTS & PERMITS =============
function DocumentsTab({ project }: { project: Project }) {
  const docs = projectDocuments[project.id] ?? [];
  const permits = projectPermits[project.id] ?? [];
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
        <FinKpi label="Total" value={String(docs.length + permits.length + 55)} sub="" />
        <FinKpi label="Contracts" value="3" sub="" subTone="success" />
        <FinKpi label="Permits" value="3" sub="" subTone="success" />
        <FinKpi label="Blueprints" value="5" sub="" />
        <FinKpi label="Photos" value="47" sub="" subTone="success" />
        <FinKpi label="Other" value="5" sub="" />
      </div>

      <Card className="mb-4 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="text-sm font-semibold">Permits & Inspections</h3>
            <p className="text-xs text-muted-foreground">City of Austin · Project #2026-0341</p>
          </div>
          <button className="text-xs text-primary hover:underline">Manage</button>
        </div>
        <ul>
          {permits.map((p) => (
            <li key={p.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${p.status === "Approved" || p.status === "Rough passed" ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}>
                  <Check className="h-3 w-3" />
                </span>
                <div>
                  <div className="text-sm font-medium">{p.type}</div>
                  <div className="text-[11px] text-muted-foreground">{p.number} · {p.detail}</div>
                </div>
              </div>
              <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${p.status === "Approved" ? "bg-success/15 text-success" : p.status === "Rough passed" ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
                {p.status}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="h-8 text-xs">All Documents</Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search documents…" className="h-8 w-56 pl-8 text-xs" />
          </div>
        </div>
        <Button size="sm" className="h-8"><Upload className="mr-1.5 h-3.5 w-3.5" /> Upload Document</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Name</th>
              <th className="px-4 py-2.5 text-left font-medium">Category</th>
              <th className="px-4 py-2.5 text-left font-medium">Uploaded</th>
              <th className="px-4 py-2.5 text-left font-medium">Size</th>
              <th className="px-4 py-2.5 text-left font-medium">Shared with Client</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3"><Badge variant="secondary" className="h-5 rounded bg-secondary px-1.5 text-[10px]">{d.category}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{d.uploaded}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.size}</td>
                <td className={`px-4 py-3 text-xs ${d.shared ? "text-success" : "text-muted-foreground"}`}>
                  {d.shared ? "✓ Shared" : "Internal"}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">…</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Showing {docs.length} of 63
        </div>
      </Card>
    </>
  );
}

// ============= COMMUNICATIONS =============
function CommunicationsTab({ project: _project }: { project: Project }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <MessageSquare className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Project communications inbox coming soon.</p>
      <Button size="sm" className="h-8">Open in Inbox</Button>
    </Card>
  );
}
