import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Bot,
  Search,
  Sparkles,
  Activity,
  Plus,
  Settings2,
  Play,
  Pause,
  Zap,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  type LucideIcon,
  Filter as FilterIcon,
  MessageSquare,
  PhoneCall,
  ClipboardList,
  CalendarClock,
  Megaphone,
  Camera,
  Receipt,
  FileEdit,
  Star,
  Inbox as InboxIcon,
  Brain,
  Voicemail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isAgentConfigured } from "@/lib/agent-config";
import { AgentConfigureDialog } from "@/components/automation/agent-configure-dialog";
import { AIToolsTab } from "@/components/automation/ai-tools-tab";
import { VoiceAgentTab } from "@/components/automation/voice-agent-tab";
import { TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/automation/agents")({
  head: () => ({
    meta: [
      { title: "AI Center — RenoMeta" },
      {
        name: "description",
        content:
          "AI Center — autonomous agents, on-demand AI tools, and voice agents.",
      },
    ],
  }),
  component: AgentsPage,
});

type AgentCategory =
  | "sales"
  | "ops"
  | "financials"
  | "marketing"
  | "internal";

type AgentStatus = "active" | "paused" | "draft";

type Agent = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  category: AgentCategory;
  status: AgentStatus;
  triggers: string[];
  channels: string[];
  runsThisWeek: number;
  successRate: number; // 0-100
  lastRun: string;
  savedHours: number;
  recentActivity: { time: string; text: string }[];
};

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  sales: "Sales & lead response",
  ops: "Estimating & project ops",
  financials: "Financials",
  marketing: "Reputation & marketing",
  internal: "Internal / horizontal",
};

const CATEGORY_DOT: Record<AgentCategory, string> = {
  sales: "bg-primary",
  ops: "bg-warning",
  financials: "bg-success",
  marketing: "bg-accent-foreground",
  internal: "bg-muted-foreground",
};

const STATUS_STYLE: Record<AgentStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  paused: "bg-muted text-muted-foreground border-border",
  draft: "bg-warning/15 text-warning border-warning/30",
};

