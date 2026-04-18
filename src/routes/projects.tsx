import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, LayoutGrid, List, Filter } from "lucide-react";
import { mockProjects, type Project } from "@/lib/mock-data";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const projects = mockProjects.filter((p) =>
    [p.name, p.client].some((s) => s.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} active jobs across kitchen, bath, additions, and exterior work`}
        breadcrumb={["Projects"]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="mr-1.5 h-3.5 w-3.5" /> Filter
            </Button>
            <div className="flex h-8 items-center rounded-md border border-border bg-card p-0.5">
              <Button
                size="sm"
                variant={view === "grid" ? "secondary" : "ghost"}
                onClick={() => setView("grid")}
                className="h-7 px-2"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant={view === "list" ? "secondary" : "ghost"}
                onClick={() => setView("list")}
                className="h-7 px-2"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Project
            </Button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects or clients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Project</th>
                <th className="px-4 py-2 text-left font-medium">Client</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Progress</th>
                <th className="px-4 py-2 text-right font-medium">Budget</th>
                <th className="px-4 py-2 text-right font-medium">Spent</th>
                <th className="px-4 py-2 text-left font-medium">Next milestone</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="h-11 border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-4 font-medium">
                    <Link to="/projects/$projectId" params={{ projectId: p.id }} className="hover:text-primary">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 text-muted-foreground">{p.client}</td>
                  <td className="px-4"><StatusBadge status={p.status} /></td>
                  <td className="px-4">
                    <div className="flex w-32 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 text-right tabular-nums">${p.budget.toLocaleString()}</td>
                  <td className="px-4 text-right tabular-nums text-muted-foreground">${p.spent.toLocaleString()}</td>
                  <td className="px-4 text-muted-foreground">{p.nextMilestone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const overBudget = project.spent > project.budget;
  return (
    <Link to="/projects/$projectId" params={{ projectId: project.id }}>
      <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-[var(--shadow-elev-2)]">
        <div className="h-1.5 bg-gradient-to-r from-primary/80 to-primary" />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold group-hover:text-primary">{project.name}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{project.client}</div>
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="tabular-nums">{project.progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${project.progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
            <div>
              <div className="text-muted-foreground">Budget</div>
              <div className="font-semibold tabular-nums">${project.budget.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Spent</div>
              <div className={`font-semibold tabular-nums ${overBudget ? "text-destructive" : ""}`}>
                ${project.spent.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Next: {project.nextMilestone}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const map: Record<Project["status"], string> = {
    Planning: "bg-secondary text-secondary-foreground",
    "In Progress": "bg-primary-soft text-primary",
    "On Hold": "bg-warning/15 text-warning",
    Completed: "bg-success/15 text-success",
  };
  return (
    <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] font-medium ${map[status]}`}>
      {status}
    </Badge>
  );
}
