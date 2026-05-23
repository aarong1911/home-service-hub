import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search,
  Play,
  Copy,
  FileDown,
  Loader2,
  FileText,
  TrendingUp,
  Brain,
  MessageSquare,
  ListChecks,
  BarChart3,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

type ToolCategory = "sales" | "crm" | "operations";

const CATEGORY_LABEL: Record<ToolCategory, string> = {
  sales: "Sales",
  crm: "CRM Intelligence",
  operations: "Operations & Insights",
};

const CATEGORY_COLOR: Record<ToolCategory, string> = {
  sales: "bg-primary/15 text-primary border-primary/30",
  crm: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  operations: "bg-success/15 text-success border-success/30",
};

const CATEGORY_ACCENT: Record<ToolCategory, string> = {
  sales: "ring-primary/20",
  crm: "ring-purple-500/20",
  operations: "ring-success/20",
};

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "select" | "date";
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  options?: string[];
};

type AITool = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: ToolCategory;
  beta?: boolean;
  fields: FieldDef[];
  outputSections: string[];
};

const TOOLS: AITool[] = [
  {
    id: "proposal-writer",
    name: "Proposal Writer",
    description: "Writes a professional project proposal tailored to the client and job type, ready to send or customize.",
    icon: FileText,
    category: "sales",
    fields: [
      { key: "clientName", label: "Client Name", type: "text" },
      { key: "companyName", label: "Company Name", type: "text" },
      { key: "projectType", label: "Project Type", type: "select", options: ["Kitchen Remodel", "Bathroom Remodel", "Addition", "Full Renovation", "Roofing", "Siding", "Windows", "Flooring", "Painting", "Other"] },
      { key: "address", label: "Address", type: "text" },
      { key: "projectDescription", label: "Project Description", type: "textarea" },
      { key: "estimatedValue", label: "Estimated Value", type: "number", prefix: "$" },
      { key: "timeline", label: "Timeline", type: "select", options: ["1-2 weeks", "2-4 weeks", "1-2 months", "2-4 months", "4-6 months", "6+ months"] },
    ],
    outputSections: ["Executive Summary", "Scope of Work", "Approach and Timeline", "Investment Breakdown", "Call to Action"],
  },
  {
    id: "pipeline-coach",
    name: "Pipeline Coach",
    description: "Analyzes deals stuck in the pipeline, delivers coaching, scripts, and next actions to move them forward.",
    icon: TrendingUp,
    category: "sales",
    fields: [
      { key: "dealName", label: "Deal Name", type: "text" },
      { key: "pipelineStage", label: "Pipeline Stage", type: "select", options: ["New Lead", "Discovery", "Site Visit", "Estimate Sent", "Negotiation", "Contract Sent", "Closed Won", "Closed Lost"] },
      { key: "daysInStage", label: "Days in Stage", type: "number" },
      { key: "dealValue", label: "Deal Value", type: "number", prefix: "$" },
      { key: "lastInteraction", label: "Last Interaction Summary", type: "textarea" },
      { key: "knownObjections", label: "Known Objections", type: "textarea" },
    ],
    outputSections: ["Risk Level", "Win Probability", "Recommended Next Actions", "Talk Scripts", "Objection Handling Responses"],
  },
  {
    id: "crm-update",
    name: "CRM Update",
    description: "Extracts structured CRM fields from raw conversations, call notes, or emails including contact info, project details, action items, and sentiment.",
    icon: Brain,
    category: "crm",
    fields: [
      { key: "contactName", label: "Contact Name", type: "text" },
      { key: "sourceType", label: "Source Type", type: "select", options: ["Phone Call", "Email", "Text Message", "In-Person Meeting", "Voicemail"] },
      { key: "date", label: "Date", type: "date" },
      { key: "rawContent", label: "Raw Content", type: "textarea", placeholder: "Paste your call notes, email thread, or conversation transcript here..." },
    ],
    outputSections: ["Extracted Contact Updates", "Project Fields", "Action Items with Owners", "Recommended Pipeline Stage Change", "Sentiment Indicator"],
  },
  {
    id: "conversation-summary",
    name: "Conversation Summary",
    description: "Transforms long conversations into concise summaries with key points, action items, sentiment analysis, and a follow-up draft.",
    icon: MessageSquare,
    category: "crm",
    fields: [
      { key: "participants", label: "Participants", type: "text" },
      { key: "conversationType", label: "Conversation Type", type: "select", options: ["Discovery Call", "Site Visit Debrief", "Estimate Review", "Negotiation", "Check-In", "Complaint", "General"] },
      { key: "date", label: "Date", type: "date" },
      { key: "duration", label: "Duration (minutes)", type: "number" },
      { key: "transcript", label: "Transcript", type: "textarea", placeholder: "Paste the full conversation or transcript here..." },
    ],
    outputSections: ["TL;DR Summary", "Key Points", "Action Items with Owners & Deadlines", "Sentiment Analysis", "Draft Follow-Up Message"],
  },
  {
    id: "task-extractor",
    name: "Task Extractor",
    description: "Scans conversations and notes to extract and structure a complete task list with priorities, owners, and due dates.",
    icon: ListChecks,
    category: "crm",
    fields: [
      { key: "contentSource", label: "Content Source", type: "select", options: ["Meeting Notes", "Call Transcript", "Email Thread", "Project Notes", "Site Visit Notes"] },
      { key: "defaultAssignee", label: "Default Assignee", type: "text" },
      { key: "rawContent", label: "Raw Content", type: "textarea", placeholder: "Paste your notes, transcript, or email thread here..." },
    ],
    outputSections: ["Extracted Task List"],
  },
  {
    id: "ai-insights",
    name: "AI Insights",
    description: "Analyzes business performance data and surfaces highest-impact insights, opportunities, and recommendations.",
    icon: BarChart3,
    category: "operations",
    fields: [
      { key: "analysisPeriod", label: "Analysis Period", type: "select", options: ["This Week", "This Month", "This Quarter", "Last Quarter", "This Year"] },
      { key: "revenue", label: "Revenue", type: "number", prefix: "$" },
      { key: "totalLeads", label: "Total Leads", type: "number" },
      { key: "conversionRate", label: "Conversion Rate", type: "number", suffix: "%" },
      { key: "activePipelineValue", label: "Active Pipeline Value", type: "number", prefix: "$" },
      { key: "topJobTypes", label: "Top Job Types", type: "text" },
      { key: "teamSize", label: "Team Size", type: "number" },
    ],
    outputSections: ["Top 3 Business Insights", "KPI Health Dashboard", "Growth Opportunities", "Revenue Forecast", "Recommended Actions"],
  },
  {
    id: "revenue-intelligence",
    name: "Revenue Intelligence",
    description: "Forecasts monthly and quarterly revenue from pipeline data and surfaces specific actions to hit targets.",
    icon: DollarSign,
    category: "operations",
    beta: true,
    fields: [
      { key: "closedRevenue", label: "Closed Revenue This Period", type: "number", prefix: "$" },
      { key: "revenueTarget", label: "Revenue Target", type: "number", prefix: "$" },
      { key: "activePipelineTotal", label: "Active Pipeline Total", type: "number", prefix: "$" },
      { key: "averageDealSize", label: "Average Deal Size", type: "number", prefix: "$" },
      { key: "averageCloseRate", label: "Average Close Rate", type: "number", suffix: "%" },
      { key: "currentSeason", label: "Current Season", type: "select", options: ["Spring", "Summer", "Fall", "Winter"] },
    ],
    outputSections: ["Revenue Forecast with Confidence Range", "Pipeline Health Score", "Gap to Target", "Velocity Metrics", "Top 3 Recommended Actions"],
  },
];

