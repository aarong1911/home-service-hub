import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ROUTES, workflowDetailLink } from "@/lib/routes";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Workflow as WorkflowIcon,
  Zap,
  Clock,
  Search,
  Sparkles,
  Filter,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Copy,
  Star,
  TrendingUp,
  Folder,
} from "lucide-react";
import {
  mockWorkflows,
  mockWorkflowTemplates,
  mockWorkflowRuns,
  type Workflow,
  type WorkflowCategory,
  type WorkflowTemplate,
  type WorkflowRun,
} from "@/lib/mock-data";

export const Route = createFileRoute("/automation/workflows/")({
  component: WorkflowsPage,
});

type Tab = "library" | "templates" | "history";

const NOW = Date.UTC(2026, 3, 18);

function WorkflowsPage() {
  const [tab, setTab] = useState<Tab>("library");

  const active = mockWorkflows.filter((w) => w.status === "active").length;
  const totalRuns = mockWorkflows.reduce((s, w) => s + w.runs, 0);
  const avgSuccess = Math.round(
    mockWorkflows.filter((w) => w.runs > 0).reduce((s, w) => s + w.successRate, 0) /
      mockWorkflows.filter((w) => w.runs > 0).length,
  );
  const failed24h = mockWorkflowRuns.filter((r) => r.status === "failed").length;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Workflows"
        subtitle={`${active} active automations · ${totalRuns.toLocaleString()} runs this month`}
        breadcrumb={["Automation", "Workflows"]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Build with AI
            </Button>
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Workflow
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={WorkflowIcon} label="Active" value={String(active)} sub={`${mockWorkflows.length} total`} />
        <Kpi icon={Zap} label="Runs this month" value={totalRuns.toLocaleString()} sub="+18% vs last" subTone="success" />
        <Kpi icon={TrendingUp} label="Avg. success" value={`${avgSuccess}%`} sub="across active" />
        <Kpi icon={XCircle} label="Failed (24h)" value={String(failed24h)} sub="needs review" subTone={failed24h > 2 ? "warning" : "muted"} />
      </div>

      {/* Tabs */}
      <div className="mb-3 flex items-center gap-1 border-b border-border">
        <TabBtn active={tab === "library"} onClick={() => setTab("library")} label="Library" count={mockWorkflows.length} />
        <TabBtn active={tab === "templates"} onClick={() => setTab("templates")} label="Templates" count={mockWorkflowTemplates.length} />
        <TabBtn active={tab === "history"} onClick={() => setTab("history")} label="Run History" count={mockWorkflowRuns.length} />
      </div>

      {tab === "library" && <LibraryView />}
      {tab === "templates" && <TemplatesView />}
      {tab === "history" && <HistoryView />}
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{count}</span>
      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
    </button>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  subTone = "muted",
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  sub: string;
  subTone?: "muted" | "success" | "warning";
}) {
  const subCls = subTone === "success" ? "text-success" : subTone === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      <div className={`text-[11px] ${subCls}`}>{sub}</div>
    </Card>
  );
}

/* ========== LIBRARY ========== */

function LibraryView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "draft">("all");
  const [categoryFilter, setCategoryFilter] = useState<WorkflowCategory | "all">("all");

  const filtered = useMemo(
    () =>
      mockWorkflows.filter((w) => {
        if (statusFilter !== "all" && w.status !== statusFilter) return false;
        if (categoryFilter !== "all" && w.category !== categoryFilter) return false;
        if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [search, statusFilter, categoryFilter],
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workflows…" className="h-8 pl-7 text-xs" />
        </div>
        <FilterPill label="Status" options={["all", "active", "paused", "draft"]} value={statusFilter} onChange={(v) => setStatusFilter(v as typeof statusFilter)} />
        <FilterPill
          label="Category"
          options={["all", "Sales", "Operations", "Finance", "Marketing", "Client Care"]}
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v as typeof categoryFilter)}
        />
        <Button variant="outline" size="sm" className="ml-auto h-8 text-xs">
          <Filter className="mr-1.5 h-3.5 w-3.5" /> More filters
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2 text-left font-medium">On</th>
              <th className="px-3 py-2 text-left font-medium">Workflow</th>
              <th className="px-3 py-2 text-left font-medium">Trigger</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-left font-medium">Owner</th>
              <th className="px-3 py-2 text-right font-medium">Runs</th>
              <th className="px-3 py-2 text-right font-medium">Success</th>
              <th className="px-3 py-2 text-left font-medium">Last run</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <WorkflowRow key={w.id} w={w} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No workflows match these filters.</div>
        )}
      </Card>
    </>
  );
}

