import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Calendar as CalendarIcon,
  Download,
  AlertCircle,
  Search,
  Star,
} from "lucide-react";
import {
  mockProjects,
  projectStages,
  type Project,
  type ProjectStage,
  type ProjectStatus,
} from "@/lib/mock-data";

function formatUtcDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(value));
}

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
});

type Tab = "active" | "on-hold" | "cancelled" | "archived";
type View = "board" | "list" | "calendar";

function ProjectsPage() {
  const [tab, setTab] = useState<Tab>("active");
  const [view, setView] = useState<View>("board");
  const [projects, setProjects] = useState<Project[]>(mockProjects);

  const counts = useMemo(() => {
    const active = projects.filter((p) => p.status === "active" && !p.archived).length;
    const onHold = projects.filter((p) => p.status === "on-hold").length;
    const cancelled = projects.filter((p) => p.status === "cancelled").length;
    const archived = projects.filter((p) => p.archived).length;
    return { active, onHold, cancelled, archived };
  }, [projects]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === draggableId ? { ...p, stage: destination.droppableId as ProjectStage } : p,
      ),
    );
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <PageHeader
        title="Projects"
        subtitle={`Track renovations from estimate through warranty. ${counts.active} active across 6 stages.`}
        breadcrumb={["Workspace", "Projects"]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Project
            </Button>
          </>
        }
      />

      {/* Tabs + view switcher */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1">
          <TabPill active={tab === "active"} onClick={() => setTab("active")} label="Active Pipeline" count={counts.active} tone="primary" />
          <TabPill active={tab === "on-hold"} onClick={() => setTab("on-hold")} label="On Hold" count={counts.onHold} tone="warning" />
          <TabPill active={tab === "cancelled"} onClick={() => setTab("cancelled")} label="Cancelled" count={counts.cancelled} tone="destructive" />
          <TabPill active={tab === "archived"} onClick={() => setTab("archived")} label="Archived" count={counts.archived} tone="muted" />
        </div>

        <div className="flex items-center gap-2">
          {tab === "active" && (
            <div className="flex h-8 items-center rounded-md border border-border bg-card p-0.5">
              <ViewBtn active={view === "board"} onClick={() => setView("board")} icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Board" />
              <ViewBtn active={view === "list"} onClick={() => setView("list")} icon={<ListIcon className="h-3.5 w-3.5" />} label="List" />
              <ViewBtn active={view === "calendar"} onClick={() => setView("calendar")} icon={<CalendarIcon className="h-3.5 w-3.5" />} label="Calendar" />
            </div>
          )}
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="mr-1.5 h-3.5 w-3.5" /> Filters
          </Button>
          <Button variant="outline" size="sm" className="h-8">
            Owner: All
          </Button>
        </div>
      </div>

      {tab === "active" && (
        <ActiveView view={view} projects={projects} onDragEnd={onDragEnd} />
      )}
      {tab === "on-hold" && <OnHoldView projects={projects.filter((p) => p.status === "on-hold")} />}
      {tab === "cancelled" && <CancelledView projects={projects.filter((p) => p.status === "cancelled")} />}
      {tab === "archived" && <ArchivedView projects={projects.filter((p) => p.archived)} />}
    </div>
  );
}

function TabPill({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "primary" | "warning" | "destructive" | "muted";
}) {
  const toneCls =
    tone === "primary" ? "bg-primary/10 text-primary"
    : tone === "warning" ? "bg-warning/15 text-warning"
    : tone === "destructive" ? "bg-destructive/15 text-destructive"
    : "bg-secondary text-muted-foreground";
  return (
    <button
      onClick={onClick}
      className={`flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
      }`}
    >
      {label}
      <span className={`flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-semibold ${active ? "bg-white/20 text-primary-foreground" : toneCls}`}>
        {count}
      </span>
    </button>
  );
}

function ViewBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Button size="sm" variant={active ? "secondary" : "ghost"} onClick={onClick} className="h-7 gap-1.5 px-2 text-xs">
      {icon}
      {label}
    </Button>
  );
}

