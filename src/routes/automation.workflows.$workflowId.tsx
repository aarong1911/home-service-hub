import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Play,
  Save,
  Plus,
  Zap,
  MessageSquare,
  Mail,
  Clock,
  GitBranch,
  CheckSquare,
  ArrowUpRight,
  StickyNote,
  Webhook,
  Sparkles,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings,
  ChevronDown,
} from "lucide-react";
import {
  mockWorkflows,
  mockWorkflowRuns,
  type WorkflowNode,
  type WorkflowNodeKind,
} from "@/lib/mock-data";

export const Route = createFileRoute("/automation/workflows/$workflowId")({
  loader: ({ params }) => {
    const wf = mockWorkflows.find((w) => w.id === params.workflowId);
    if (!wf) throw notFound();
    return wf;
  },
  notFoundComponent: () => (
    <div className="p-12 text-center text-sm text-muted-foreground">
      Workflow not found.{" "}
      <Link to={ROUTES.WORKFLOWS} className="text-primary hover:underline">Back to workflows</Link>
    </div>
  ),
  component: BuilderPage,
});

function BuilderPage() {
  const wf = Route.useLoaderData();
  const [selectedId, setSelectedId] = useState<string>(wf.nodes[0]?.id);
  const [showHistory, setShowHistory] = useState(false);
  const selected = wf.nodes.find((n) => n.id === selectedId) ?? wf.nodes[0];
  const runs = mockWorkflowRuns.filter((r) => r.workflowId === wf.id).slice(0, 12);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      <PageHeader
        title={wf.name}
        subtitle={`${wf.folder} · ${wf.nodes.length} steps · Owned by ${wf.owner}`}
        breadcrumb={["Automation", "Workflows", wf.name]}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1">
              <Switch defaultChecked={wf.status === "active"} />
              <span className="text-xs font-medium">{wf.status === "active" ? "Live" : "Off"}</span>
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowHistory((s) => !s)}>
              <History className="mr-1.5 h-3.5 w-3.5" /> History
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <Play className="mr-1.5 h-3.5 w-3.5" /> Test
            </Button>
            <Button size="sm" className="h-8">
              <Save className="mr-1.5 h-3.5 w-3.5" /> Save
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_340px] overflow-hidden border-t border-border">
        {/* CANVAS */}
        <section className="relative min-h-0 overflow-auto bg-[radial-gradient(circle,_var(--border)_1px,_transparent_1px)] [background-size:20px_20px]">
          <div className="mx-auto flex max-w-md flex-col items-center gap-2 px-6 py-10">
            {wf.nodes.map((node, i) => (
              <div key={node.id} className="flex w-full flex-col items-center gap-2">
                <NodeCard
                  node={node}
                  selected={node.id === selected.id}
                  isFirst={i === 0}
                  onSelect={() => setSelectedId(node.id)}
                />
                {i < wf.nodes.length - 1 && <Connector />}
              </div>
            ))}
            <Connector />
            <button className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Plus className="h-4 w-4" />
            </button>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Add step</span>
          </div>

          {/* Run history slide-over */}
          {showHistory && (
            <div className="absolute inset-y-0 right-0 w-80 border-l border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <div className="text-sm font-semibold">Recent runs</div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setShowHistory(false)}>Close</Button>
              </div>
              <div className="max-h-[calc(100%-3rem)] overflow-y-auto">
                {runs.map((r) => (
                  <div key={r.id} className="flex items-start gap-2 border-b border-border px-4 py-2.5 hover:bg-secondary/30">
                    {r.status === "success" && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-success" />}
                    {r.status === "failed" && <XCircle className="mt-0.5 h-3.5 w-3.5 text-destructive" />}
                    {r.status === "running" && <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin text-primary" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{r.contact}</div>
                      <div className="text-[10px] text-muted-foreground">{formatDateTime(r.startedAt)} · {(r.durationMs / 1000).toFixed(1)}s</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* INSPECTOR */}
        <aside className="flex min-h-0 flex-col border-l border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <NodeIcon kind={selected.kind} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{nodeLabel(selected.kind)}</div>
                <div className="text-sm font-semibold leading-tight">{selected.title}</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2"><Settings className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <Inspector node={selected} />
          </div>
          <div className="border-t border-border p-3">
            <Button variant="outline" size="sm" className="h-8 w-full text-xs">
              <Sparkles className="mr-1 h-3 w-3" /> Suggest improvement
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function NodeCard({
  node,
  selected,
  isFirst,
  onSelect,
}: {
  node: WorkflowNode;
  selected: boolean;
  isFirst: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative w-full rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      } ${isFirst ? "border-l-4 border-l-primary" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isFirst ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
          }`}
        >
          <NodeIcon kind={node.kind} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {nodeLabel(node.kind)}
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold">{node.title}</div>
          {node.subtitle && (
            <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{node.subtitle}</div>
          )}
        </div>
      </div>
    </button>
  );
}

function Connector() {
  return (
    <div className="flex h-6 flex-col items-center">
      <div className="h-full w-px bg-border" />
    </div>
  );
}

function NodeIcon({ kind }: { kind: WorkflowNodeKind }) {
  const Icon = ICONS[kind];
  return <Icon className="h-3.5 w-3.5" />;
}

const ICONS: Record<WorkflowNodeKind, typeof Zap> = {
  trigger: Zap,
  "send-sms": MessageSquare,
  "send-email": Mail,
  wait: Clock,
  condition: GitBranch,
  "create-task": CheckSquare,
  "update-stage": ArrowUpRight,
  "internal-note": StickyNote,
  webhook: Webhook,
};

function nodeLabel(kind: WorkflowNodeKind) {
  return {
    trigger: "Trigger",
    "send-sms": "Send SMS",
    "send-email": "Send Email",
    wait: "Wait",
    condition: "Condition",
    "create-task": "Create Task",
    "update-stage": "Update Stage",
    "internal-note": "Internal Note",
    webhook: "Webhook",
  }[kind];
}

function Inspector({ node }: { node: WorkflowNode }) {
  if (node.kind === "trigger") {
    return (
      <div className="space-y-3">
        <Field label="Trigger event">
          <Select value="Lead created" />
        </Field>
        <Field label="Source filter">
          <Select value="Any source" />
        </Field>
        <Hint>This workflow starts whenever the trigger event fires for matching contacts.</Hint>
      </div>
    );
  }
  if (node.kind === "send-sms") {
    return (
      <div className="space-y-3">
        <Field label="From">
          <Select value="(512) 555-0184 — Default" />
        </Field>
        <Field label="Message">
          <Textarea defaultValue={node.subtitle ?? ""} className="min-h-[110px] text-sm" />
        </Field>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Insert: {"{{first_name}}"}, {"{{project_name}}"}</span>
          <span>1 segment · 142/160</span>
        </div>
      </div>
    );
  }
  if (node.kind === "send-email") {
    return (
      <div className="space-y-3">
        <Field label="From"><Select value="sales@yourco.com" /></Field>
        <Field label="Template"><Select value="New Lead Welcome" /></Field>
        <Field label="Subject"><Input defaultValue="Thanks for reaching out" className="h-8 text-sm" /></Field>
        <Hint>Email body is edited in the template editor.</Hint>
      </div>
    );
  }
  if (node.kind === "wait") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Amount"><Input defaultValue="3" className="h-8 text-sm" /></Field>
          <Field label="Unit"><Select value="Days" /></Field>
        </div>
        <Hint>Workflow pauses for this duration before continuing.</Hint>
      </div>
    );
  }
  if (node.kind === "condition") {
    return (
      <div className="space-y-3">
        <Field label="If"><Select value="Estimate viewed" /></Field>
        <Field label="Operator"><Select value="is true" /></Field>
        <div className="flex gap-2 text-[11px]">
          <Badge variant="outline" className="border-success/40 text-success">Yes branch</Badge>
          <Badge variant="outline" className="border-destructive/40 text-destructive">No branch</Badge>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Field label="Title"><Input defaultValue={node.title} className="h-8 text-sm" /></Field>
      {node.subtitle && (
        <Field label="Details"><Textarea defaultValue={node.subtitle} className="min-h-[80px] text-sm" /></Field>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Select({ value }: { value: string }) {
  return (
    <button className="flex h-8 w-full items-center justify-between rounded-md border border-border bg-background px-2.5 text-sm hover:border-primary/50">
      <span className="truncate">{value}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-secondary/60 p-2 text-[11px] text-muted-foreground">{children}</p>;
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso));
}

// Touch unused imports
void Avatar; void AvatarFallback;
