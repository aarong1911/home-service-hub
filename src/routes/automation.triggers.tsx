import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CloudRain,
  FileText,
  Filter,
  Globe,
  Mail,
  MessageSquare,
  PhoneMissed,
  Search,
  Star,
  Truck,
  Webhook,
  Workflow as WorkflowIcon,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/automation/triggers")({
  head: () => ({
    meta: [
      { title: "Triggers — Automation" },
      {
        name: "description",
        content:
          "Event triggers that fire your AI agents and workflows: web forms, missed calls, weather alerts, and more.",
      },
    ],
  }),
  component: TriggersPage,
});

type TriggerCategory = "Inbound" | "Calendar & Ops" | "Financial" | "External" | "Internal";
type TriggerSource = "Web" | "Phone" | "Email" | "SMS" | "Calendar" | "Webhook" | "Schedule" | "System";

type Subscriber = {
  name: string;
  kind: "agent" | "workflow";
  href: string;
};

type Trigger = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: TriggerCategory;
  source: TriggerSource;
  status: "active" | "paused";
  eventsThisWeek: number;
  lastFired: string;
  payload: string[];
  subscribers: Subscriber[];
};

const TRIGGERS: Trigger[] = [
  {
    id: "web-form",
    name: "Web form submitted",
    description: "Fires when a lead submits the contact form on your marketing site.",
    icon: Globe,
    category: "Inbound",
    source: "Web",
    status: "active",
    eventsThisWeek: 47,
    lastFired: "2 min ago",
    payload: ["name", "email", "phone", "project_type", "zip", "budget_range", "source_page"],
    subscribers: [
      { name: "Lead Qualifier", kind: "agent", href: "/automation/agents" },
      { name: "Speed-to-Lead Responder", kind: "agent", href: "/automation/agents" },
      { name: "New Lead Intake", kind: "workflow", href: "/automation/workflows" },
    ],
  },
  {
    id: "missed-call",
    name: "Missed call",
    description: "Triggered when an inbound call goes to voicemail or is unanswered.",
    icon: PhoneMissed,
    category: "Inbound",
    source: "Phone",
    status: "active",
    eventsThisWeek: 18,
    lastFired: "14 min ago",
    payload: ["caller_number", "caller_name", "duration", "voicemail_url", "transcript"],
    subscribers: [
      { name: "Voicemail Agent", kind: "agent", href: "/automation/agents" },
      { name: "Speed-to-Lead Responder", kind: "agent", href: "/automation/agents" },
    ],
  },
  {
    id: "inbound-sms",
    name: "Inbound SMS",
    description: "A homeowner or lead replies to one of your numbers.",
    icon: MessageSquare,
    category: "Inbound",
    source: "SMS",
    status: "active",
    eventsThisWeek: 132,
    lastFired: "Just now",
    payload: ["from", "to", "body", "media_urls", "contact_id"],
    subscribers: [
      { name: "Inbox Triage Agent", kind: "agent", href: "/automation/agents" },
      { name: "Follow-Up Agent", kind: "agent", href: "/automation/agents" },
    ],
  },
  {
    id: "inbound-email",
    name: "Inbound email",
    description: "New email lands in a connected shared inbox.",
    icon: Mail,
    category: "Inbound",
    source: "Email",
    status: "active",
    eventsThisWeek: 89,
    lastFired: "6 min ago",
    payload: ["from", "subject", "body_html", "attachments", "thread_id"],
    subscribers: [
      { name: "Inbox Triage Agent", kind: "agent", href: "/automation/agents" },
      { name: "Lead Qualifier", kind: "agent", href: "/automation/agents" },
    ],
  },
  {
    id: "marketplace-lead",
    name: "Marketplace lead received",
    description: "New lead pushed from Angi, Thumbtack, Houzz, or Yelp.",
    icon: Zap,
    category: "Inbound",
    source: "Webhook",
    status: "active",
    eventsThisWeek: 23,
    lastFired: "1 hr ago",
    payload: ["marketplace", "lead_id", "name", "phone", "service_requested", "lead_cost"],
    subscribers: [
      { name: "Lead Qualifier", kind: "agent", href: "/automation/agents" },
      { name: "Speed-to-Lead Responder", kind: "agent", href: "/automation/agents" },
    ],
  },
  {
    id: "appointment-booked",
    name: "Appointment booked",
    description: "Discovery call or site visit gets added to a team calendar.",
    icon: Activity,
    category: "Calendar & Ops",
    source: "Calendar",
    status: "active",
    eventsThisWeek: 31,
    lastFired: "22 min ago",
    payload: ["contact_id", "owner", "start_time", "location", "deal_id"],
    subscribers: [
      { name: "Project Coordinator", kind: "agent", href: "/automation/agents" },
      { name: "Pre-meeting Prep", kind: "workflow", href: "/automation/workflows" },
    ],
  },
  {
    id: "weather-alert",
    name: "Weather alert",
    description: "Rain, snow, or wind forecast above threshold for a job site ZIP.",
    icon: CloudRain,
    category: "External",
    source: "Schedule",
    status: "active",
    eventsThisWeek: 4,
    lastFired: "Yesterday",
    payload: ["zip", "alert_type", "severity", "window_start", "window_end", "affected_projects"],
    subscribers: [
      { name: "Project Coordinator", kind: "agent", href: "/automation/agents" },
      { name: "Reschedule Outdoor Work", kind: "workflow", href: "/automation/workflows" },
    ],
  },
  {
    id: "delivery-delay",
    name: "Material delivery delayed",
    description: "Supplier confirms a slip on a scheduled material drop.",
    icon: Truck,
    category: "Calendar & Ops",
    source: "Webhook",
    status: "active",
    eventsThisWeek: 6,
    lastFired: "3 hr ago",
    payload: ["po_number", "supplier", "original_eta", "new_eta", "project_id"],
    subscribers: [
      { name: "Project Coordinator", kind: "agent", href: "/automation/agents" },
      { name: "Client Update Agent", kind: "agent", href: "/automation/agents" },
    ],
  },
  {
    id: "invoice-overdue",
    name: "Invoice overdue",
    description: "An invoice crosses its due date without full payment.",
    icon: FileText,
    category: "Financial",
    source: "System",
    status: "active",
    eventsThisWeek: 11,
    lastFired: "Today, 9:14am",
    payload: ["invoice_id", "client_id", "balance", "days_overdue", "project_id"],
    subscribers: [
      { name: "Collections Agent", kind: "agent", href: "/automation/agents" },
      { name: "AR Aging Escalation", kind: "workflow", href: "/automation/workflows" },
    ],
  },
  {
    id: "payment-received",
    name: "Payment received",
    description: "Stripe, ACH, or check payment posts against an invoice.",
    icon: Zap,
    category: "Financial",
    source: "Webhook",
    status: "active",
    eventsThisWeek: 27,
    lastFired: "45 min ago",
    payload: ["invoice_id", "amount", "method", "client_id"],
    subscribers: [
      { name: "Client Update Agent", kind: "agent", href: "/automation/agents" },
      { name: "Receipt & Thank You", kind: "workflow", href: "/automation/workflows" },
    ],
  },
  {
    id: "project-milestone",
    name: "Project milestone reached",
    description: "Demo done, rough-in passed, final walkthrough — any milestone hit.",
    icon: Activity,
    category: "Calendar & Ops",
    source: "System",
    status: "active",
    eventsThisWeek: 9,
    lastFired: "Yesterday",
    payload: ["project_id", "milestone", "completed_at", "completed_by"],
    subscribers: [
      { name: "Client Update Agent", kind: "agent", href: "/automation/agents" },
      { name: "Review Agent", kind: "agent", href: "/automation/agents" },
    ],
  },
  {
    id: "project-completed",
    name: "Project completed",
    description: "Final walkthrough signed off and project marked complete.",
    icon: Star,
    category: "Calendar & Ops",
    source: "System",
    status: "active",
    eventsThisWeek: 3,
    lastFired: "2 days ago",
    payload: ["project_id", "client_id", "completed_at", "final_amount"],
    subscribers: [
      { name: "Review Agent", kind: "agent", href: "/automation/agents" },
      { name: "Content Agent", kind: "agent", href: "/automation/agents" },
      { name: "Warranty Kickoff", kind: "workflow", href: "/automation/workflows" },
    ],
  },
  {
    id: "deal-stalled",
    name: "Deal stalled",
    description: "A pipeline deal has had no activity for 7+ days.",
    icon: Activity,
    category: "Internal",
    source: "Schedule",
    status: "active",
    eventsThisWeek: 14,
    lastFired: "Today, 6:00am",
    payload: ["deal_id", "owner", "stage", "days_idle"],
    subscribers: [
      { name: "Follow-Up Agent", kind: "agent", href: "/automation/agents" },
    ],
  },
  {
    id: "review-posted",
    name: "Review posted",
    description: "A new review appears on Google, Yelp, or Houzz.",
    icon: Star,
    category: "External",
    source: "Webhook",
    status: "paused",
    eventsThisWeek: 2,
    lastFired: "4 days ago",
    payload: ["platform", "rating", "author", "body", "url"],
    subscribers: [
      { name: "Review Agent", kind: "agent", href: "/automation/agents" },
    ],
  },
  {
    id: "custom-webhook",
    name: "Custom webhook",
    description: "Generic HTTP POST endpoint for any external system.",
    icon: Webhook,
    category: "External",
    source: "Webhook",
    status: "paused",
    eventsThisWeek: 0,
    lastFired: "Never",
    payload: ["headers", "body (raw JSON)"],
    subscribers: [],
  },
];