const AGENTS: Agent[] = [
  {
    id: "lead-qualifier",
    name: "Lead Qualifier",
    tagline: "Triages inbound leads from web, Angi, Thumbtack, referrals.",
    description:
      "Scores fit on budget range, timeline, project type, and service area. Enriches with property data from county records and Zillow, then routes hot leads to the right owner.",
    icon: FilterIcon,
    category: "sales",
    status: "active",
    triggers: ["Web form submission", "Angi lead", "Thumbtack lead", "Referral form"],
    channels: ["CRM", "Slack #leads"],
    runsThisWeek: 87,
    successRate: 94,
    lastRun: "2 min ago",
    savedHours: 11.5,
    recentActivity: [
      { time: "2 min ago", text: "Scored Brooks (kitchen, $80–120k) — Hot · routed to Marcus" },
      { time: "18 min ago", text: "Enriched Patel property (Zillow + county) — added 3 fields" },
      { time: "1 hr ago", text: "Disqualified outside service area — auto-replied with referral" },
    ],
  },
  {
    id: "speed-to-lead",
    name: "Speed-to-Lead Responder",
    tagline: "Replies to new leads within 60 seconds, books discovery calls.",
    description:
      "Auto-texts and emails new leads in under a minute, asks qualifying questions, offers calendar slots, and books on the owner's calendar. Hands off to a human the moment the conversation gets complex.",
    icon: Zap,
    category: "sales",
    status: "active",
    triggers: ["New qualified lead"],
    channels: ["SMS", "Email", "Google Calendar"],
    runsThisWeek: 64,
    successRate: 88,
    lastRun: "12 min ago",
    savedHours: 9.2,
    recentActivity: [
      { time: "12 min ago", text: "Booked discovery call with Reyes for Thu 2pm" },
      { time: "47 min ago", text: "Handed off to Jess — homeowner asked about financing" },
      { time: "2 hr ago", text: "Sent 3 time slots to Hoffman — awaiting reply" },
    ],
  },
  {
    id: "follow-up",
    name: "Follow-Up Agent",
    tagline: "Works cold and stalled deals on a polite cadence.",
    description:
      "Sends nudges like 'still thinking about the kitchen?', reschedules ghosted appointments, and pauses itself the moment the homeowner replies.",
    icon: Clock,
    category: "sales",
    status: "active",
    triggers: ["Deal stalled 7+ days", "Ghosted appointment"],
    channels: ["SMS", "Email"],
    runsThisWeek: 42,
    successRate: 71,
    lastRun: "26 min ago",
    savedHours: 6.8,
    recentActivity: [
      { time: "26 min ago", text: "Nudged Lopez Basement — paused (replied)" },
      { time: "3 hr ago", text: "Rescheduled Nguyen visit for Sat 11am" },
    ],
  },
  {
    id: "estimate-drafter",
    name: "Estimate Drafter",
    tagline: "Turns site notes, voice memos, and photos into line-item estimates.",
    description:
      "Builds estimates from your historical pricing and cost catalog. Surfaces margin per line item and flags scope gaps before you send.",
    icon: ClipboardList,
    category: "ops",
    status: "active",
    triggers: ["Site visit complete", "Voice memo uploaded"],
    channels: ["Estimates", "Email draft"],
    runsThisWeek: 12,
    successRate: 92,
    lastRun: "1 hr ago",
    savedHours: 14.0,
    recentActivity: [
      { time: "1 hr ago", text: "Drafted estimate for Reyes Whole Home — 38 line items, 27% margin" },
      { time: "Yesterday", text: "Flagged missing demo line on Patel Bath" },
    ],
  },
  {
    id: "project-coordinator",
    name: "Project Coordinator",
    tagline: "Manages subcontractor scheduling and reschedules around weather.",
    description:
      "Sends day-before reminders to subs, detects schedule conflicts, and re-sequences tasks when weather, deliveries, or inspections slip.",
    icon: CalendarClock,
    category: "ops",
    status: "active",
    triggers: ["Task scheduled", "Weather alert", "Delivery delay"],
    channels: ["SMS", "Calendar", "Tasks"],
    runsThisWeek: 56,
    successRate: 89,
    lastRun: "34 min ago",
    savedHours: 8.5,
    recentActivity: [
      { time: "34 min ago", text: "Texted RC Tile crew — confirmed 8am tomorrow at Patel" },
      { time: "2 hr ago", text: "Re-sequenced Hoffman cabinets after rain forecast" },
    ],
  },
  {
    id: "client-update",
    name: "Client Update Agent",
    tagline: "Drafts weekly progress updates from real project activity.",
    description:
      "Summarizes uploaded photos, completed tasks, and milestones into a friendly weekly note for homeowners. Eliminates ~80% of 'what's the status?' texts.",
    icon: MessageSquare,
    category: "ops",
    status: "active",
    triggers: ["Weekly schedule (Fri 4pm)"],
    channels: ["Email", "SMS"],
    runsThisWeek: 9,
    successRate: 96,
    lastRun: "Yesterday",
    savedHours: 4.5,
    recentActivity: [
      { time: "Yesterday", text: "Sent updates to 9 active homeowners — 7 replies, all positive" },
    ],
  },
  {
    id: "collections",
    name: "Collections Agent",
    tagline: "Watches AR aging and nudges politely until paid.",
    description:
      "Sends progressively firmer reminders with a payment link, escalates to a human past a threshold, and pauses when partial payment lands.",
    icon: Receipt,
    category: "financials",
    status: "active",
    triggers: ["Invoice 7/14/30 days overdue"],
    channels: ["Email", "SMS", "Slack #ops"],
    runsThisWeek: 18,
    successRate: 81,
    lastRun: "4 hr ago",
    savedHours: 5.2,
    recentActivity: [
      { time: "4 hr ago", text: "Sent firm reminder to Chen Addition — invoice #INV-1042 (28 days)" },
      { time: "Yesterday", text: "Escalated Nguyen to Marcus — past 45 day threshold" },
    ],
  },
  {
    id: "change-order",
    name: "Change-Order Agent",
    tagline: "Catches scope creep and proposes priced change orders.",
    description:
      "Listens across conversations and notes for scope drift, then drafts a change order with pricing before work quietly expands.",
    icon: FileEdit,
    category: "financials",
    status: "draft",
    triggers: ["Scope keyword detected", "Manual flag"],
    channels: ["Estimates", "Email draft"],
    runsThisWeek: 0,
    successRate: 0,
    lastRun: "Never",
    savedHours: 0,
    recentActivity: [{ time: "—", text: "Not yet activated. Connect to project notes to begin." }],
  },
  {
    id: "review-agent",
    name: "Review Agent",
    tagline: "Asks for reviews at the perfect post-completion moment.",
    description:
      "Picks Google, Yelp, or Houzz based on where the client lives online, times the ask after the punch list closes, and drafts responses to incoming reviews.",
    icon: Star,
    category: "marketing",
    status: "active",
    triggers: ["Project marked complete + 3 days"],
    channels: ["Email", "SMS"],
    runsThisWeek: 6,
    successRate: 83,
    lastRun: "2 days ago",
    savedHours: 2.4,
    recentActivity: [
      { time: "2 days ago", text: "Requested Google review from Hoffman — 5★ posted" },
      { time: "5 days ago", text: "Drafted response to Patel Yelp review — approved & posted" },
    ],
  },
  {
    id: "content-agent",
    name: "Content Agent",
    tagline: "Turns before/after photos into social posts and case studies.",
    description:
      "Generates Instagram captions, LinkedIn case studies, and newsletter blurbs in your brand voice from project photos and milestones.",
    icon: Camera,
    category: "marketing",
    status: "paused",
    triggers: ["Final photos uploaded"],
    channels: ["Drafts folder"],
    runsThisWeek: 0,
    successRate: 76,
    lastRun: "8 days ago",
    savedHours: 3.1,
    recentActivity: [
      { time: "8 days ago", text: "Drafted IG carousel + LinkedIn post for Chen Addition" },
    ],
  },
  {
    id: "inbox-triage",
    name: "Inbox Triage Agent",
    tagline: "Summarizes the unified inbox and drafts replies.",
    description:
      "Tags urgency, drafts replies, and surfaces a short 'needs you today' list every morning at 7am.",
    icon: InboxIcon,
    category: "internal",
    status: "active",
    triggers: ["Daily 7:00am", "On new message"],
    channels: ["Inbox", "Email digest"],
    runsThisWeek: 7,
    successRate: 91,
    lastRun: "Today, 7:02am",
    savedHours: 6.0,
    recentActivity: [
      { time: "Today, 7:02am", text: "Triaged 23 messages — 4 flagged 'needs you today'" },
    ],
  },
  {
    id: "company-brain",
    name: "Company Brain",
    tagline: "Q&A over past estimates, warranties, SOPs, and contacts.",
    description:
      "Ask 'what did we charge for the Hendersons' cabinets?' and get the answer with a citation. Indexes closed projects, warranties, and subcontractor agreements.",
    icon: Brain,
    category: "internal",
    status: "active",
    triggers: ["On query"],
    channels: ["Slack /ask", "Web app"],
    runsThisWeek: 31,
    successRate: 95,
    lastRun: "44 min ago",
    savedHours: 7.8,
    recentActivity: [
      { time: "44 min ago", text: "Answered: 'Henderson cabinets total' — $24,180 (cited estimate #EST-887)" },
      { time: "3 hr ago", text: "Surfaced SOP: 'tile substrate prep' to Dev" },
    ],
  },
  {
    id: "voicemail",
    name: "Voicemail Agent",
    tagline: "Transcribes missed calls, classifies intent, drafts callbacks.",
    description:
      "Detects whether the caller is a new lead, existing client, or vendor, creates or updates the right CRM record, and drafts a callback message.",
    icon: Voicemail,
    category: "internal",
    status: "active",
    triggers: ["Missed call → voicemail"],
    channels: ["CRM", "SMS draft"],
    runsThisWeek: 19,
    successRate: 87,
    lastRun: "1 hr ago",
    savedHours: 3.6,
    recentActivity: [
      { time: "1 hr ago", text: "Classified VM as new lead (kitchen) — created contact + drafted reply" },
    ],
  },
];

