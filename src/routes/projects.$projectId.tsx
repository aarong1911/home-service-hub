import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockProjects, mockTasks } from "@/lib/mock-data";
import { Calendar, FileText, Users, DollarSign, Activity, ListTodo, GitBranch, Plus } from "lucide-react";

export const Route = createFileRoute("/projects/$projectId")({
  loader: ({ params }) => {
    const project = mockProjects.find((p) => p.id === params.projectId);
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

function ProjectDetailPage() {
  const { project } = Route.useLoaderData();
  const tasks = mockTasks.filter((t) => t.projectId === project.id);

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`Client: ${project.client} · Next: ${project.nextMilestone}`}
        breadcrumb={["Projects", project.name]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">Share</Button>
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Task
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <StatCard label="Status" value={project.status} />
        <StatCard label="Progress" value={`${project.progress}%`} bar={project.progress} />
        <StatCard label="Budget" value={`$${project.budget.toLocaleString()}`} />
        <StatCard
          label="Spent"
          value={`$${project.spent.toLocaleString()}`}
          tone={project.spent > project.budget ? "danger" : "default"}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-transparent p-0">
          {([
            ["overview", "Overview", Activity],
            ["tasks", "Tasks", ListTodo],
            ["timeline", "Timeline", GitBranch],
            ["files", "Files", FileText],
            ["financials", "Financials", DollarSign],
            ["team", "Team", Users],
            ["activity", "Activity", Calendar],
          ] as const).map(([v, l, Icon]) => (
            <TabsTrigger
              key={v}
              value={v}
              className="data-[state=active]:bg-secondary data-[state=active]:text-foreground rounded-md px-3 text-xs font-medium"
            >
              <Icon className="mr-1.5 h-3.5 w-3.5" />
              {l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</div>
            <p className="text-sm leading-relaxed text-foreground/90">
              Full renovation scope including demolition, framing modifications, electrical and plumbing
              rough-in, drywall, finishes, and final inspections. Estimated 8-week build with weekly
              client walkthroughs.
            </p>
          </Card>
          <Card className="p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent activity</div>
            <ul className="space-y-2 text-xs">
              <li>Permit approved — 2 days ago</li>
              <li>Cabinet selections finalized — 4 days ago</li>
              <li>Site visit completed — 1 week ago</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left font-medium">Task</th>
                  <th className="px-3 py-2 text-left font-medium">Assignee</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Priority</th>
                  <th className="px-3 py-2 text-left font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-muted-foreground">No tasks yet</td></tr>
                ) : tasks.map((t) => (
                  <tr key={t.id} className="h-11 border-b border-border last:border-b-0 hover:bg-secondary/30">
                    <td className="px-3"><input type="checkbox" defaultChecked={t.status === "done"} className="h-3.5 w-3.5" /></td>
                    <td className="px-3 font-medium">{t.title}</td>
                    <td className="px-3">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-primary-soft text-[9px] font-medium text-primary">{t.assigneeInitials}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{t.assignee}</span>
                      </div>
                    </td>
                    <td className="px-3"><TaskStatus status={t.status} /></td>
                    <td className="px-3"><PriorityChip p={t.priority} /></td>
                    <td className="px-3 text-xs text-muted-foreground">{new Date(t.due).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card className="p-6">
            <div className="space-y-3">
              {["Demo & prep", "Rough-in", "Drywall + paint", "Cabinets + counters", "Finishes", "Punch list"].map((phase, i) => (
                <div key={phase} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 text-xs font-medium">{phase}</div>
                  <div className="relative h-6 flex-1 rounded bg-secondary">
                    <div
                      className="absolute top-0 h-full rounded bg-primary/80"
                      style={{ left: `${i * 14}%`, width: "16%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <EmptyTab label="No files uploaded yet." cta="Upload file" />
        </TabsContent>
        <TabsContent value="financials" className="mt-4">
          <EmptyTab label="No invoices linked to this project." cta="Create invoice" />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <EmptyTab label="Add team members to collaborate." cta="Invite member" />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <EmptyTab label="Project activity will appear here." />
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatCard({ label, value, bar, tone = "default" }: { label: string; value: string; bar?: number; tone?: "default" | "danger" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
      {typeof bar === "number" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary" style={{ width: `${bar}%` }} />
        </div>
      )}
    </Card>
  );
}

function TaskStatus({ status }: { status: "todo" | "in_progress" | "review" | "done" }) {
  const map = {
    todo: ["bg-secondary text-secondary-foreground", "To do"],
    in_progress: ["bg-primary-soft text-primary", "In progress"],
    review: ["bg-warning/15 text-warning", "Review"],
    done: ["bg-success/15 text-success", "Done"],
  } as const;
  const [cls, label] = map[status];
  return <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${cls}`}>{label}</Badge>;
}

function PriorityChip({ p }: { p: "low" | "med" | "high" }) {
  const map = { low: "text-muted-foreground", med: "text-warning", high: "text-destructive" } as const;
  return <span className={`text-xs font-medium ${map[p]}`}>{p === "med" ? "Medium" : p[0].toUpperCase() + p.slice(1)}</span>;
}

function EmptyTab({ label, cta }: { label: string; cta?: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {cta && <Button size="sm" className="h-8"><Plus className="mr-1.5 h-3.5 w-3.5" />{cta}</Button>}
    </Card>
  );
}
