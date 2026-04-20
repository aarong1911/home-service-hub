import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings2, Zap, Megaphone, MessageSquare, Shield, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Per-agent tunable configuration. Persisted to localStorage under
 * `agent-config:<agentId>` so edits survive reloads without a backend.
 */
export type AgentConfig = {
  tone: "professional" | "friendly" | "concise" | "persuasive";
  autonomy: number; // 0-100: how aggressively the agent acts without human approval
  maxRunsPerDay: number;
  autoHandoffAfterMessages: number; // escalate to human after N back-and-forths
  businessHoursOnly: boolean;
  weekendsEnabled: boolean;
  requireApproval: boolean; // if true, drafts are queued for human review
  triggersEnabled: Record<string, boolean>;
  channelsEnabled: Record<string, boolean>;
  customInstructions: string;
};

function defaultConfig(triggers: string[], channels: string[]): AgentConfig {
  return {
    tone: "friendly",
    autonomy: 60,
    maxRunsPerDay: 50,
    autoHandoffAfterMessages: 4,
    businessHoursOnly: false,
    weekendsEnabled: true,
    requireApproval: false,
    triggersEnabled: Object.fromEntries(triggers.map((t) => [t, true])),
    channelsEnabled: Object.fromEntries(channels.map((c) => [c, true])),
    customInstructions: "",
  };
}

function storageKey(id: string) {
  return `agent-config:${id}`;
}

export function loadAgentConfig(id: string, triggers: string[], channels: string[]): AgentConfig {
  if (typeof window === "undefined") return defaultConfig(triggers, channels);
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return defaultConfig(triggers, channels);
    const parsed = JSON.parse(raw) as Partial<AgentConfig>;
    const base = defaultConfig(triggers, channels);
    return {
      ...base,
      ...parsed,
      triggersEnabled: { ...base.triggersEnabled, ...(parsed.triggersEnabled ?? {}) },
      channelsEnabled: { ...base.channelsEnabled, ...(parsed.channelsEnabled ?? {}) },
    };
  } catch {
    return defaultConfig(triggers, channels);
  }
}

function saveAgentConfig(id: string, cfg: AgentConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(id), JSON.stringify(cfg));
}

export type AgentConfigureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  triggers: string[];
  channels: string[];
  onSaved?: (cfg: AgentConfig) => void;
};

