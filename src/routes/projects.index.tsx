// src/routes/projects.index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  LayoutGrid,
  List as ListIcon,
  Download,
  Loader2,
  MapPin,
  MoreHorizontal,
  ChevronsUpDown,
  Check,
  Mail,
  Phone,
  MessageSquare,
  X,
  TrendingUp,
  Clock,
  PauseCircle,
  DollarSign,
  Filter,
  ChevronRight,
  Calendar,
  User,
  Circle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  Trash2,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useProjects,
  updateProjectStatus,
  createProject,
  type Project,
  type ProjectStatus,
  type CreateProjectInput,
} from "@/lib/projects-store";
import { useContacts } from "@/lib/contacts-store";
import { useTasks, addTask, updateTask, deleteTask } from "@/lib/tasks-store";
import type { Task } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/projects/")({ component: ProjectsPage });

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = "active" | "on-hold" | "cancelled";
type View = "board" | "list";

type StageColumn = {
  id: string;
  statuses: ProjectStatus[];
  dbStatus: ProjectStatus;
  label: string;
  dotColor: string;
  description: string;
};

// ─── Stage columns (6 stages, Buildertrend-style) ───────────────────────────

const STAGE_COLUMNS: StageColumn[] = [
  {
    id: "estimating",
    statuses: ["planning"],
    dbStatus: "planning",
    label: "Estimating",
    dotColor: "bg-sky-500",
    description: "Proposal / bid in progress",
  },
  {
    id: "contracted",
    statuses: ["contracted"],
    dbStatus: "contracted",
    label: "Contracted",
    dotColor: "bg-violet-500",
    description: "Signed, deposit received",
  },
  {
    id: "pre-construction",
    statuses: ["pre-construction"],
    dbStatus: "pre-construction",
    label: "Pre-Construction",
    dotColor: "bg-amber-500",
    description: "Permits · materials · scheduling",
  },
  {
    id: "in-progress",
    statuses: ["active"],
    dbStatus: "active",
    label: "In Progress",
    dotColor: "bg-green-500",
    description: "Active on-site work",
  },
  {
    id: "punch-list",
    statuses: ["punch-list"],
    dbStatus: "punch-list",
    label: "Punch List",
    dotColor: "bg-orange-500",
    description: "Final items · walkthrough",
  },
  {
    id: "completed",
    statuses: ["completed"],
    dbStatus: "completed",
    label: "Completed",
    dotColor: "bg-gray-400",
    description: "Closed out",
  },
];

// Statuses shown in the Active Pipeline tab (everything except on-hold / cancelled)
const ACTIVE_STATUSES: ProjectStatus[] = [
  "planning",
  "contracted",
  "pre-construction",
  "active",
  "punch-list",
  "completed",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function formatMoneyFull(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getCityFromAddress(address: string | null): string {
  if (!address) return "";
  // Try to extract "City, ST" from "123 Main St, City, ST 12345"
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length >= 3) return `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(" ")[0]}`;
  if (parts.length === 2) return parts[1];
  return "";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColumnForStatus(status: ProjectStatus): StageColumn {
  return (
    STAGE_COLUMNS.find((col) => col.statuses.includes(status)) ??
    STAGE_COLUMNS[0]
  );
}

// Stage stepper order for the detail sheet
const STEPPER_STAGES = [
  { id: "estimating", label: "Estimating" },
  { id: "contracted", label: "Contracted" },
  { id: "pre-construction", label: "Pre-Construction" },
  { id: "in-progress", label: "In Progress" },
  { id: "punch-list", label: "Punch List" },
  { id: "completed", label: "Completed" },
] as const;

function getStepperIndex(status: ProjectStatus): number {
  return STAGE_COLUMNS.findIndex((col) => col.statuses.includes(status));
}

// ─── KPI Row ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  iconClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  iconClass?: string;
}) {
  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums leading-tight">{value}</p>
            {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconClass ?? "bg-primary/10 text-primary")}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Address Input with Nominatim autocomplete ───────────────────────────────

type NominatimResult = {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
  };
};

const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

