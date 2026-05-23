// src/components/automation/voice-agent-tab.tsx
import { useState, useEffect, useCallback } from "react";
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
  Save,
  Monitor,
  ScrollText,
  PhoneCall,
  Clock,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import type { LucideIcon } from "lucide-react";

type VoiceAgentStatus = "active" | "paused" | "draft";

const STATUS_STYLE: Record<VoiceAgentStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  paused: "bg-muted text-muted-foreground border-border",
  draft: "bg-warning/15 text-warning border-warning/30",
};

type VoiceAgent = {
  id: string;
  vapi_assistant_id: string | null;
  name: string;
  tagline: string;
  status: VoiceAgentStatus;
  system_prompt: string;
  first_message: string;
  voice_id: string;
  llm_model: string;
  end_call_phrases: string;
  crm_tools: {
    saveLeads: boolean;
    checkAvailability: boolean;
    bookAppointment: boolean;
    getServiceInfo: boolean;
  };
  phone_numbers: { number: string; status: string; id: string }[];
  total_calls: number;
  success_rate: number;
  hours_saved: number;
};

async function getOrgId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.organization_id) return profile.organization_id;
  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("member_id", user.id)
    .maybeSingle();
  return membership?.org_id ?? null;
}

export function VoiceAgentTab() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = agents.find((a) => a.id === selectedId) ?? null;

  const loadAgents = useCallback(async () => {
    try {
      const orgId = await getOrgId();
      if (!orgId) return;

      const { data, error } = await supabase
        .from("voice_agents")
        .select("*")
        .eq("tenant_id", orgId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load voice agents:", error);
        return;
      }

      if (!data || data.length === 0) {
        // No agents yet — show default template
        setAgents([
          {
            id: "new",
            vapi_assistant_id: null,
            name: "Inbound Receptionist",
            tagline:
              "Answers calls, qualifies leads, checks availability, and books appointments — 24/7.",
            status: "draft",
            system_prompt:
              "You are a friendly and professional receptionist for a home renovation company. Your job is to answer incoming calls, qualify leads by asking about their project type, timeline, and budget range, check the team's calendar for availability, and book appointments. Always be warm, helpful, and concise.",
            first_message:
              "Hi there! Thanks for calling. My name is Sarah and I'd love to help you get started on your project. Can I ask what type of work you're looking to have done?",
            voice_id: "21m00Tcm4TlvDq8ikWAM",
            llm_model: "claude-sonnet-4-20250514",
            end_call_phrases: "goodbye, bye, thank you bye",
            crm_tools: {
              saveLeads: true,
              checkAvailability: true,
              bookAppointment: true,
              getServiceInfo: true,
            },
            phone_numbers: [],
            total_calls: 0,
            success_rate: 0,
            hours_saved: 0,
          },
        ]);
        return;
      }

      // Load phone numbers for each agent
      const agentIds = data.map((a: any) => a.id);
      const { data: phoneNumbers } = await supabase
        .from("voice_phone_numbers")
        .select("*")
        .eq("tenant_id", orgId)
        .in("agent_id", agentIds);

      // Load call stats
      const { data: callStats } = await supabase
        .from("voice_calls")
        .select("agent_id, status")
        .eq("tenant_id", orgId);

      const agents: VoiceAgent[] = data.map((a: any) => {
        const nums = (phoneNumbers || []).filter(
          (pn: any) => pn.agent_id === a.id
        );
        const calls = (callStats || []).filter(
          (c: any) => c.agent_id === a.id
        );
        const totalCalls = calls.length;
        const successCalls = calls.filter(
          (c: any) => c.status === "completed"
        ).length;

        return {
          id: a.id,
          vapi_assistant_id: a.vapi_assistant_id,
          name: a.name || "Voice Agent",
          tagline:
            a.first_message?.substring(0, 80) + "..." ||
            "Configure this agent to handle calls.",
          status: a.is_active
            ? "active"
            : a.vapi_assistant_id
              ? "paused"
              : "draft",
          system_prompt: a.system_prompt || "",
          first_message: a.first_message || "",
          voice_id: a.voice_id || "Rachel",
          llm_model: a.llm_model || "claude-sonnet-4-20250514",
          end_call_phrases: "goodbye, bye, thank you bye",
          crm_tools: {
            saveLeads: true,
            checkAvailability: true,
            bookAppointment: true,
            getServiceInfo: true,
          },
          phone_numbers: nums.map((pn: any) => ({
            id: pn.id,
            number: pn.number || "—",
            status: pn.agent_id ? "assigned" : "available",
          })),
          total_calls: totalCalls,
          success_rate:
            totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0,
          hours_saved: Math.round(totalCalls * 0.15 * 10) / 10,
        };
      });

      setAgents(agents);
    } catch (err) {
      console.error("Failed to load voice agents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleAddAgent = async () => {
    const orgId = await getOrgId();
    if (!orgId) {
      toast.error("Could not determine organization");
      return;
    }

    const { data, error } = await supabase
  .from("voice_agents")
  .insert({
    tenant_id: orgId,
    name: "New Voice Agent",
    system_prompt: "",
    first_message: "",
    voice_id: "21m00Tcm4TlvDq8ikWAM",
    voice_provider: "11labs",
    llm_model: "claude-sonnet-4-20250514",
    is_active: false,
  } as any)
  .select()
  .single();

    if (error) {
      toast.error("Failed to create agent: " + error.message);
      return;
    }

    toast.success("New voice agent created");
    await loadAgents();
    setSelectedId(data.id);
  };

  const toggleStatus = async (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;

    if (agent.status === "draft") {
      toast.info(`${agent.name} is still in draft — configure and save first`);
      return;
    }

    const newActive = agent.status !== "active";
    const { error } = await supabase
      .from("voice_agents")
      .update({ is_active: newActive })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    toast.success(
      `${agent.name} ${newActive ? "resumed" : "paused"}`
    );
    await loadAgents();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Voice agents handle inbound and outbound calls with AI-powered
          conversations.
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
        onSaved={loadAgents}
      />
    </div>
  );
}

function VoiceAgentCard({
  agent,
  onOpen,
}: {
  agent: VoiceAgent;
  onOpen: () => void;
}) {
  const isLive = agent.status === "active";
  const phoneDisplay =
    agent.phone_numbers.length > 0 ? agent.phone_numbers[0].number : "—";
  return (
    <Card
      className={cn(
        "group cursor-pointer p-3.5 transition-all hover:shadow-md",
        isLive && "ring-1 ring-inset ring-success/20"
      )}
      onClick={onOpen}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
            "border-primary/30 bg-primary/10 text-primary"
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
          className={cn(
            "h-5 rounded border px-1.5 text-[10px] capitalize",
            STATUS_STYLE[agent.status]
          )}
        >
          {agent.status}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          📞 {phoneDisplay}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <SmallStat label="Total calls" value={agent.total_calls.toString()} />
        <SmallStat
          label="Success"
          value={agent.success_rate > 0 ? `${agent.success_rate}%` : "—"}
        />
        <SmallStat
          label="Saved"
          value={agent.hours_saved > 0 ? `${agent.hours_saved}h` : "—"}
        />
      </div>
    </Card>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function VoiceAgentDrawer({
  agent,
  onOpenChange,
  onToggle,
  onSaved,
}: {
  agent: VoiceAgent | null;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={!!agent} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {agent && (
          <VoiceAgentDetail
            agent={agent}
            onToggle={onToggle}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function VoiceAgentDetail({
  agent,
  onToggle,
  onSaved,
}: {
  agent: VoiceAgent;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const isLive = agent.status === "active";
  const [saving, setSaving] = useState(false);

  // Local form state
  const [name, setName] = useState(agent.name);
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [greeting, setGreeting] = useState(agent.first_message);
  const [voice, setVoice] = useState(agent.voice_id);
  const [llm, setLlm] = useState(agent.llm_model);
  const [endPhrases, setEndPhrases] = useState(agent.end_call_phrases);
  const [crmTools, setCrmTools] = useState(agent.crm_tools);

  // Reset form when agent changes
  useEffect(() => {
    setName(agent.name);
    setSystemPrompt(agent.system_prompt);
    setGreeting(agent.first_message);
    setVoice(agent.voice_id);
    setLlm(agent.llm_model);
    setEndPhrases(agent.end_call_phrases);
    setCrmTools(agent.crm_tools);
  }, [agent]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to Supabase
      const { error } = await supabase
        .from("voice_agents")
        .update({
          name,
          system_prompt: systemPrompt,
          first_message: greeting,
          voice_id: voice,
          llm_model: llm,
          updated_at: new Date().toISOString(),
        })
        .eq("id", agent.id);

      if (error) {
        toast.error("Failed to save: " + error.message);
        return;
      }

      // Sync with Vapi — create or update assistant
try {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (token) {
    if (agent.vapi_assistant_id) {
      // Update existing
      await fetch("/.netlify/functions/vapi-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: `/assistant/${agent.vapi_assistant_id}`,
          method: "PATCH",
          body: {
            name,
            firstMessage: greeting,
            model: {
              provider: "anthropic",
              model: llm,
              systemPrompt,
            },
            voice: {
              provider: "11labs",
              voiceId: voice,
            },
          },
        }),
      });
    } else {
      // Create new Vapi assistant
      const createRes = await fetch("/.netlify/functions/vapi-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path: "/assistant",
          method: "POST",
          body: {
            name,
            firstMessage: greeting,
            model: {
              provider: "anthropic",
              model: llm,
              systemPrompt,
            },
            voice: {
              provider: "11labs",
              voiceId: voice,
            },
            transcriber: {
              provider: "deepgram",
              model: "nova-2",
            },
            endCallPhrases: endPhrases.split(",").map((p) => p.trim()),
          },
        }),
      });
      if (createRes.ok) {
        const vapiData = await createRes.json();
        // The vapi-proxy syncs vapi_assistant_id to Supabase automatically
        toast.success("Vapi assistant created and linked");
      }
    }
  }
} catch (vapiErr) {
  console.warn("Vapi sync failed, local save succeeded", vapiErr);
}

      toast.success("Agent saved");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTestInBrowser = () => {
    if (!agent.vapi_assistant_id) {
      toast.error(
        "Save the agent first, then assign a Vapi assistant to enable testing"
      );
      return;
    }
    toast.info(
      "Browser testing requires the Vapi Web SDK. Coming soon — use a phone call to test for now."
    );
  };

  return (
    <div className="space-y-4">
      <SheetHeader className="space-y-2 px-0 text-left">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md border",
              "border-primary/30 bg-primary/10 text-primary"
            )}
          >
            <Phone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base">{agent.name}</SheetTitle>
            <Badge
              variant="secondary"
              className={cn(
                "mt-1 h-5 rounded border px-1.5 text-[10px] capitalize",
                STATUS_STYLE[agent.status]
              )}
            >
              {agent.status}
            </Badge>
          </div>
        </div>
        <SheetDescription className="text-xs leading-relaxed">
          {agent.tagline}
        </SheetDescription>
      </SheetHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Total calls"
          value={agent.total_calls.toString()}
          icon={PhoneCall}
        />
        <StatCard
          label="Success"
          value={
            agent.success_rate > 0 ? `${agent.success_rate}%` : "—"
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Saved"
          value={agent.hours_saved > 0 ? `${agent.hours_saved}h` : "—"}
          icon={Clock}
        />
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
          {isLive ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span className="text-xs">
            {isLive
              ? "Pause"
              : agent.status === "draft"
                ? "Finish setup"
                : "Resume"}
          </span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="text-xs">{saving ? "Saving…" : "Save"}</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={handleTestInBrowser}
        >
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Configure
        </h3>
        <div className="space-y-1">
          <Label className="text-xs">Agent Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">System Prompt</Label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="min-h-[100px] text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Greeting Message</Label>
          <Textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            className="min-h-[60px] text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Voice</Label>
            <Select value={voice} onValueChange={setVoice}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
               { label: "Rachel", value: "21m00Tcm4TlvDq8ikWAM" },
               { label: "Sarah", value: "EXAVITQu4vr4xnSDxMaL" },
               { label: "Emily", value: "LcfcDJNUP1GQjkzn1xUU" },
               { label: "Josh", value: "TxGEqnHWrfWFTfGW9XjX" },
               { label: "Adam", value: "pNInz6obpgDQGcFmaJgB" },
               { label: "Antoni", value: "ErXwobaYiN019PkySvjV" },
           ].map((v) => (
             <SelectItem key={v.value} value={v.value} className="text-xs">
                {v.label}
             </SelectItem>
       ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">LLM Model</Label>
            <Select value={llm} onValueChange={setLlm}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  { label: "Claude Sonnet 4", value: "claude-sonnet-4-20250514" },
                  { label: "Claude Haiku", value: "claude-haiku-4-5-20251001" },
                  { label: "GPT-4o", value: "gpt-4o" },
                ].map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End-Call Phrases</Label>
          <Input
            value={endPhrases}
            onChange={(e) => setEndPhrases(e.target.value)}
            className="h-8 text-xs"
            placeholder="goodbye, bye, thank you bye"
          />
        </div>
      </div>

      <Separator />

      {/* CRM Tools */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          CRM Tools
        </h3>
        {[
          {
            key: "saveLeads" as const,
            label: "Save Lead",
            desc: "Saves caller contact info to CRM",
          },
          {
            key: "checkAvailability" as const,
            label: "Check Availability",
            desc: "Checks calendar for open slots",
          },
          {
            key: "bookAppointment" as const,
            label: "Book Appointment",
            desc: "Books confirmed appointments",
          },
          {
            key: "getServiceInfo" as const,
            label: "Get Service Info",
            desc: "Retrieves pricing and service details",
          },
        ].map((tool) => (
          <div
            key={tool.key}
            className="flex items-center justify-between rounded-md border border-border bg-secondary/30 p-2.5"
          >
            <div>
              <div className="text-xs font-medium">{tool.label}</div>
              <div className="text-[10px] text-muted-foreground">
                {tool.desc}
              </div>
            </div>
            <Switch
              checked={crmTools[tool.key]}
              onCheckedChange={(checked) =>
                setCrmTools((prev) => ({ ...prev, [tool.key]: checked }))
              }
            />
          </div>
        ))}
      </div>

      <Separator />

      {/* Phone Numbers */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Phone Numbers
        </h3>
        {agent.phone_numbers.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No phone numbers assigned yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Number</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agent.phone_numbers.map((pn) => (
                <TableRow key={pn.id}>
                  <TableCell className="text-xs">{pn.number}</TableCell>
                  <TableCell className="text-xs capitalize">
                    {pn.status}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() =>
            toast.info(
              "Phone number assignment requires a Vapi account with Twilio numbers configured."
            )
          }
        >
          <Plus className="h-3 w-3" />
          Assign Number
        </Button>
      </div>

      {/* Save button at bottom */}
      <div className="sticky bottom-0 border-t border-border bg-background pt-3 pb-1">
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{saving ? "Saving…" : "Save Changes"}</span>
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">
        {value}
      </div>
    </Card>
  );
}