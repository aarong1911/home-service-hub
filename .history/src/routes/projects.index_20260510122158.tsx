// src/routes/projects.index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Search, LayoutGrid, List as ListIcon, Download, Loader2,
  MapPin, DollarSign, MoreHorizontal, Building2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useProjects, updateProjectStatus, type Project, type ProjectStatus } from "@/lib/projects-store";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/projects/")({ component: ProjectsPage });

type Tab = "active" | "planning" | "on-hold" | "completed" | "cancelled";
type View = "board" | "list";

const STATUS_COLUMNS: { id: ProjectStatus; label: string; color: string }[] = [
  { id: "planning",   label: "Planning",   color: "bg-sky-500/10 text-sky-600 border-sky-200" },
  { id: "active",     label: "Active",     color: "bg-success/10 text-success border-success/20" },
  { id: "on-hold",    label: "On Hold",    color: "bg-warning/10 text-warning border-warning/20" },
  { id: "completed",  label: "Completed",  color: "bg-muted text-muted-foreground border-border" },
];

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function ProjectsPage() {
  const { projects, loading, reload } = useProjects();
  const [tab, setTab] = useState<Tab>("active");
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => ({
    active: projects.filter(p => p.status === "active").length,
    planning: projects.filter(p => p.status === "planning").length,
    "on-hold": projects.filter(p => p.status === "on-hold").length,
    completed: projects.filter(p => p.status === "completed").length,
    cancelled: projects.filter(p => p.status === "cancelled").length,
  }), [projects]);

  const tabProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => {
      const matchTab = tab === "active"
        ? p.status === "active"
        : tab === "on-hold"
        ? p.status === "on-hold"
        : p.status === tab;
      if (!matchTab) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q);
    });
  }, [projects, tab, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Project[]> = { planning: [], active: [], "on-hold": [], completed: [] };
    for (const p of tabProjects) {
      if (map[p.status]) map[p.status].push(p);
    }
    return map;
  }, [tabProjects]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as ProjectStatus;
    const { error } = await updateProjectStatus(draggableId, newStatus);
    if (error) { toast.error("Failed to update status"); return; }
    toast.success(`Moved to ${newStatus}`);
    reload();
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error("Failed to delete project"); return; }
    toast.success(`${name} deleted`);
    reload();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <PageHeader
        title="Projects"
        subtitle={`${counts.active} active · ${counts.planning} planning · ${counts.completed} completed`}
        breadcrumb={["Workspace", "Projects"]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8"><Download className="mr-1.5 h-3.5 w-3.5" /> Export</Button>
            <Button size="sm" className="h-8" onClick={() => toast.info("New project — coming soon")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Project
            </Button>
          </>
        }
      />

      {/* Tabs + controls */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex gap-1">
          {(["active","planning","on-hold","completed","cancelled"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              {t} <span className="ml-1 text-[10px] opacity-60">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-52 pl-8 text-xs" />
          </div>
          <div className="flex items-center rounded-md border border-border p-0.5">
            <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("board")}><LayoutGrid className="h-3.5 w-3.5" /></Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setView("list")}><ListIcon className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pt-3">
        {view === "board" ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex h-full gap-3 pb-4">
              {STATUS_COLUMNS.map(col => {
                const items = grouped[col.id] ?? [];
                return (
                  <Droppable droppableId={col.id} key={col.id}>
                    {(provided, snap) => (
                      <div
                        ref={provided.innerRef} {...provided.droppableProps}
                        className={cn("flex w-72 flex-shrink-0 flex-col rounded-lg border border-border bg-secondary/40 p-2 transition-colors", snap.isDraggingOver && "border-primary/40 bg-primary-soft/30")}
                      >
                        <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
                          <Badge variant="secondary" className={cn("h-5 rounded border px-1.5 text-[10px]", col.color)}>{col.label}</Badge>
                          <span className="ml-auto text-[11px] text-muted-foreground">{items.length}</span>
                        </div>
                        <div className="flex-1 space-y-2 overflow-y-auto">
                          {items.map((p, i) => (
                            <Draggable draggableId={p.id} index={i} key={p.id}>
                              {(drag, ds) => (
                                <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                                  <ProjectCard project={p} onDelete={() => handleDelete(p.id, p.name)} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {items.length === 0 && (
                            <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">No projects</div>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2.5 pl-4 pr-3 text-left">Project</th>
                  <th className="py-2.5 pr-4 text-left">Client</th>
                  <th className="py-2.5 pr-4 text-left">Status</th>
                  <th className="py-2.5 pr-4 text-left">Budget</th>
                  <th className="py-2.5 pr-4 text-left">Progress</th>
                  <th className="py-2.5 pr-4 text-left">Dates</th>
                  <th className="w-10 py-2.5 pr-3" />
                </tr>
              </thead>
              <tbody>
                {tabProjects.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No projects found</td></tr>
                )}
                {tabProjects.map(p => {
                  const col = STATUS_COLUMNS.find(c => c.id === p.status);
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-secondary/30">
                      <td className="py-3 pl-4 pr-3">
                        <div className="font-medium">{p.name}</div>
                        {p.address && <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{p.address}</div>}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{p.client_name || "—"}</td>
                      <td className="py-3 pr-4">
                        {col && <Badge variant="secondary" className={cn("h-5 rounded border px-1.5 text-[10px] capitalize", col.color)}>{col.label}</Badge>}
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        <div className="text-sm font-medium">{formatMoney(p.budget_total)}</div>
                        {p.actual_cost > 0 && <div className="text-[11px] text-muted-foreground">{formatMoney(p.actual_cost)} spent</div>}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Progress value={p.completion_percentage} className="h-1.5 w-24" />
                          <span className="text-[11px] text-muted-foreground">{p.completion_percentage}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[11px] text-muted-foreground">
                        {p.start_date && <div>Start: {p.start_date}</div>}
                        {p.end_date && <div>End: {p.end_date}</div>}
                      </td>
                      <td className="py-3 pr-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p.id, p.name)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project: p, onDelete }: { project: Project; onDelete: () => void }) {
  const col = STATUS_COLUMNS.find(c => c.id === p.status);
  const overBudget = p.actual_cost > p.budget_total && p.budget_total > 0;
  return (
    <Card className="cursor-grab p-3 transition-shadow hover:shadow-md active:cursor-grabbing">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{p.name}</div>
          {p.client_name && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground"><Building2 className="h-3 w-3" />{p.client_name}</div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-6 w-6" onClick={e => e.stopPropagation()}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View details</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {p.address && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{p.address}</span>
        </div>
      )}

      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Budget</span>
          <span className={cn("font-medium tabular-nums", overBudget && "text-destructive")}>{formatMoney(p.budget_total)}</span>
        </div>
        {p.completion_percentage > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{p.completion_percentage}%</span>
            </div>
            <Progress value={p.completion_percentage} className="h-1" />
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
        {col && <Badge variant="secondary" className={cn("h-5 rounded border px-1.5 text-[10px]", col.color)}>{col.label}</Badge>}
        {overBudget && <span className="text-[10px] font-medium text-destructive">Over budget</span>}
        {p.end_date && <span className="text-[10px] text-muted-foreground">Due {p.end_date}</span>}
      </div>
    </Card>
  );
}