export function AgentConfigureDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  triggers,
  channels,
  onSaved,
}: AgentConfigureDialogProps) {
  const initial = useMemo(
    () => loadAgentConfig(agentId, triggers, channels),
    [agentId, triggers, channels],
  );
  const [cfg, setCfg] = useState<AgentConfig>(initial);

  // Re-sync whenever the dialog is reopened for a different agent
  useEffect(() => {
    if (open) setCfg(loadAgentConfig(agentId, triggers, channels));
  }, [open, agentId, triggers, channels]);

  const handleSave = () => {
    saveAgentConfig(agentId, cfg);
    toast.success(`${agentName} settings saved`);
    onSaved?.(cfg);
    onOpenChange(false);
  };

  const handleReset = () => {
    const fresh = defaultConfig(triggers, channels);
    setCfg(fresh);
    toast.info("Reset to defaults — click Save to apply");
  };

  const autonomyLabel =
    cfg.autonomy < 33 ? "Cautious" : cfg.autonomy < 66 ? "Balanced" : "Aggressive";
  const autonomyDesc =
    cfg.autonomy < 33
      ? "Drafts everything for human review before sending."
      : cfg.autonomy < 66
        ? "Acts on routine tasks, escalates edge cases."
        : "Takes action independently; only escalates on clear conflicts.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Configure {agentName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tune how this agent behaves, which triggers fire it, and which channels it can use.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="behavior" className="mt-2">
          <TabsList className="h-8">
            <TabsTrigger value="behavior" className="h-7 px-2.5 text-xs">Behavior</TabsTrigger>
            <TabsTrigger value="triggers" className="h-7 px-2.5 text-xs">
              Triggers <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{triggers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="channels" className="h-7 px-2.5 text-xs">
              Channels <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{channels.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="guardrails" className="h-7 px-2.5 text-xs">Guardrails</TabsTrigger>
          </TabsList>

          {/* BEHAVIOR */}
          <TabsContent value="behavior" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tone of voice</Label>
              <Select
                value={cfg.tone}
                onValueChange={(v) => setCfg((c) => ({ ...c, tone: v as AgentConfig["tone"] }))}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional — formal and polished</SelectItem>
                  <SelectItem value="friendly">Friendly — warm, conversational</SelectItem>
                  <SelectItem value="concise">Concise — short and direct</SelectItem>
                  <SelectItem value="persuasive">Persuasive — leans into the close</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Autonomy</Label>
                <Badge
                  variant="secondary"
                  className={cn(
                    "h-5 rounded border text-[10px]",
                    cfg.autonomy < 33 && "border-warning/30 bg-warning/10 text-warning",
                    cfg.autonomy >= 33 && cfg.autonomy < 66 && "border-primary/30 bg-primary/10 text-primary",
                    cfg.autonomy >= 66 && "border-success/30 bg-success/15 text-success",
                  )}
                >
                  {autonomyLabel} · {cfg.autonomy}%
                </Badge>
              </div>
              <Slider
                value={[cfg.autonomy]}
                onValueChange={([v]) => setCfg((c) => ({ ...c, autonomy: v }))}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-[11px] text-muted-foreground">{autonomyDesc}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Max runs / day</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={cfg.maxRunsPerDay}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, maxRunsPerDay: Number(e.target.value) || 0 }))
                  }
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Hand off after N turns</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={cfg.autoHandoffAfterMessages}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, autoHandoffAfterMessages: Number(e.target.value) || 1 }))
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Custom instructions</Label>
              <Textarea
                value={cfg.customInstructions}
                onChange={(e) => setCfg((c) => ({ ...c, customInstructions: e.target.value }))}
                placeholder="e.g. Always mention our 2-year workmanship warranty. Don't quote prices below $15k over text."
                className="min-h-[72px] text-xs"
              />
            </div>
          </TabsContent>

          {/* TRIGGERS */}
          <TabsContent value="triggers" className="mt-4 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Choose which events fire this agent. Disabled triggers are skipped.
            </p>
            {triggers.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No triggers configured yet.
              </div>
            ) : (
              triggers.map((t) => (
                <div
                  key={t}
                  className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-xs font-medium">{t}</span>
                  </div>
                  <Switch
                    checked={cfg.triggersEnabled[t] ?? true}
                    onCheckedChange={(checked) =>
                      setCfg((c) => ({
                        ...c,
                        triggersEnabled: { ...c.triggersEnabled, [t]: checked },
                      }))
                    }
                  />
                </div>
              ))
            )}
          </TabsContent>

          {/* CHANNELS */}
          <TabsContent value="channels" className="mt-4 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Control which channels the agent can send through.
            </p>
            {channels.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                No channels configured yet.
              </div>
            ) : (
              channels.map((ch) => (
                <div
                  key={ch}
                  className="flex items-center justify-between rounded-md border border-border bg-secondary/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate text-xs font-medium">{ch}</span>
                  </div>
                  <Switch
                    checked={cfg.channelsEnabled[ch] ?? true}
                    onCheckedChange={(checked) =>
                      setCfg((c) => ({
                        ...c,
                        channelsEnabled: { ...c.channelsEnabled, [ch]: checked },
                      }))
                    }
                  />
                </div>
              ))
            )}
          </TabsContent>

          {/* GUARDRAILS */}
          <TabsContent value="guardrails" className="mt-4 space-y-3">
            <GuardrailRow
              icon={Shield}
              title="Require human approval"
              description="Draft everything to a review queue instead of sending automatically."
              checked={cfg.requireApproval}
              onChange={(v) => setCfg((c) => ({ ...c, requireApproval: v }))}
            />
            <Separator />
            <GuardrailRow
              icon={MessageSquare}
              title="Business hours only"
              description="Pause outbound messages outside 8am–6pm local time."
              checked={cfg.businessHoursOnly}
              onChange={(v) => setCfg((c) => ({ ...c, businessHoursOnly: v }))}
            />
            <Separator />
            <GuardrailRow
              icon={MessageSquare}
              title="Run on weekends"
              description="Allow the agent to work Saturdays and Sundays."
              checked={cfg.weekendsEnabled}
              onChange={(v) => setCfg((c) => ({ ...c, weekendsEnabled: v }))}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" size="sm" className="h-8" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-xs">Reset to defaults</span>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => onOpenChange(false)}>
              <span className="text-xs">Cancel</span>
            </Button>
            <Button size="sm" className="h-8" onClick={handleSave}>
              <span className="text-xs">Save changes</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuardrailRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2 min-w-0">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="text-xs font-medium">{title}</div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}