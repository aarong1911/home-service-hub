import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Workflow as WorkflowIcon, Zap, Clock } from "lucide-react";
import { mockWorkflows } from "@/lib/mock-data";

export const Route = createFileRoute("/automation/workflows")({
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const active = mockWorkflows.filter((w) => w.status === "active").length;
  const totalRuns = mockWorkflows.reduce((s, w) => s + w.runs, 0);

  return (
    <>
      <PageHeader
        title="Workflows"
        subtitle={`${active} active automations · ${totalRuns.toLocaleString()} total runs this month`}
        breadcrumb={["Automation", "Workflows"]}
        actions={
          <Button size="sm" className="h-8">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Workflow
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <WorkflowIcon className="h-3.5 w-3.5" /> Active workflows
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{active}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5" /> Runs this month
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{totalRuns.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Avg. success rate
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {Math.round(mockWorkflows.reduce((s, w) => s + w.successRate, 0) / mockWorkflows.length)}%
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="w-14 px-3 py-2 text-left font-medium">On</th>
              <th className="px-3 py-2 text-left font-medium">Workflow</th>
              <th className="px-3 py-2 text-left font-medium">Trigger</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Runs</th>
              <th className="px-3 py-2 text-right font-medium">Success</th>
              <th className="px-3 py-2 text-left font-medium">Last run</th>
            </tr>
          </thead>
          <tbody>
            {mockWorkflows.map((w) => (
              <tr key={w.id} className="h-12 border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-3"><Switch defaultChecked={w.status === "active"} /></td>
                <td className="px-3 font-medium">{w.name}</td>
                <td className="px-3 text-xs text-muted-foreground">{w.trigger}</td>
                <td className="px-3"><WorkflowStatus status={w.status} /></td>
                <td className="px-3 text-right tabular-nums">{w.runs.toLocaleString()}</td>
                <td className="px-3 text-right">
                  <span className={`tabular-nums ${w.successRate >= 90 ? "text-success" : w.successRate >= 70 ? "text-warning" : "text-muted-foreground"}`}>
                    {w.successRate ? `${w.successRate}%` : "—"}
                  </span>
                </td>
                <td className="px-3 text-xs text-muted-foreground">
                  {w.lastRun === "—" ? "—" : new Date(w.lastRun).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function WorkflowStatus({ status }: { status: "active" | "paused" | "draft" }) {
  const map = {
    active: ["bg-success/15 text-success", "Active"],
    paused: ["bg-warning/15 text-warning", "Paused"],
    draft: ["bg-secondary text-secondary-foreground", "Draft"],
  } as const;
  const [cls, label] = map[status];
  return <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${cls}`}>{label}</Badge>;
}