type CategoryFilter = "all" | ToolCategory;



export function AIToolsTab() {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selectedTool, setSelectedTool] = useState<AITool | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [query, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<ToolCategory, AITool[]>();
    filtered.forEach((t) => {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-55 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="h-7 px-2.5 text-xs">All</TabsTrigger>
            <TabsTrigger value="sales" className="h-7 px-2.5 text-xs">Sales</TabsTrigger>
            <TabsTrigger value="crm" className="h-7 px-2.5 text-xs">CRM Intelligence</TabsTrigger>
            <TabsTrigger value="operations" className="h-7 px-2.5 text-xs">Operations & Insights</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-5">
        {(["sales", "crm", "operations"] as ToolCategory[]).map((cat) => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          return (
            <section key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABEL[cat]}
                </h2>
                <span className="text-[10px] text-muted-foreground">· {items.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} onOpen={() => setSelectedTool(tool)} />
                ))}
              </div>
            </section>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-xs text-muted-foreground">
            No tools match your filters.
          </Card>
        )}
      </div>

      <ToolDrawer tool={selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)} />
    </div>
  );
}

function ToolCard({ tool, onOpen }: { tool: AITool; onOpen: () => void }) {
  const Icon = tool.icon;
  return (
    <Card
      className={cn(
        "group cursor-pointer p-3.5 transition-all hover:shadow-md ring-1 ring-inset",
        CATEGORY_ACCENT[tool.category],
      )}
      onClick={onOpen}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold">{tool.name}</h3>
            {tool.beta && (
              <Badge variant="secondary" className="h-4 rounded bg-warning/15 px-1 text-[9px] font-medium uppercase text-warning border-warning/30">
                Beta
              </Badge>
            )}
          </div>
          <div className="mt-1">
            <Badge variant="secondary" className={cn("h-4 rounded border px-1.5 text-[9px]", CATEGORY_COLOR[tool.category])}>
              {CATEGORY_LABEL[tool.category]}
            </Badge>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {tool.description}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end border-t border-border pt-2.5">
        <Button size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          <Play className="h-3 w-3" />
          Run
        </Button>
      </div>
    </Card>
  );
}