function ActiveView({
  view,
  projects,
  onDragEnd,
}: {
  view: View;
  projects: Project[];
  onDragEnd: (r: DropResult) => void;
}) {
  const active = projects.filter((p) => p.status === "active" && !p.archived);
  const totalValue = active.reduce((s, p) => s + p.budget, 0);
  const onHoldCount = projects.filter((p) => p.status === "on-hold").length;

  return (
    <>
      {/* KPI Strip */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Active Pipeline Value"
          value={`$${(totalValue / 1_000_000).toFixed(2)}M`}
          sub={`Across ${active.length} projects`}
        />
        <Kpi
          label="Avg Project Value"
          value={`$${Math.round(totalValue / Math.max(active.length, 1)).toLocaleString()}`}
          sub="↑ 8.2% vs last quarter"
          subTone="success"
        />
        <Kpi label="Avg Cycle Time" value="42 days" sub="Contracted → Completed" />
        <Kpi
          label="On Hold Projects"
          value={String(onHoldCount)}
          sub=">14 days without activity"
          valueTone="warning"
          valuePrefix="Needs attention"
        />
      </div>

      {view === "board" && <BoardView projects={active} onDragEnd={onDragEnd} />}
      {view === "list" && <ListView projects={active} />}
      {view === "calendar" && (
        <Card className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <CalendarIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Calendar view coming soon.</p>
        </Card>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  subTone,
  valueTone,
  valuePrefix,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "success" | "muted";
  valueTone?: "warning";
  valuePrefix?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tracking-tight ${valueTone === "warning" ? "text-warning" : ""}`}>{value}</span>
        {valuePrefix && <span className="text-xs font-medium text-warning">{valuePrefix}</span>}
      </div>
      {sub && (
        <div className={`mt-1 text-xs ${subTone === "success" ? "text-success" : "text-muted-foreground"}`}>
          {sub}
        </div>
      )}
    </Card>
  );
}

function BoardView({ projects, onDragEnd }: { projects: Project[]; onDragEnd: (r: DropResult) => void }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="-mx-6 flex min-h-0 flex-1 flex-col overflow-hidden px-6">
        <div className="flex-1 overflow-x-scroll overflow-y-hidden pb-3 [scrollbar-gutter:stable]">
          <div className="flex h-[calc(100vh-19rem)] min-h-[24rem] min-w-max gap-3">
          {projectStages.map((stage) => {
            const stageProjects = projects.filter((p) => p.stage === stage.id);
            const stageTotal = stageProjects.reduce((s, p) => s + p.budget, 0);
            return (
              <div key={stage.id} className="flex h-full w-[300px] shrink-0 flex-col rounded-lg bg-secondary/40">
                {/* Stage header */}
                <div className="border-b border-border px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StageDot color={stage.color} />
                      <span className="text-xs font-semibold text-foreground">{stage.name}</span>
                      <span className="rounded bg-secondary px-1.5 text-[10px] font-medium text-muted-foreground">
                        {stageProjects.length}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      ${stageTotal >= 1000 ? `${Math.round(stageTotal / 1000)}K` : stageTotal}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{stage.sub}</div>
                </div>

                {/* Cards */}
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-2 overflow-y-auto p-2 ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
                    >
                        {stageProjects.map((p, idx) => (
                        <Draggable key={p.id} draggableId={p.id} index={idx}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                                className={snap.isDragging ? "rotate-1" : undefined}
                            >
                                <Link
                                  to="/projects/$clientSlug"
                                  params={{ clientSlug: p.slug }}
                                  className="block cursor-pointer"
                                  draggable={false}
                                  onClick={(event) => {
                                    if (snap.isDragging) {
                                      event.preventDefault();
                                    }
                                  }}
                                >
                                  <ProjectCard project={p} />
                                </Link>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      <button className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border bg-card/50 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
                        <Plus className="h-3 w-3" /> Add project
                      </button>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </DragDropContext>
  );
}

function StageDot({ color }: { color: string }) {
  const map: Record<string, string> = {
    muted: "bg-muted-foreground",
    primary: "bg-primary",
    amber: "bg-amber-500",
    success: "bg-success",
    warning: "bg-warning",
  };
  return <span className={`h-2 w-2 rounded-full ${map[color] ?? "bg-muted-foreground"}`} />;
}

function ProjectCard({ project }: { project: Project }) {
  const accent =
    project.banner === "over-budget" ? "border-l-4 border-l-destructive"
    : project.banner === "stuck" ? "border-l-4 border-l-amber-500"
    : "";
  return (
    <Card className={`group p-3 transition-shadow hover:shadow-[var(--shadow-elev-2)] ${accent}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-[13px] font-semibold text-foreground group-hover:text-primary">
          {project.name}
        </div>
        <span className="shrink-0 text-[10px] font-medium text-muted-foreground tabular-nums">{project.ageDays}d</span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
        {project.client} · {project.address.split(",").pop()?.trim()}
      </div>

      {project.banner && project.bannerLabel && (
        <div className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium ${project.banner === "over-budget" ? "text-destructive" : "text-amber-600"}`}>
          <AlertCircle className="h-3 w-3" /> {project.bannerLabel}
        </div>
      )}

      {project.progress > 0 && project.progress < 100 && (
        <>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{project.progress}% complete</span>
            <span>Due {formatUtcDate(project.targetEnd, { month: "short", day: "numeric" })}</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${project.progress}%` }} />
          </div>
        </>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold tabular-nums">${project.budget.toLocaleString()}</span>
        <div className="flex items-center gap-1.5">
          <TypeChip type={project.type} />
          <span className={`flex h-5 w-5 items-center justify-center rounded text-[9px] font-semibold ${project.ownerColor}`}>
            {project.ownerInitials}
          </span>
        </div>
      </div>
    </Card>
  );
}

function TypeChip({ type }: { type: Project["type"] }) {
  const map: Record<Project["type"], string> = {
    Kitchen: "bg-blue-50 text-blue-700",
    Bath: "bg-emerald-50 text-emerald-700",
    "Whole Home": "bg-purple-50 text-purple-700",
    Addition: "bg-indigo-50 text-indigo-700",
    Basement: "bg-amber-50 text-amber-700",
    Outdoor: "bg-orange-50 text-orange-700",
    "Primary Suite": "bg-pink-50 text-pink-700",
  };
  return <span className={`rounded px-1.5 py-px text-[10px] font-medium ${map[type]}`}>{type}</span>;
}

function ListView({ projects }: { projects: Project[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Project</th>
            <th className="px-4 py-2.5 text-left font-medium">Client</th>
            <th className="px-4 py-2.5 text-left font-medium">Stage</th>
            <th className="px-4 py-2.5 text-left font-medium">Progress</th>
            <th className="px-4 py-2.5 text-right font-medium">Budget</th>
            <th className="px-4 py-2.5 text-left font-medium">Owner</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="h-12 border-b border-border last:border-b-0 hover:bg-secondary/30">
              <td className="px-4 font-medium">
                <Link to="/projects/$clientSlug" params={{ clientSlug: p.slug }} className="hover:text-primary">
                  {p.name}
                </Link>
              </td>
              <td className="px-4 text-muted-foreground">{p.client}</td>
              <td className="px-4"><StageBadge stage={p.stage} /></td>
              <td className="px-4">
                <div className="flex w-32 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">{p.progress}%</span>
                </div>
              </td>
              <td className="px-4 text-right tabular-nums">${p.budget.toLocaleString()}</td>
              <td className="px-4">
                <span className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold ${p.ownerColor}`}>
                  {p.ownerInitials}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function StageBadge({ stage }: { stage: ProjectStage }) {
  const meta = projectStages.find((s) => s.id === stage)!;
  const colorMap: Record<string, string> = {
    muted: "bg-secondary text-secondary-foreground",
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
  };
  return (
    <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] font-medium ${colorMap[meta.color]}`}>
      {meta.name}
    </Badge>
  );
}

function OnHoldView({ projects }: { projects: Project[] }) {
  return (
    <>
      <Card className="mb-4 border-warning/40 bg-warning/5 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
          <div>
            <div className="text-sm font-semibold text-foreground">{projects.length} projects paused</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              On-hold projects are off the active pipeline. Move back to a stage when the blocker clears, or cancel if they won't resume.
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Project</th>
              <th className="px-4 py-2.5 text-left font-medium">Client</th>
              <th className="px-4 py-2.5 text-left font-medium">Paused From</th>
              <th className="px-4 py-2.5 text-left font-medium">Reason</th>
              <th className="px-4 py-2.5 text-right font-medium">Budget</th>
              <th className="px-4 py-2.5 text-left font-medium">On Hold Since</th>
              <th className="px-4 py-2.5 text-left font-medium">Owner</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="h-12 border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 font-medium">
                  <Link to="/projects/$clientSlug" params={{ clientSlug: p.slug }} className="hover:text-primary">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 text-muted-foreground">{p.client}</td>
                <td className="px-4">{p.pausedFromStage && <StageBadge stage={p.pausedFromStage} />}</td>
                <td className="px-4 text-muted-foreground">{p.pauseReason}</td>
                <td className="px-4 text-right tabular-nums">${p.budget.toLocaleString()}</td>
                <td className={`px-4 text-xs font-medium ${(p.onHoldDays ?? 0) > 14 ? "text-destructive" : "text-warning"}`}>
                  {p.onHoldDays} days
                </td>
                <td className="px-4">
                  <span className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold ${p.ownerColor}`}>
                    {p.ownerInitials}
                  </span>
                </td>
                <td className="px-4 text-right">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs">Resume →</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function CancelledView({ projects }: { projects: Project[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Project</th>
            <th className="px-4 py-2.5 text-left font-medium">Client</th>
            <th className="px-4 py-2.5 text-left font-medium">Cancelled</th>
            <th className="px-4 py-2.5 text-left font-medium">Reason</th>
            <th className="px-4 py-2.5 text-right font-medium">Lost Value</th>
            <th className="px-4 py-2.5 text-left font-medium">Owner</th>
            <th className="px-4 py-2.5 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="h-12 border-b border-border last:border-b-0 hover:bg-secondary/30">
              <td className="px-4 font-medium">{p.name}</td>
              <td className="px-4 text-muted-foreground">{p.client}</td>
              <td className="px-4 text-muted-foreground">
                {p.cancelledDate && formatUtcDate(p.cancelledDate, { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-4">
                <div className="flex items-center gap-2">
                  {p.cancelTag && <Badge variant="secondary" className="h-5 rounded bg-secondary px-1.5 text-[10px]">{p.cancelTag}</Badge>}
                  <span className="text-muted-foreground">{p.cancelReason}</span>
                </div>
              </td>
              <td className="px-4 text-right font-medium tabular-nums text-destructive">
                ${p.lostValue?.toLocaleString()}
              </td>
              <td className="px-4">
                <span className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-semibold ${p.ownerColor}`}>
                  {p.ownerInitials}
                </span>
              </td>
              <td className="px-4 text-right">
                <Button variant="link" size="sm" className="h-auto p-0 text-xs">Restore</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ArchivedView({ projects }: { projects: Project[] }) {
  const [q, setQ] = useState("");
  const filtered = projects.filter((p) =>
    [p.name, p.client].some((s) => s.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Projects auto-archive 30 days after completion. They stay searchable, reportable, and reusable as templates — they just don't clutter the active board.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search archive…" className="h-8 w-48 pl-8 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs">Year: 2026</Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Project</th>
              <th className="px-4 py-2.5 text-left font-medium">Client</th>
              <th className="px-4 py-2.5 text-left font-medium">Type</th>
              <th className="px-4 py-2.5 text-left font-medium">Completed</th>
              <th className="px-4 py-2.5 text-right font-medium">Final Value</th>
              <th className="px-4 py-2.5 text-right font-medium">Margin</th>
              <th className="px-4 py-2.5 text-left font-medium">Rating</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="h-12 border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 font-medium">{p.name}</td>
                <td className="px-4 text-muted-foreground">{p.client}</td>
                <td className="px-4"><TypeChip type={p.type} /></td>
                <td className="px-4 text-muted-foreground">{p.completedDate}</td>
                <td className="px-4 text-right font-medium tabular-nums">${p.finalValue?.toLocaleString()}</td>
                <td className="px-4 text-right font-medium tabular-nums text-success">{p.margin?.toFixed(1)}%</td>
                <td className="px-4">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`h-3 w-3 ${i <= (p.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </td>
                <td className="px-4 text-right">
                  <Link to="/projects/$clientSlug" params={{ clientSlug: p.slug }} className="text-xs text-primary hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Showing {filtered.length} of {projects.length}
        </div>
      </Card>

      {/* satisfy unused import */}
      <ProjectStatusKey hidden />
    </>
  );
}

// Placeholder helper to satisfy ProjectStatus type import (kept for future use)
function ProjectStatusKey({ hidden }: { hidden: boolean }) {
  if (!hidden) return null;
  const _x: ProjectStatus = "active";
  return <span data-status={_x} className="hidden" />;
}