const CATEGORIES = ["All", "Inbound", "Calendar & Ops", "Financial", "External", "Internal"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];

function TriggersPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TRIGGERS.filter((t) => {
      if (category !== "All" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.subscribers.some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  const totals = useMemo(() => {
    const active = TRIGGERS.filter((t) => t.status === "active").length;
    const events = TRIGGERS.reduce((acc, t) => acc + t.eventsThisWeek, 0);
    const subscriptions = TRIGGERS.reduce((acc, t) => acc + t.subscribers.length, 0);
    const orphans = TRIGGERS.filter((t) => t.subscribers.length === 0).length;
    return { active, events, subscriptions, orphans };
  }, []);

  const selected = selectedId ? TRIGGERS.find((t) => t.id === selectedId) ?? null : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Link to="/automation/workflows" className="hover:text-foreground">
            Automation
          </Link>
          <span>/</span>
          <span>Triggers</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Triggers</h1>
            <p className="text-sm text-muted-foreground">
              Every event that can fire an agent or workflow, and who's listening.
            </p>
          </div>
          <Button>
            <Webhook className="mr-2 size-4" />
            New trigger
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard label="Active triggers" value={totals.active.toString()} sub={`of ${TRIGGERS.length} total`} />
        <KpiCard label="Events this week" value={totals.events.toLocaleString()} sub="across all sources" />
        <KpiCard label="Subscriptions" value={totals.subscriptions.toString()} sub="agent + workflow links" />
        <KpiCard
          label="Unsubscribed"
          value={totals.orphans.toString()}
          sub="triggers with 0 listeners"
          tone={totals.orphans > 0 ? "warning" : "muted"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search triggers or subscribers…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
          <Filter className="ml-1 size-3.5 text-muted-foreground" />
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                category === c
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {filtered.map((t) => (
          <TriggerCard key={t.id} trigger={t} onOpen={() => setSelectedId(t.id)} />
        ))}
        {filtered.length === 0 && (
          <Card className="lg:col-span-2">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              No triggers match your filters.
            </CardContent>
          </Card>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selected && <TriggerDetail trigger={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "muted",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "muted" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <span className={cn("text-xs", tone === "warning" ? "text-destructive" : "text-muted-foreground")}>
          {sub}
        </span>
      </CardContent>
    </Card>
  );
}

function TriggerCard({ trigger, onOpen }: { trigger: Trigger; onOpen: () => void }) {
  const Icon = trigger.icon;
  const agents = trigger.subscribers.filter((s) => s.kind === "agent");
  const workflows = trigger.subscribers.filter((s) => s.kind === "workflow");

  return (
    <Card
      className="group cursor-pointer transition-colors hover:border-foreground/20"
      onClick={onOpen}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/40">
            <Icon className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{trigger.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{trigger.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant={trigger.status === "active" ? "default" : "secondary"} className="capitalize">
            {trigger.status}
          </Badge>
          <span className="text-xs text-muted-foreground">{trigger.source}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{trigger.eventsThisWeek}</span> events this
            week
          </span>
          <span>Last fired {trigger.lastFired}</span>
        </div>

        {trigger.subscribers.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            No agents or workflows are subscribed to this trigger yet.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {agents.length > 0 && (
              <SubscriberRow icon={Bot} label="Agents" items={agents} />
            )}
            {workflows.length > 0 && (
              <SubscriberRow icon={WorkflowIcon} label="Workflows" items={workflows} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriberRow({
  icon: Icon,
  label,
  items,
}: {
  icon: LucideIcon;
  label: string;
  items: Subscriber[];
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="size-3.5 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {items.map((s) => (
          <Badge key={s.name} variant="outline" className="font-normal">
            {s.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function TriggerDetail({ trigger }: { trigger: Trigger }) {
  const Icon = trigger.icon;
  return (
    <>
      <SheetHeader className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-12 items-center justify-center rounded-lg border bg-muted/40">
            <Icon className="size-6" />
          </div>
          <div className="flex-1">
            <SheetTitle>{trigger.name}</SheetTitle>
            <SheetDescription>{trigger.description}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{trigger.category}</Badge>
          <Badge variant="outline">Source: {trigger.source}</Badge>
          <Badge variant={trigger.status === "active" ? "default" : "secondary"}>
            {trigger.status}
          </Badge>
        </div>
      </SheetHeader>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Events / week</div>
            <div className="text-xl font-semibold">{trigger.eventsThisWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Last fired</div>
            <div className="text-xl font-semibold">{trigger.lastFired}</div>
          </CardContent>
        </Card>
      </div>

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">Event payload</h3>
        <div className="flex flex-wrap gap-1.5">
          {trigger.payload.map((field) => (
            <code
              key={field}
              className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-xs"
            >
              {field}
            </code>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">
          Subscribers ({trigger.subscribers.length})
        </h3>
        {trigger.subscribers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing is listening yet. Connect an agent or workflow to react to this event.
          </p>
        ) : (
          <ul className="flex flex-col divide-y rounded-md border">
            {trigger.subscribers.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  {s.kind === "agent" ? (
                    <Bot className="size-4 text-muted-foreground" />
                  ) : (
                    <WorkflowIcon className="size-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">{s.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {s.kind}
                  </Badge>
                </div>
                <Link
                  to={s.href}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex gap-2">
        <Button variant="outline" className="flex-1">
          Edit trigger
        </Button>
        <Button variant="outline" className="flex-1">
          View event log
        </Button>
      </div>
    </>
  );
}
