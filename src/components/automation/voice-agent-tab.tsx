import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Phone,
  Plus,
  Pause,
  Play,
  Settings2,
  Monitor,
  ScrollText,
  PhoneCall,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

type VoiceAgentStatus = "active" | "paused" | "draft";

const STATUS_STYLE: Record<VoiceAgentStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  paused: "bg-muted text-muted-foreground border-border",
  draft: "bg-warning/15 text-warning border-warning/30",
};

type VoiceAgent = {
  id: string;
  name: string;
  tagline: string;
  status: VoiceAgentStatus;
  phoneNumber: string;
  totalCalls: number;
  successRate: number;
  hoursSaved: number;
  systemPrompt: string;
  greetingMessage: string;
  voice: string;
  llmModel: string;
  endCallPhrases: string;
  crmTools: { saveLeads: boolean; checkAvailability: boolean; bookAppointment: boolean; getServiceInfo: boolean };
  phoneNumbers: { number: string; status: string }[];
};

const DEFAULT_AGENTS: VoiceAgent[] = [
  {
    id: "inbound-receptionist",
    name: "Inbound Receptionist",
    tagline: "Answers calls, qualifies leads, checks availability, and books appointments — 24/7.",
    status: "draft",
    phoneNumber: "—",
    totalCalls: 0,
    successRate: 0,
    hoursSaved: 0,
    systemPrompt: "You are a friendly and professional receptionist for a home renovation company. Your job is to answer incoming calls, qualify leads by asking about their project type, timeline, and budget range, check the team's calendar for availability, and book appointments. Always be warm, helpful, and concise.",
    greetingMessage: "Hi there! Thanks for calling. My name is Sarah and I'd love to help you get started on your project. Can I ask what type of work you're looking to have done?",
    voice: "Rachel",
    llmModel: "Claude",
    endCallPhrases: "goodbye, bye, thank you bye, have a good day",
    crmTools: { saveLeads: true, checkAvailability: true, bookAppointment: true, getServiceInfo: true },
    phoneNumbers: [],
  },
];

export function VoiceAgentTab() {
  const [agents, setAgents] = useState<VoiceAgent[]>(DEFAULT_AGENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  const handleAddAgent = () => {
    const newAgent: VoiceAgent = {
      id: `voice-agent-${Date.now()}`,
      name: "New Voice Agent",
      tagline: "Configure this agent to handle calls.",
      status: "draft",
      phoneNumber: "—",
      totalCalls: 0,
      successRate: 0,
      hoursSaved: 0,
      systemPrompt: "",
      greetingMessage: "",
      voice: "Rachel",
      llmModel: "Claude",
      endCallPhrases: "goodbye, bye",
      crmTools: { saveLeads: false, checkAvailability: false, bookAppointment: false, getServiceInfo: false },
      phoneNumbers: [],
    };
    setAgents((prev) => [...prev, newAgent]);
    setSelectedId(newAgent.id);
    toast.success("New voice agent created");
  };

  const toggleStatus = (id: string) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        if (a.status === "draft") {
          toast.info(`${a.name} is still in draft — configure it first`);
          return a;
        }
        const next: VoiceAgentStatus = a.status === "active" ? "paused" : "active";
        toast.success(`${a.name} ${next === "active" ? "resumed" : "paused"}`);
        return { ...a, status: next };
      }),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Voice agents handle inbound and outbound calls with AI-powered conversations.
        </p>
        <Button size="sm" className="h-8" onClick={handleAddAgent}>
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">New Agent</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <VoiceAgentCard
            key={agent.id}
            agent={agent}
            onOpen={() => setSelectedId(agent.id)}
          />
        ))}
      </div>

      <VoiceAgentDrawer
        agent={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onToggle={() => selected && toggleStatus(selected.id)}
      />
    </div>
  );
}