type StatusFilter = "all" | AgentStatus;

function AgentsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | AgentCategory>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [topTab, setTopTab] = useState("agents");

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? null,
    [agents, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
    });
  }, [agents, query, category, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<AgentCategory, Agent[]>();
    filtered.forEach((a) => {
      const arr = map.get(a.category) ?? [];
      arr.push(a);
      map.set(a.category, arr);
    });
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const active = agents.filter((a) => a.status === "active").length;
    const runs = agents.reduce((sum, a) => sum + a.runsThisWeek, 0);
    const hours = agents.reduce((sum, a) => sum + a.savedHours, 0);
    const activeAgents = agents.filter((a) => a.successRate > 0);
    const avgSuccess =
      activeAgents.length === 0
        ? 0
        : Math.round(
            activeAgents.reduce((sum, a) => sum + a.successRate, 0) / activeAgents.length,
          );
    return { active, runs, hours, avgSuccess };
  }, [agents]);

  const toggleStatus = (id: string) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        if (a.status === "draft") {
          toast.info(`${a.name} is still in draft — open it to finish setup`);
          return a;
        }
        const next: AgentStatus = a.status === "active" ? "paused" : "active";
        toast.success(`${a.name} ${next === "active" ? "resumed" : "paused"}`);
        return { ...a, status: next };
      }),
    );
  };

  return (
    <div className="space-y-4">  
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">AI Center</h1>
            <Badge variant="secondary" className="h-5 rounded text-[10px]">
              <Sparkles className="mr-1 h-3 w-3" />
              {stats.active} live
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Autonomous agents, on-demand AI tools, and voice agents — all in one place.
          </p>
        </div>
      </div>

      <Tabs value={topTab} onValueChange={setTopTab}>
        <TabsList className="h-9">
          <TabsTrigger value="agents" className="px-4 text-xs">Autonomous Agents</TabsTrigger>
          <TabsTrigger value="tools" className="px-4 text-xs">AI Tools</TabsTrigger>
          <TabsTrigger value="voice" className="px-4 text-xs">Voice Agent</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4 space-y-4">
          <div className="flex items-center justify-end">
            <Button size="sm" className="h-8">
              <Plus className="h-3.5 w-3.5" />
              <span className="text-xs">New agent</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active agents" value={stats.active.toString()} icon={Activity} accent="text-success" />
        <StatCard label="Runs this week" value={stats.runs.toLocaleString()} icon={Zap} accent="text-primary" />
        <StatCard label="Hours saved" value={`${stats.hours.toFixed(1)}h`} icon={Clock} accent="text-warning" />
        <StatCard
          label="Avg success rate"
          value={`${stats.avgSuccess}%`}
          icon={TrendingUp}
          accent="text-success"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="h-7 px-2.5 text-xs">All</TabsTrigger>
            <TabsTrigger value="active" className="h-7 px-2.5 text-xs">Active</TabsTrigger>
            <TabsTrigger value="paused" className="h-7 px-2.5 text-xs">Paused</TabsTrigger>
            <TabsTrigger value="draft" className="h-7 px-2.5 text-xs">Draft</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={category} onValueChange={(v) => setCategory(v as "all" | AgentCategory)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="h-7 px-2.5 text-xs">All</TabsTrigger>
            <TabsTrigger value="sales" className="h-7 px-2.5 text-xs">Sales</TabsTrigger>
            <TabsTrigger value="ops" className="h-7 px-2.5 text-xs">Ops</TabsTrigger>
            <TabsTrigger value="financials" className="h-7 px-2.5 text-xs">Financials</TabsTrigger>
            <TabsTrigger value="marketing" className="h-7 px-2.5 text-xs">Marketing</TabsTrigger>
            <TabsTrigger value="internal" className="h-7 px-2.5 text-xs">Internal</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-5">
        {(Object.keys(CATEGORY_LABEL) as AgentCategory[]).map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          return (
            <section key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", CATEGORY_DOT[cat])} />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABEL[cat]}
                </h2>
                <span className="text-[10px] text-muted-foreground">· {items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onToggle={() => toggleStatus(agent.id)}
                    onOpen={() => setSelectedId(agent.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-xs text-muted-foreground">
            No agents match your filters.
          </Card>
        )}
      </div>

      <AgentDetailSheet
        agent={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onToggle={() => selected && toggleStatus(selected.id)}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", accent)} />
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function AgentCard({
  agent,
  onToggle,
  onOpen,
}: {
  agent: Agent;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const Icon = agent.icon;
  const isLive = agent.status === "active";
  const configured = useIsConfigured(agent.id);
  return (
    <Card
      className={cn(
        "group relative cursor-pointer p-3.5 transition-all hover:shadow-md",
        isLive && "ring-1 ring-inset ring-success/20",
      )}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
              isLive ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
              {isLive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
              )}
              {configured && (
                <Badge
                  variant="secondary"
                  className="h-4 rounded border border-primary/30 bg-primary/10 px-1 text-[9px] font-medium uppercase tracking-wider text-primary"
                  title="This agent has custom settings that differ from defaults"
                >
                  <Settings2 className="mr-0.5 h-2.5 w-2.5" />
                  Configured
                </Badge>
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {agent.tagline}
            </p>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch checked={isLive} onCheckedChange={onToggle} disabled={agent.status === "draft"} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2.5">
        <Stat label="Runs/wk" value={agent.runsThisWeek.toString()} />
        <Stat label="Success" value={agent.successRate > 0 ? `${agent.successRate}%` : "—"} />
        <Stat label="Saved" value={agent.savedHours > 0 ? `${agent.savedHours}h` : "—"} />
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <Badge
          variant="secondary"
          className={cn("h-5 rounded border px-1.5 text-[10px] capitalize", STATUS_STYLE[agent.status])}
        >
          {agent.status}
        </Badge>
        <span className="text-[10px] text-muted-foreground">Last run · {agent.lastRun}</span>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function useIsConfigured(id: string): boolean {
  const [configured, setConfigured] = useState(false);
  useEffect(() => {
    const update = () => setConfigured(isAgentConfigured(id));
    update();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string } | undefined;
      if (!detail?.id || detail.id === id) update();
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === `agent-config:${id}`) update();
    };
    window.addEventListener("agent-config-change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("agent-config-change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [id]);
  return configured;
}

function AgentDetailSheet({
  agent,
  onOpenChange,
  onToggle,
}: {
  agent: Agent | null;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
}) {
  return (
    <Sheet open={!!agent} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {agent && <AgentDetail agent={agent} onToggle={onToggle} />}
      </SheetContent>
    </Sheet>
  );
}

function AgentDetail({ agent, onToggle }: { agent: Agent; onToggle: () => void }) {
  const Icon = agent.icon;
  const isLive = agent.status === "active";
  const [configOpen, setConfigOpen] = useState(false);
  return (
    <div className="space-y-4">
      <SheetHeader className="space-y-2 px-0 text-left">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md border",
              isLive ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base">{agent.name}</SheetTitle>
            <Badge
              variant="secondary"
              className={cn("mt-1 h-5 rounded border px-1.5 text-[10px] capitalize", STATUS_STYLE[agent.status])}
            >
              {agent.status}
            </Badge>
          </div>
        </div>
        <SheetDescription className="text-xs leading-relaxed">
          {agent.description}
        </SheetDescription>
      </SheetHeader>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isLive ? "outline" : "default"}
          className="h-8 flex-1"
          onClick={onToggle}
          disabled={agent.status === "draft"}
        >
          {isLive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span className="text-xs">{isLive ? "Pause agent" : agent.status === "draft" ? "Finish setup" : "Resume agent"}</span>
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={() => setConfigOpen(true)}>
          <Settings2 className="h-3.5 w-3.5" />
          <span className="text-xs">Configure</span>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <DetailStat label="Runs/wk" value={agent.runsThisWeek.toString()} />
        <DetailStat label="Success" value={agent.successRate > 0 ? `${agent.successRate}%` : "—"} />
        <DetailStat label="Saved" value={agent.savedHours > 0 ? `${agent.savedHours}h` : "—"} />
      </div>

      <Separator />

      <Section title="Triggers" icon={Zap}>
        <div className="flex flex-wrap gap-1.5">
          {agent.triggers.map((t) => (
            <Badge key={t} variant="secondary" className="h-5 rounded text-[10px]">
              {t}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Channels" icon={Megaphone}>
        <div className="flex flex-wrap gap-1.5">
          {agent.channels.map((c) => (
            <Badge key={c} variant="outline" className="h-5 rounded text-[10px]">
              {c}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Recent activity" icon={PhoneCall}>
        <div className="space-y-2">
          {agent.recentActivity.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] leading-snug">{a.text}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {agent.status === "draft" && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <p className="text-[11px] leading-snug text-warning">
            This agent is in draft. Connect required data sources and test before activating.
          </p>
        </div>
      )}

      <AgentConfigureDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        agentId={agent.id}
        agentName={agent.name}
        triggers={agent.triggers}
        channels={agent.channels}
      />
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-2.5">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      {children}
    </div>
  );
}