function WorkflowRow({ w }: { w: Workflow }) {
  return (
    <tr className="h-12 border-b border-border last:border-b-0 hover:bg-secondary/30">
      <td className="px-3" onClick={(e) => e.stopPropagation()}>
        <Switch defaultChecked={w.status === "active"} />
      </td>
      <td className="px-3">
        <Link {...workflowDetailLink(w.id)} className="group flex items-center gap-2">
          <span className="font-medium group-hover:text-primary">{w.name}</span>
          {w.status === "active" && <Badge variant="secondary" className="h-4 rounded bg-success/15 px-1.5 text-[9px] text-success">Live</Badge>}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Folder className="h-2.5 w-2.5" /> {w.folder}
        </div>
      </td>
      <td className="px-3 text-xs text-muted-foreground">{w.trigger}</td>
      <td className="px-3">
        <CategoryChip category={w.category} />
      </td>
      <td className="px-3">
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="bg-secondary text-[9px] font-semibold">{w.ownerInitials}</AvatarFallback>
          </Avatar>
          <span className="text-xs">{w.owner.split(" ")[0]}</span>
        </div>
      </td>
      <td className="px-3 text-right tabular-nums text-sm">{w.runs.toLocaleString()}</td>
      <td className="px-3 text-right">
        <SuccessBar value={w.successRate} runs={w.runs} />
      </td>
      <td className="px-3 text-xs text-muted-foreground">{formatDate(w.lastRun)}</td>
      <td className="px-2">
        <Button variant="ghost" size="sm" className="h-7 px-1.5">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function SuccessBar({ value, runs }: { value: number; runs: number }) {
  if (runs === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const tone = value >= 90 ? "bg-success" : value >= 70 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}

function CategoryChip({ category }: { category: WorkflowCategory }) {
  const map: Record<WorkflowCategory, string> = {
    Sales: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
    Operations: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900",
    Finance: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    Marketing: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
    "Client Care": "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  };
  return <Badge variant="outline" className={`h-5 rounded-md px-1.5 text-[10px] ${map[category]}`}>{category}</Badge>;
}

function FilterPill({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border bg-card p-0.5">
      <span className="px-2 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
            value === o ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
          }`}
        >
          {o === "all" ? "All" : o}
        </button>
      ))}
    </div>
  );
}

/* ========== TEMPLATES ========== */

function TemplatesView() {
  const [category, setCategory] = useState<WorkflowCategory | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = mockWorkflowTemplates.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const featured = filtered.filter((t) => t.featured);
  const rest = filtered.filter((t) => !t.featured);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" className="h-8 pl-7 text-xs" />
        </div>
        <FilterPill
          label="Category"
          options={["all", "Sales", "Operations", "Finance", "Marketing", "Client Care"]}
          value={category}
          onChange={(v) => setCategory(v as typeof category)}
        />
      </div>

      {featured.length > 0 && (
        <>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> Featured
          </div>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((t) => (
              <TemplateCard key={t.id} t={t} featured />
            ))}
          </div>
        </>
      )}

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">All templates</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {rest.map((t) => (
          <TemplateCard key={t.id} t={t} />
        ))}
      </div>
    </>
  );
}

function TemplateCard({ t, featured }: { t: WorkflowTemplate; featured?: boolean }) {
  return (
    <Card className={`flex flex-col p-4 transition-all hover:border-primary/40 hover:shadow-md ${featured ? "ring-1 ring-amber-200 dark:ring-amber-900/50" : ""}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <CategoryChip category={t.category} />
        <span className="text-[10px] tabular-nums text-muted-foreground">{t.installs.toLocaleString()} installs</span>
      </div>
      <div className="text-sm font-semibold leading-snug">{t.name}</div>
      <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
      <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" /> {t.trigger}</span>
        <span>·</span>
        <span>{t.steps} steps</span>
      </div>
      <div className="mt-3 flex gap-1.5">
        <Button size="sm" className="h-7 flex-1 text-xs">
          <Copy className="mr-1 h-3 w-3" /> Use template
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs">Preview</Button>
      </div>
    </Card>
  );
}

/* ========== HISTORY ========== */

function HistoryView() {
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed" | "running">("all");
  const filtered = mockWorkflowRuns.filter((r) => statusFilter === "all" || r.status === statusFilter);

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <FilterPill label="Status" options={["all", "success", "failed", "running"]} value={statusFilter} onChange={(v) => setStatusFilter(v as typeof statusFilter)} />
        <span className="ml-auto text-[11px] text-muted-foreground">{filtered.length} runs · last 14 days</span>
      </div>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2 text-left font-medium">Workflow</th>
              <th className="px-3 py-2 text-left font-medium">Contact</th>
              <th className="px-3 py-2 text-left font-medium">Started</th>
              <th className="px-3 py-2 text-right font-medium">Duration</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const wf = mockWorkflows.find((w) => w.id === r.workflowId);
              return <RunRow key={r.id} r={r} workflowName={wf?.name ?? r.workflowId} />;
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function RunRow({ r, workflowName }: { r: WorkflowRun; workflowName: string }) {
  return (
    <tr className="h-11 border-b border-border last:border-b-0 hover:bg-secondary/30">
      <td className="px-3"><RunStatusGlyph status={r.status} /></td>
      <td className="px-3 text-sm font-medium">{workflowName}</td>
      <td className="px-3 text-xs text-muted-foreground">{r.contact}</td>
      <td className="px-3 text-xs text-muted-foreground">{formatDateTime(r.startedAt)}</td>
      <td className="px-3 text-right text-xs tabular-nums text-muted-foreground">{(r.durationMs / 1000).toFixed(1)}s</td>
      <td className="px-3"><RunStatusBadge status={r.status} /></td>
      <td className="px-2"><Button variant="ghost" size="sm" className="h-7 px-1.5"><ChevronRight className="h-3.5 w-3.5" /></Button></td>
    </tr>
  );
}

function RunStatusGlyph({ status }: { status: WorkflowRun["status"] }) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
}

function RunStatusBadge({ status }: { status: WorkflowRun["status"] }) {
  const map = {
    success: ["bg-success/15 text-success", "Success"],
    failed: ["bg-destructive/15 text-destructive", "Failed"],
    running: ["bg-primary-soft text-primary", "Running"],
  } as const;
  const [cls, label] = map[status];
  return <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${cls}`}>{label}</Badge>;
}

function formatDate(iso: string) {
  if (iso === "—") return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso));
}
function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso));
}
// Touch NOW so import is not stripped by linter
void NOW;