function VoiceAgentCard({ agent, onOpen }: { agent: VoiceAgent; onOpen: () => void }) {
  const isLive = agent.status === "active";
  return (
    <Card
      className={cn(
        "group cursor-pointer p-3.5 transition-all hover:shadow-md",
        isLive && "ring-1 ring-inset ring-success/20",
      )}
      onClick={onOpen}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
            "border-primary/30 bg-primary/10 text-primary",
          )}
        >
          <Phone className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
            {isLive && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {agent.tagline}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
        <Badge
          variant="secondary"
          className={cn("h-5 rounded border px-1.5 text-[10px] capitalize", STATUS_STYLE[agent.status])}
        >
          {agent.status}
        </Badge>
        <span className="text-[10px] text-muted-foreground">📞 {agent.phoneNumber}</span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <SmallStat label="Total calls" value={agent.totalCalls.toString()} />
        <SmallStat label="Success" value={agent.successRate > 0 ? `${agent.successRate}%` : "—"} />
        <SmallStat label="Saved" value={agent.hoursSaved > 0 ? `${agent.hoursSaved}h` : "—"} />
      </div>
    </Card>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function VoiceAgentDrawer({
  agent,
  onOpenChange,
  onToggle,
}: {
  agent: VoiceAgent | null;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
}) {
  return (
    <Sheet open={!!agent} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {agent && <VoiceAgentDetail agent={agent} onToggle={onToggle} />}
      </SheetContent>
    </Sheet>
  );
}

function VoiceAgentDetail({ agent, onToggle }: { agent: VoiceAgent; onToggle: () => void }) {
  const isLive = agent.status === "active";

  return (
    <div className="space-y-4">
      <SheetHeader className="space-y-2 px-0 text-left">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md border",
              "border-primary/30 bg-primary/10 text-primary",
            )}
          >
            <Phone className="h-5 w-5" />
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
        <SheetDescription className="text-xs leading-relaxed">{agent.tagline}</SheetDescription>
      </SheetHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Total calls" value={agent.totalCalls.toString()} icon={PhoneCall} />
        <StatCard label="Success" value={agent.successRate > 0 ? `${agent.successRate}%` : "—"} icon={TrendingUp} />
        <StatCard label="Saved" value={agent.hoursSaved > 0 ? `${agent.hoursSaved}h` : "—"} icon={Clock} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={isLive ? "outline" : "default"}
          className="h-8 flex-1"
          onClick={onToggle}
          disabled={agent.status === "draft"}
        >
          {isLive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          <span className="text-xs">{isLive ? "Pause" : agent.status === "draft" ? "Finish setup" : "Resume"}</span>
        </Button>
        <Button size="sm" variant="outline" className="h-8">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="text-xs">Configure</span>
        </Button>
        <Button size="sm" variant="outline" className="h-8">
          <Monitor className="h-3.5 w-3.5" />
          <span className="text-xs">Test in Browser</span>
        </Button>
        <Link to={ROUTES.CALL_LOGS}>
          <Button size="sm" variant="outline" className="h-8">
            <ScrollText className="h-3.5 w-3.5" />
            <span className="text-xs">View Call Logs</span>
          </Button>
        </Link>
      </div>

      <Separator />

      {/* Configure Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Configure</h3>
        <div className="space-y-1">
          <Label className="text-xs">Agent Name</Label>
          <Input defaultValue={agent.name} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">System Prompt</Label>
          <Textarea defaultValue={agent.systemPrompt} className="min-h-[100px] text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Greeting Message</Label>
          <Textarea defaultValue={agent.greetingMessage} className="min-h-[60px] text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Voice</Label>
            <Select defaultValue={agent.voice}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Rachel", "Sarah", "Emily", "Josh", "Adam", "Antoni"].map((v) => (
                  <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">LLM Model</Label>
            <Select defaultValue={agent.llmModel}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Claude", "GPT-4o", "Gemini"].map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End-Call Phrases</Label>
          <Input defaultValue={agent.endCallPhrases} className="h-8 text-xs" placeholder="goodbye, bye, thank you bye" />
        </div>
      </div>

      <Separator />

      {/* CRM Tools */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">CRM Tools</h3>
        {[
          { key: "saveLeads" as const, label: "Save Lead", desc: "Saves caller contact info to CRM" },
          { key: "checkAvailability" as const, label: "Check Availability", desc: "Checks calendar for open slots" },
          { key: "bookAppointment" as const, label: "Book Appointment", desc: "Books confirmed appointments" },
          { key: "getServiceInfo" as const, label: "Get Service Info", desc: "Retrieves pricing and service details" },
        ].map((tool) => (
          <div key={tool.key} className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-2.5">
            <div>
              <div className="text-xs font-medium">{tool.label}</div>
              <div className="text-[10px] text-muted-foreground">{tool.desc}</div>
            </div>
            <Switch defaultChecked={agent.crmTools[tool.key]} />
          </div>
        ))}
      </div>

      <Separator />

      {/* Phone Numbers */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Numbers</h3>
        {agent.phoneNumbers.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No phone numbers assigned yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Number</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agent.phoneNumbers.map((pn) => (
                <TableRow key={pn.number}>
                  <TableCell className="text-xs">{pn.number}</TableCell>
                  <TableCell className="text-xs">{pn.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Button size="sm" variant="outline" className="h-7 text-xs">
          <Plus className="h-3 w-3" />
          Assign Number
        </Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card className="p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </Card>
  );
}