function formatNominatimAddress(r: NominatimResult): string {
  const a = r.address;
  const num = a.house_number ?? "";
  const road = a.road ?? "";
  const city = a.city ?? a.town ?? a.village ?? "";
  const stateAbbr = a.state ? (STATE_ABBR[a.state] ?? a.state) : "";
  const zip = a.postcode ?? "";
  const street = [num, road].filter(Boolean).join(" ");
  return [street, city, [stateAbbr, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
}

function AddressInput({
  value,
  onChange,
  id,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 4) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&addressdetails=1&countrycodes=us&limit=5`,
        { headers: { "Accept-Language": "en" } },
      );
      if (!res.ok) throw new Error("Network error");
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (r: NominatimResult) => {
    onChange(formatNominatimAddress(r));
    setSuggestions([]);
    setOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          value={value}
          onChange={handleChange}
          placeholder={placeholder ?? "123 Main St, City, ST"}
          className="pl-8"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
          <ul className="py-1 text-sm">
            {suggestions.map((r) => (
              <li
                key={r.place_id}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(r);
                }}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{formatNominatimAddress(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Project Detail Sheet ────────────────────────────────────────────────────

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
};

type Note = { id: string; body: string; created_at: string; author: string };

const PRIORITY_COLORS: Record<Task["priority"], string> = {
  high: "text-red-500",
  med: "text-amber-500",
  low: "text-slate-400",
};

const STATUS_ICONS: Record<Task["status"], React.ReactNode> = {
  todo: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  review: <AlertCircle className="h-4 w-4 text-amber-500" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

function ProjectDetailSheet({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onReload: () => void;
}) {
  const contacts = useContacts();
  const allTasks = useTasks();
  const [activeTab, setActiveTab] = useState<"overview" | "financials" | "schedule" | "communications">("overview");

  // Schedule & Tasks state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Financials state
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Communications state
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Activity feed (overview tab) — recent notes for this project
  const [activityNotes, setActivityNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (open) setActiveTab("overview");
  }, [open, project?.id]);

  // Eagerly load recent notes for the activity feed whenever the project changes
  useEffect(() => {
    if (!open || !project) return;
    supabase
      .from("project_notes")
      .select("id, body, created_at, author")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setActivityNotes((data ?? []) as Note[]));
  }, [open, project?.id]);

  // Load invoices when financials tab is opened
  useEffect(() => {
    if (activeTab !== "financials" || !project) return;
    setInvoicesLoading(true);
    supabase
      .from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, total_amount, amount_paid")
      .eq("project_id", project.id)
      .order("issue_date", { ascending: false })
      .then(({ data }) => {
        setInvoices((data ?? []) as Invoice[]);
        setInvoicesLoading(false);
      });
  }, [activeTab, project?.id]);

  // Load notes when communications tab is opened
  useEffect(() => {
    if (activeTab !== "communications" || !project) return;
    supabase
      .from("project_notes")
      .select("id, body, created_at, author")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setNotes((data ?? []) as Note[]));
  }, [activeTab, project?.id]);

  if (!project) return null;

  const projectTasks = allTasks.filter((t) => t.projectId === project.id);

  const contact = contacts.find(
    (c) => c.id === (project as any).client_id || c.name === project.client_name,
  );

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    await addTask({
      projectId: project.id,
      title: newTaskTitle.trim(),
      assignee: "Unassigned",
      assigneeInitials: "—",
      due: new Date().toISOString(),
      status: "todo",
      priority: "med",
      recurrence: "none",
    });
    setNewTaskTitle("");
    setAddingTask(false);
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim() || !project) return;
    setSavingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    const author = user?.user_metadata?.first_name || user?.email?.split("@")[0] || "You";
    const { data } = await supabase
      .from("project_notes")
      .insert({ project_id: project.id, body: noteInput.trim(), author })
      .select("id, body, created_at, author")
      .single();
    if (data) {
      const n = data as Note;
      setNotes((prev) => [n, ...prev]);
      setActivityNotes((prev) => [n, ...prev]);
    }
    setNoteInput("");
    setSavingNote(false);
  };

  const col = getColumnForStatus(project.status);
  const stepperIdx = getStepperIndex(project.status);
  const cityLine = getCityFromAddress(project.address);
  const remaining = project.budget_total - project.actual_cost;
  const budgetPct = project.budget_total > 0
    ? Math.min(100, Math.round((project.actual_cost / project.budget_total) * 100))
    : 0;
  const projId = `#PRJ-${project.id.slice(0, 6).toUpperCase()}`;

  const SHEET_TABS = [
    { id: "overview", label: "Overview" },
    { id: "financials", label: "Financials" },
    { id: "schedule", label: "Schedule & Tasks" },
    { id: "communications", label: "Communications" },
  ] as const;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-170 overflow-y-auto p-0 flex flex-col"
      >
        {/* ── Sheet Header ── */}
        <div className="border-b border-border px-6 py-4 shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <span>Projects</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">{project.name}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold leading-tight">{project.name}</h2>
                <Badge
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    col.dotColor === "bg-green-500" && "bg-green-100 text-green-700 border-green-200",
                    col.dotColor === "bg-sky-500" && "bg-sky-100 text-sky-700 border-sky-200",
                    col.dotColor === "bg-violet-500" && "bg-violet-100 text-violet-700 border-violet-200",
                    col.dotColor === "bg-amber-500" && "bg-amber-100 text-amber-700 border-amber-200",
                    col.dotColor === "bg-orange-500" && "bg-orange-100 text-orange-700 border-orange-200",
                    col.dotColor === "bg-gray-400" && "bg-gray-100 text-gray-600 border-gray-200",
                  )}
                  variant="outline"
                >
                  <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full", col.dotColor)} />
                  {col.label}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {project.client_name}
                {cityLine && ` · ${cityLine}`}
                {` · ${projId}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {contact?.email && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => window.open(`mailto:${contact.email}`)}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Message
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── 4 KPI stat cards ── */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4 shrink-0 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground font-medium">Budget</p>
            <p className="mt-1 text-base font-bold tabular-nums">{formatMoney(project.budget_total)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatMoney(project.actual_cost)} spent
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground font-medium">Timeline</p>
            <p className="mt-1 text-base font-bold leading-tight">
              {project.start_date ? new Date(project.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {project.end_date
                ? `→ ${new Date(project.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : "No end date"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground font-medium">Completion</p>
            <p className="mt-1 text-base font-bold">{project.completion_percentage}%</p>
            <Progress value={project.completion_percentage} className="mt-1.5 h-1.5" />
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-[11px] text-muted-foreground font-medium">Stage</p>
            <p className="mt-1 text-base font-bold leading-tight">{col.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{col.description}</p>
          </div>
        </div>

        {/* ── Stage stepper ── */}
        <div className="px-6 pb-4 shrink-0">
          <div className="relative flex items-center justify-between">
            {/* Connecting line */}
            <div className="absolute inset-x-0 top-3.5 h-0.5 bg-border" />
            {STEPPER_STAGES.map((stage, idx) => {
              const isDone = idx < stepperIdx;
              const isCurrent = idx === stepperIdx;
              return (
                <div key={stage.id} className="relative flex flex-col items-center gap-1.5 z-10">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : isCurrent
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium whitespace-nowrap",
                      isCurrent ? "text-primary" : isDone ? "text-muted-foreground" : "text-muted-foreground",
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-border px-6 shrink-0">
          {SHEET_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "pb-2.5 pt-1 mr-5 text-sm font-medium border-b-2 transition-colors",
                activeTab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "overview" && (
            <div className="grid grid-cols-3 gap-4">
              {/* Left 2/3 */}
              <div className="col-span-3 sm:col-span-2 space-y-4">
                {/* Scope & Details */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold">Scope & Details</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <dt className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Address</dt>
                        <dd className="mt-0.5 font-medium">{project.address || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Status</dt>
                        <dd className="mt-0.5 font-medium capitalize">{col.label}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Budget</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">{formatMoneyFull(project.budget_total)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Actual Cost</dt>
                        <dd className="mt-0.5 font-medium tabular-nums">{formatMoneyFull(project.actual_cost)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Start Date</dt>
                        <dd className="mt-0.5 font-medium">{formatDate(project.start_date)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">End Date</dt>
                        <dd className="mt-0.5 font-medium">{formatDate(project.end_date)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {(() => {
                      // Build a combined timeline from tasks + notes
                      type ActivityEntry = { id: string; icon: React.ReactNode; tone: string; title: string; sub?: string; at: Date };
                      const entries: ActivityEntry[] = [];

                      for (const t of projectTasks) {
                        entries.push({
                          id: `task-${t.id}`,
                          icon: t.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />,
                          tone: t.status === "done" ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600",
                          title: t.status === "done" ? `Completed: ${t.title}` : `Task: ${t.title}`,
                          sub: t.priority !== "med" ? `${t.priority} priority` : undefined,
                          at: new Date(t.due),
                        });
                      }

                      for (const n of activityNotes) {
                        entries.push({
                          id: `note-${n.id}`,
                          icon: <MessageSquare className="h-3.5 w-3.5" />,
                          tone: "bg-violet-500/10 text-violet-600",
                          title: `Note by ${n.author}`,
                          sub: n.body.length > 60 ? `${n.body.slice(0, 60)}…` : n.body,
                          at: new Date(n.created_at),
                        });
                      }

                      entries.sort((a, b) => b.at.getTime() - a.at.getTime());
                      const recent = entries.slice(0, 6);

                      if (recent.length === 0) {
                        return (
                          <div className="rounded-md border border-dashed border-border py-8 text-center">
                            <p className="text-sm text-muted-foreground">No activity yet — add tasks or notes to see them here</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-0">
                          {recent.map((entry, i) => {
                            const isLast = i === recent.length - 1;
                            return (
                              <div key={entry.id} className="relative flex gap-3 pb-3">
                                {!isLast && <div className="absolute left-[15px] top-7 h-full w-px bg-border" />}
                                <div className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background", entry.tone)}>
                                  {entry.icon}
                                </div>
                                <div className="min-w-0 flex-1 pt-1">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <p className="truncate text-sm font-medium">{entry.title}</p>
                                    <p className="shrink-0 text-[11px] text-muted-foreground">
                                      {entry.at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </p>
                                  </div>
                                  {entry.sub && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{entry.sub}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Right 1/3 */}
              <div className="col-span-3 sm:col-span-1 space-y-4">
                {/* Primary Contact */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold">Primary Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {contact ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {getInitials(contact.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{contact.name}</p>
                            {contact.company && (
                              <p className="text-[11px] text-muted-foreground truncate">{contact.company}</p>
                            )}
                          </div>
                        </div>
                        {contact.email && (
                          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 w-full"
                            disabled={!contact.email}
                            onClick={() => contact.email && window.open(`mailto:${contact.email}`)}
                          >
                            <Mail className="h-3 w-3" /> Email
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 w-full"
                            disabled={!contact.phone}
                            onClick={() => contact.phone && window.open(`sms:${contact.phone}`)}
                          >
                            <MessageSquare className="h-3 w-3" /> SMS
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 w-full"
                            disabled={!contact.phone}
                            onClick={() => contact.phone && window.open(`tel:${contact.phone}`)}
                          >
                            <Phone className="h-3 w-3" /> Call
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <User className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm font-medium">{project.client_name || "No client"}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Contact not found in directory</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Budget Snapshot */}
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold">Budget Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Budget</span>
                      <span className="font-semibold tabular-nums">{formatMoneyFull(project.budget_total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="font-semibold tabular-nums text-amber-600">{formatMoneyFull(project.actual_cost)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className={cn("font-semibold tabular-nums", remaining < 0 ? "text-destructive" : "text-green-600")}>
                        {formatMoneyFull(remaining)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Used</span>
                        <span className={cn("font-medium", budgetPct > 90 ? "text-destructive" : "text-foreground")}>{budgetPct}%</span>
                      </div>
                      <Progress
                        value={budgetPct}
                        className={cn("h-2", budgetPct > 90 ? "[&>div]:bg-destructive" : budgetPct > 70 ? "[&>div]:bg-amber-500" : "")}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ── Schedule & Tasks ── */}
          {activeTab === "schedule" && (
            <div className="space-y-4">
              {/* Add task row */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a task…"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddTask(); }}
                  className="h-8 text-sm"
                />
                <Button size="sm" className="h-8 shrink-0" disabled={addingTask || !newTaskTitle.trim()} onClick={() => void handleAddTask()}>
                  {addingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {projectTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-10 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No tasks yet — add one above</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {projectTasks.map((task) => (
                    <div key={task.id} className="group flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 hover:bg-secondary/30">
                      <button
                        onClick={() => void updateTask(task.id, { status: task.status === "done" ? "todo" : "done" })}
                        className="shrink-0"
                      >
                        {STATUS_ICONS[task.status]}
                      </button>
                      <span className={cn("flex-1 text-sm", task.status === "done" && "line-through text-muted-foreground")}>
                        {task.title}
                      </span>
                      <Flag className={cn("h-3.5 w-3.5 shrink-0", PRIORITY_COLORS[task.priority])} />
                      {task.due && (
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {new Date(task.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <button
                        onClick={() => void deleteTask(task.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary row */}
              {projectTasks.length > 0 && (
                <div className="flex items-center gap-4 rounded-lg bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>{projectTasks.filter((t) => t.status === "done").length} / {projectTasks.length} done</span>
                  <span>{projectTasks.filter((t) => t.status === "in_progress").length} in progress</span>
                  <span>{projectTasks.filter((t) => t.priority === "high" && t.status !== "done").length} high priority</span>
                </div>
              )}
            </div>
          )}

          {/* ── Financials ── */}
          {activeTab === "financials" && (
            <div className="space-y-4">
              {/* Budget summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground font-medium">Contract Value</p>
                  <p className="mt-1 text-base font-bold tabular-nums">{formatMoneyFull(project.budget_total)}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground font-medium">Invoiced</p>
                  <p className="mt-1 text-base font-bold tabular-nums">
                    {formatMoneyFull(invoices.reduce((s, i) => s + (i.total_amount ?? 0), 0))}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground font-medium">Collected</p>
                  <p className="mt-1 text-base font-bold tabular-nums text-green-600">
                    {formatMoneyFull(invoices.reduce((s, i) => s + (i.amount_paid ?? 0), 0))}
                  </p>
                </div>
              </div>

              {/* Invoices list */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoices</p>
                </div>
                {invoicesLoading ? (
                  <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : invoices.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No invoices yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((inv) => {
                      const isPaid = inv.status === "paid";
                      const isOverdue = !isPaid && inv.due_date && new Date(inv.due_date) < new Date();
                      return (
                        <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{inv.invoice_number || `INV-${inv.id.slice(0,6).toUpperCase()}`}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "No due date"}
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums shrink-0">{formatMoneyFull(inv.total_amount)}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-[10px] px-1.5",
                              isPaid && "border-green-200 bg-green-50 text-green-700",
                              isOverdue && "border-red-200 bg-red-50 text-red-700",
                              !isPaid && !isOverdue && "border-amber-200 bg-amber-50 text-amber-700",
                            )}
                          >
                            {isPaid ? "Paid" : isOverdue ? "Overdue" : inv.status}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cost breakdown */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Cost Breakdown</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Budget</span>
                  <span className="font-medium tabular-nums">{formatMoneyFull(project.budget_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Actual cost</span>
                  <span className="font-medium tabular-nums text-amber-600">{formatMoneyFull(project.actual_cost)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Variance</span>
                  <span className={cn("font-semibold tabular-nums", project.budget_total - project.actual_cost >= 0 ? "text-green-600" : "text-destructive")}>
                    {formatMoneyFull(project.budget_total - project.actual_cost)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Communications ── */}
          {activeTab === "communications" && (
            <div className="space-y-4">
              {/* Contact quick-actions */}
              {contact && (
                <div className="flex gap-2 flex-wrap">
                  {contact.email && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => window.open(`mailto:${contact.email}`)}>
                      <Mail className="h-3.5 w-3.5" /> Email {contact.name.split(" ")[0]}
                    </Button>
                  )}
                  {contact.phone && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => window.open(`sms:${contact.phone}`)}>
                      <MessageSquare className="h-3.5 w-3.5" /> SMS
                    </Button>
                  )}
                  {contact.phone && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => window.open(`tel:${contact.phone}`)}>
                      <Phone className="h-3.5 w-3.5" /> Call
                    </Button>
                  )}
                </div>
              )}

              {/* Note composer */}
              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Add a note</p>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Write a note about this project…"
                  rows={3}
                  className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
                />
                <div className="flex justify-end">
                  <Button size="sm" className="h-7 text-xs gap-1.5" disabled={!noteInput.trim() || savingNote} onClick={() => void handleSaveNote()}>
                    {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Save note
                  </Button>
                </div>
              </div>

              {/* Notes feed */}
              {notes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-8 text-center">
                  <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold">{note.author}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Project Card (board) ────────────────────────────────────────────────────

function ProjectCard({
  project: p,
  onClick,
  onDelete,
}: {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}) {
  const col = getColumnForStatus(p.status);
  const age = daysSince((p as any).created_at);
  const cityLine = getCityFromAddress(p.address);
  const typeTag = p.name.split(" ")[0] ?? "General";

  return (
    <Card
      className="cursor-pointer p-0 overflow-hidden transition-shadow hover:shadow-md active:shadow-sm select-none"
      onClick={onClick}
    >
      {/* Top section: name + age badge */}
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{p.name}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {p.client_name}
            {cityLine && <span> · {cityLine}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {age > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {age}d
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mt-0.5 h-6 w-6 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onClick}>View details</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => onDelete()}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Progress bar row */}
      <div className="mt-2.5 px-3">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-medium text-foreground">{p.completion_percentage}%</span>
          {p.end_date && (
            <span className="text-muted-foreground">
              Due {new Date(p.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        <Progress value={p.completion_percentage} className="h-1.5" />
      </div>

      {/* Footer row */}
      <div className="mt-2.5 flex items-center justify-between border-t border-border px-3 py-2.5">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatMoney(p.budget_total)}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px] font-medium">
            {typeTag}
          </Badge>
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
            col.dotColor,
          )}>
            {getInitials(p.client_name)}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Board View ──────────────────────────────────────────────────────────────

function BoardView({
  projects,
  onCardClick,
  onDragEnd,
  onDelete,
}: {
  projects: Project[];
  onCardClick: (p: Project) => void;
  onDragEnd: (result: DropResult) => void;
  onDelete: (id: string, name: string) => void;
}) {
  // Group by stage column
  const grouped = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const col of STAGE_COLUMNS) map[col.id] = [];
    for (const p of projects) {
      const col = getColumnForStatus(p.status);
      map[col.id].push(p);
    }
    return map;
  }, [projects]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full gap-3 pb-4">
        {STAGE_COLUMNS.map((col) => {
          const items = grouped[col.id] ?? [];
          const colValue = items.reduce((sum, p) => sum + p.budget_total, 0);
          return (
            <Droppable droppableId={col.id} key={col.id}>
              {(provided, snap) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "flex w-70 shrink-0 flex-col rounded-xl border border-border bg-secondary/40 transition-colors",
                    snap.isDraggingOver && "border-primary/40 bg-primary/5",
                  )}
                >
                  {/* Column header */}
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", col.dotColor)} />
                    <span className="text-[13px] font-semibold flex-1 truncate">{col.label}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {items.length}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums ml-1">
                      {formatMoney(colValue)}
                    </span>
                  </div>
                  <p className="px-3 pb-1 pt-1 text-[10px] text-muted-foreground">{col.description}</p>

                  {/* Cards */}
                  <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                    {items.map((p, i) => (
                      <Draggable draggableId={p.id} index={i} key={p.id}>
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            className={cn(
                              "cursor-grab active:cursor-grabbing rounded-xl outline-none",
                              snapshot.isDragging && "opacity-80 rotate-1 shadow-xl scale-[1.02]",
                            )}
                          >
                            <ProjectCard
                              project={p}
                              onClick={() => onCardClick(p)}
                              onDelete={() => onDelete(p.id, p.name)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {items.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                        Drop here
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

// ─── List View ───────────────────────────────────────────────────────────────

function ListView({
  projects,
  onRowClick,
  onDelete,
}: {
  projects: Project[];
  onRowClick: (p: Project) => void;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2.5 pl-4 pr-3 text-left">Project</th>
            <th className="py-2.5 pr-4 text-left">Client</th>
            <th className="py-2.5 pr-4 text-left">Status</th>
            <th className="py-2.5 pr-4 text-left">Budget</th>
            <th className="py-2.5 pr-4 text-left">Progress</th>
            <th className="py-2.5 pr-4 text-left">Dates</th>
            <th className="w-10 py-2.5 pr-3" />
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 && (
            <tr>
              <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                No projects found
              </td>
            </tr>
          )}
          {projects.map((p) => {
            const col = getColumnForStatus(p.status);
            return (
              <tr
                key={p.id}
                className="border-b border-border hover:bg-secondary/30 cursor-pointer"
                onClick={() => onRowClick(p)}
              >
                <td className="py-3 pl-4 pr-3">
                  <div className="font-medium">{p.name}</div>
                  {p.address && (
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {p.address}
                    </div>
                  )}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{p.client_name || "—"}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", col.dotColor)} />
                    <span className="text-[12px] font-medium">{col.label}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 tabular-nums">
                  <div className="text-sm font-semibold">{formatMoney(p.budget_total)}</div>
                  {p.actual_cost > 0 && (
                    <div className="text-[11px] text-muted-foreground">{formatMoney(p.actual_cost)} spent</div>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <Progress value={p.completion_percentage} className="h-1.5 w-24" />
                    <span className="text-[11px] text-muted-foreground">{p.completion_percentage}%</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-[11px] text-muted-foreground">
                  {p.start_date && <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {p.start_date}</div>}
                  {p.end_date && <div className="mt-0.5 text-muted-foreground/70">→ {p.end_date}</div>}
                </td>
                <td className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onRowClick(p)}>View details</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => onDelete(p.id, p.name)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ─── New Project Dialog ───────────────────────────────────────────────────────

type NewProjectForm = {
  name: string;
  client_id: string;
  status: ProjectStatus;
  address: string;
  budget_total: string;
  start_date: string;
  end_date: string;
};

const EMPTY_FORM: NewProjectForm = {
  name: "",
  client_id: "",
  status: "planning",
  address: "",
  budget_total: "",
  start_date: "",
  end_date: "",
};

function NewProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const contacts = useContacts();
  const [form, setForm] = useState<NewProjectForm>(EMPTY_FORM);
  const [contactOpen, setContactOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const set =
    (field: keyof NewProjectForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const selectedContact = contacts.find((c) => c.id === form.client_id);

  const handleClose = () => {
    setForm(EMPTY_FORM);
    setContactOpen(false);
    onClose();
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Project name is required"); return; }
    if (!form.client_id) { toast.error("Please select a client"); return; }
    setSaving(true);
    const input: CreateProjectInput = {
      name: form.name.trim(),
      client_id: form.client_id,
      status: form.status,
      address: form.address.trim() || undefined,
      budget_total: form.budget_total ? Number(form.budget_total) : undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
    };
    const { error } = await createProject(input);
    setSaving(false);
    if (error) { toast.error("Failed to create project"); return; }
    toast.success(`${form.name} created`);
    onCreated();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">
              Project name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="proj-name"
              value={form.name}
              onChange={set("name")}
              placeholder="Kitchen remodel"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Client <span className="text-destructive">*</span>
            </Label>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-between font-normal",
                    !selectedContact && "text-muted-foreground",
                  )}
                >
                  {selectedContact ? selectedContact.name : "Search contacts…"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name…" />
                  <CommandList>
                    <CommandEmpty>No contacts found.</CommandEmpty>
                    <CommandGroup>
                      {contacts.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            setForm((f) => ({ ...f, client_id: c.id }));
                            setContactOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              form.client_id === c.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div>
                            <div className="text-sm font-medium">{c.name}</div>
                            {c.email && (
                              <div className="text-xs text-muted-foreground">{c.email}</div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as ProjectStatus }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Estimating</SelectItem>
                <SelectItem value="active">In Progress</SelectItem>
                <SelectItem value="on-hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-address">Address</Label>
            <AddressInput
              id="proj-address"
              value={form.address}
              onChange={(v) => setForm((f) => ({ ...f, address: v }))}
              placeholder="123 Main St, City, ST"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-budget">Budget ($)</Label>
            <Input
              id="proj-budget"
              type="number"
              min="0"
              step="0.01"
              value={form.budget_total}
              onChange={set("budget_total")}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="proj-start">Start date</Label>
              <Input
                id="proj-start"
                type="date"
                value={form.start_date}
                onChange={set("start_date")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-end">End date</Label>
              <Input
                id="proj-end"
                type="date"
                value={form.end_date}
                onChange={set("end_date")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function ProjectsPage() {
  const { projects, loading, reload } = useProjects();
  const [tab, setTab] = useState<Tab>("active");
  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Optimistic status overrides while the DB write is in-flight
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, ProjectStatus>>({});

  const openDetail = useCallback((p: Project) => {
    setSelectedProject(p);
    setSheetOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setSheetOpen(false);
    // Keep selectedProject for exit animation
  }, []);

  // ── Tab counts ──
  const counts = useMemo(() => {
    const active = projects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length;
    const onHold = projects.filter((p) => p.status === "on-hold").length;
    const cancelled = projects.filter((p) => p.status === "cancelled").length;
    return { active, "on-hold": onHold, cancelled };
  }, [projects]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const active = projects.filter((p) => ACTIVE_STATUSES.includes(p.status));
    const pipelineValue = active.reduce((s, p) => s + p.budget_total, 0);
    const avgValue = active.length > 0 ? pipelineValue / active.length : 0;
    const onHold = projects.filter((p) => p.status === "on-hold").length;
    // Avg cycle time: for completed projects with both start and end dates
    const completed = projects.filter(
      (p) => p.status === "completed" && p.start_date && p.end_date,
    );
    const avgCycle =
      completed.length > 0
        ? completed.reduce((s, p) => {
            const days = Math.round(
              (new Date(p.end_date!).getTime() - new Date(p.start_date!).getTime()) /
                (1000 * 60 * 60 * 24),
            );
            return s + days;
          }, 0) / completed.length
        : 0;
    return { pipelineValue, avgValue, avgCycle: Math.round(avgCycle), onHold };
  }, [projects]);

  // Apply optimistic status overrides so the board reflects moves instantly
  const projectsWithOptimistic = useMemo(
    () =>
      projects.map((p) =>
        optimisticStatuses[p.id] ? { ...p, status: optimisticStatuses[p.id] } : p,
      ),
    [projects, optimisticStatuses],
  );

  // ── Filtered projects for the current tab ──
  const tabProjects = useMemo(() => {
    const q = search.toLowerCase();
    return projectsWithOptimistic.filter((p) => {
      const matchTab =
        tab === "active"
          ? ACTIVE_STATUSES.includes(p.status)
          : tab === "on-hold"
          ? p.status === "on-hold"
          : p.status === "cancelled";
      if (!matchTab) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        (p.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [projectsWithOptimistic, tab, search]);

  const pipelineSubtitle = `${counts.active} active · ${formatMoney(kpis.pipelineValue)} pipeline`;

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const destCol = STAGE_COLUMNS.find((c) => c.id === destination.droppableId);
    if (!destCol) return;
    const newStatus = destCol.dbStatus;

    // Optimistic update — move the card instantly in the UI
    setOptimisticStatuses((prev) => ({ ...prev, [draggableId]: newStatus }));

    const { error } = await updateProjectStatus(draggableId, newStatus);

    if (error) {
      // Revert optimistic update on failure
      setOptimisticStatuses((prev) => {
        const next = { ...prev };
        delete next[draggableId];
        return next;
      });
      toast.error("Failed to update stage");
      return;
    }

    toast.success(`Moved to ${destCol.label}`);
    // Clear optimistic entry once the store reloads with fresh data
    reload();
    setOptimisticStatuses((prev) => {
      const next = { ...prev };
      delete next[draggableId];
      return next;
    });
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) { toast.error("Failed to delete project"); return; }
    toast.success(`${name} deleted`);
    if (selectedProject?.id === id) setSheetOpen(false);
    reload();
  };

  const TAB_DEFS: { id: Tab; label: string; count: number }[] = [
    { id: "active", label: "Active Pipeline", count: counts.active },
    { id: "on-hold", label: "On Hold", count: counts["on-hold"] },
    { id: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-7 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="flex gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-72 w-70 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
      {/* ── Page Header ── */}
      <PageHeader
        title="Projects"
        subtitle={pipelineSubtitle}
        breadcrumb={["Workspace", "Projects"]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8" onClick={() => setNewProjectOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Project
            </Button>
          </>
        }
      />

      {/* ── KPI Row ── */}
      <div className="mb-4 flex gap-4 shrink-0">
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Active Pipeline Value"
          value={formatMoney(kpis.pipelineValue)}
          sub={`${counts.active} active projects`}
          iconClass="bg-blue-100 text-blue-600"
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Avg Project Value"
          value={formatMoney(kpis.avgValue)}
          sub="per active project"
          iconClass="bg-green-100 text-green-600"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label="Avg Cycle Time"
          value={kpis.avgCycle > 0 ? `${kpis.avgCycle}d` : "—"}
          sub="from start to close"
          iconClass="bg-violet-100 text-violet-600"
        />
        <KpiCard
          icon={<PauseCircle className="h-5 w-5" />}
          label="On Hold"
          value={String(kpis.onHold)}
          sub="projects paused"
          iconClass="bg-amber-100 text-amber-600"
        />
      </div>

      {/* ── Tabs + controls ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        {/* Tab bar */}
        <div className="flex gap-1">
          {TAB_DEFS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              {t.label}{" "}
              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-52 pl-8 text-xs"
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Owner: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Owner: All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5" /> Filters
          </Button>
          {/* View toggle */}
          <div className="flex items-center rounded-md border border-border p-0.5">
            <Button
              variant={view === "board" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setView("board")}
              title="Board view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setView("list")}
              title="List view"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-auto pt-4">
        {view === "board" ? (
          <BoardView
            projects={tabProjects}
            onCardClick={openDetail}
            onDragEnd={onDragEnd}
            onDelete={handleDelete}
          />
        ) : (
          <ListView
            projects={tabProjects}
            onRowClick={openDetail}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* ── Dialogs / Sheets ── */}
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={reload}
      />

      <ProjectDetailSheet
        project={selectedProject}
        open={sheetOpen}
        onClose={closeDetail}
        onReload={reload}
      />
    </div>
  );
}