function ToolDrawer({ tool, onOpenChange }: { tool: AITool | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!tool} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {tool && <ToolDrawerContent tool={tool} />}
      </SheetContent>
    </Sheet>
  );
}

function ToolDrawerContent({ tool }: { tool: AITool }) {
  const Icon = tool.icon;
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<Record<string, string> | null>(null);

  const setValue = (key: string, val: string) => setValues((prev) => ({ ...prev, [key]: val }));

  const handleRun = async () => {
    setRunning(true);
    setOutput(null);
    try {
      const res = await fetch("/.netlify/functions/ai-tool-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: tool.id, inputs: values }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI tool failed");
        return;
      }
      setOutput(data.sections);
    } catch (err: any) {
      console.error("AI tool error:", err);
      toast.error("Failed to run AI tool. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  const handleCopy = () => {
    if (!output) return;
    const text = Object.entries(output).map(([k, v]) => `## ${k}\n${v}`).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Output copied to clipboard");
  };

  const handleExport = () => {
    toast.info("PDF export coming soon");
  };

  return (
    <div className="space-y-4">
      <SheetHeader className="space-y-2 px-0 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-base">{tool.name}</SheetTitle>
              {tool.beta && (
                <Badge variant="secondary" className="h-4 rounded bg-warning/15 px-1 text-[9px] font-medium uppercase text-warning border-warning/30">
                  Beta
                </Badge>
              )}
            </div>
            <Badge variant="secondary" className={cn("mt-1 h-5 rounded border px-1.5 text-[10px]", CATEGORY_COLOR[tool.category])}>
              {CATEGORY_LABEL[tool.category]}
            </Badge>
          </div>
        </div>
        <SheetDescription className="text-xs leading-relaxed">
          {tool.description}
        </SheetDescription>
      </SheetHeader>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inputs</h3>
        {tool.fields.map((field) => (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            {field.type === "textarea" ? (
              <Textarea
                value={values[field.key] ?? ""}
                onChange={(e) => setValue(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="min-h-20 text-xs"
              />
            ) : field.type === "select" ? (
              <Select value={values[field.key] ?? ""} onValueChange={(v) => setValue(field.key, v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="relative">
                {field.prefix && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.prefix}</span>
                )}
                <Input
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className={cn("h-8 text-xs", field.prefix && "pl-6", field.suffix && "pr-8")}
                />
                {field.suffix && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.suffix}</span>
                )}
              </div>
            )}
          </div>
        ))}
        <Button size="sm" className="h-8 w-full" onClick={handleRun} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          <span className="text-xs">{running ? "Running…" : "Run"}</span>
        </Button>
      </div>

      {output && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Output</h3>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCopy}>
                  <Copy className="h-3 w-3" />
                  Copy Output
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleExport}>
                  <FileDown className="h-3 w-3" />
                  Export as PDF
                </Button>
              </div>
            </div>
            {Object.entries(output).map(([section, content]) => (
              <div key={section} className="rounded-md border border-border bg-secondary/30 p-3">
                <h4 className="mb-1.5 text-xs font-semibold">{section}</h4>
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">{content}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}