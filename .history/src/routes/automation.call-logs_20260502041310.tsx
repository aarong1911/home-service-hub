import { useState, useEffect, useCallback, Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Download,
  ChevronDown,
  ChevronUp,
  Phone,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/automation/call-logs")({
  head: () => ({
    meta: [
      { title: "Call Logs — RenoMeta" },
      { name: "description", content: "Voice agent call history and transcripts." },
    ],
  }),
  component: CallLogsPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CallStatus = "completed" | "in_progress" | "no_answer" | "busy" | "failed" | "ringing";
type CallDirection = "inbound" | "outbound";

type CallLog = {
  id: string;
  vapi_call_id: string;
  started_at: string;
  ended_at: string | null;
  caller_number: string | null;
  caller_name: string | null;
  agent_name: string;
  direction: CallDirection;
  duration_sec: number | null;
  status: CallStatus;
  cost_usd: number | null;
  outcome: string | null;
  summary: string | null;
  transcript: any;
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  no_answer: "Missed",
  busy: "Busy",
  failed: "Failed",
  ringing: "Ringing",
};

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-success/15 text-success border-success/30",
  in_progress: "bg-primary/15 text-primary border-primary/30",
  no_answer: "bg-warning/15 text-warning border-warning/30",
  busy: "bg-warning/15 text-warning border-warning/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  ringing: "bg-muted text-muted-foreground border-border",
};

const OUTCOME_LABELS: Record<string, string> = {
  appointment_booked: "Appointment Booked",
  lead_captured: "Lead Saved",
  callback_requested: "Callback",
  not_interested: "Not Interested",
  voicemail: "Voicemail",
  wrong_number: "Wrong Number",
  unknown: "—",
};

const OUTCOME_STYLE: Record<string, string> = {
  appointment_booked: "bg-success/15 text-success border-success/30",
  lead_captured: "bg-primary/15 text-primary border-primary/30",
  callback_requested: "bg-warning/15 text-warning border-warning/30",
  not_interested: "bg-muted text-muted-foreground border-border",
  voicemail: "bg-muted text-muted-foreground border-border",
  wrong_number: "bg-destructive/15 text-destructive border-destructive/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
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

function formatDuration(sec: number | null): string {
  if (sec == null || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCost(usd: number | null): string {
  if (usd == null) return "—";
  return `$${usd.toFixed(2)}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatTranscript(transcript: any): string {
  if (!transcript) return "No transcript available.";
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) {
    return transcript
      .filter((m: any) => m.role && m.message)
      .map((m: any) => {
        const role = m.role === "assistant" ? "Agent" : m.role === "user" ? "Caller" : m.role;
        return `${role}: ${m.message}`;
      })
      .join("\n\n");
  }
  return JSON.stringify(transcript, null, 2);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CallLogsPage() {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const orgId = await getOrgId();
      if (!orgId) return;

      // Fetch call logs with agent name
      const { data, error } = await supabase
        .from("voice_calls")
        .select(`
          id,
          vapi_call_id,
          started_at,
          ended_at,
          caller_number,
          direction,
          duration_sec,
          status,
          cost_usd,
          outcome,
          summary,
          transcript,
          contact_id,
          voice_agents ( name )
        `)
        .eq("tenant_id", orgId)
        .order("started_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Failed to load call logs:", error);
        return;
      }

      if (!data) {
        setLogs([]);
        return;
      }

      // Collect contact IDs to batch-fetch names
      const contactIds = data
        .map((r: any) => r.contact_id)
        .filter(Boolean) as string[];

      let contactMap: Record<string, string> = {};
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, full_name")
          .in("id", contactIds);

        if (contacts) {
          contactMap = Object.fromEntries(
            contacts.map((c: any) => [c.id, c.full_name])
          );
        }
      }

      const mapped: CallLog[] = data.map((r: any) => ({
        id: r.id,
        vapi_call_id: r.vapi_call_id,
        started_at: r.started_at,
        ended_at: r.ended_at,
        caller_number: r.caller_number,
        caller_name: r.contact_id ? contactMap[r.contact_id] ?? null : null,
        agent_name: r.voice_agents?.name ?? "Unknown Agent",
        direction: r.direction ?? "inbound",
        duration_sec: r.duration_sec,
        status: r.status ?? "completed",
        cost_usd: r.cost_usd,
        outcome: r.outcome,
        summary: r.summary,
        transcript: r.transcript,
      }));

      setLogs(mapped);
    } catch (err) {
      console.error("Failed to load call logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = logs.filter((log) => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (directionFilter !== "all" && log.direction !== directionFilter) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = [
      "Date/Time",
      "Caller",
      "Caller Name",
      "Agent",
      "Direction",
      "Duration",
      "Status",
      "Cost",
      "Outcome",
      "Summary",
    ];
    const rows = logs.map((l) => [
      l.started_at,
      l.caller_number ?? "",
      l.caller_name ?? "",
      l.agent_name,
      l.direction,
      formatDuration(l.duration_sec),
      l.status,
      formatCost(l.cost_usd),
      l.outcome ?? "",
      `"${(l.summary ?? "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      <div className="flex items-center gap-3">
        <Link
  to={ROUTES.AI_CENTER}
  search={{ tab: "voice" }}
>
  <Button variant="ghost" size="sm" className="h-8">
    <ArrowLeft className="h-3.5 w-3.5" />
    <span className="text-xs">Back to Voice Agents</span>
  </Button>
</Link>
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Call Logs</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Status</SelectItem>
            <SelectItem value="completed" className="text-xs">Completed</SelectItem>
            <SelectItem value="no_answer" className="text-xs">Missed</SelectItem>
            <SelectItem value="failed" className="text-xs">Failed</SelectItem>
            <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Directions</SelectItem>
            <SelectItem value="inbound" className="text-xs">Inbound</SelectItem>
            <SelectItem value="outbound" className="text-xs">Outbound</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-8" onClick={handleExportCSV}>
          <Download className="h-3.5 w-3.5" />
          <span className="text-xs">Export CSV</span>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Date/Time</TableHead>
              <TableHead className="text-xs">Caller</TableHead>
              <TableHead className="text-xs">Agent</TableHead>
              <TableHead className="text-xs">Direction</TableHead>
              <TableHead className="text-xs">Duration</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Cost</TableHead>
              <TableHead className="text-xs">Outcome</TableHead>
              <TableHead className="w-8 text-xs"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => (
              <Fragment key={log.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDateTime(log.started_at)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div>{log.caller_number ?? "Unknown"}</div>
                    {log.caller_name && (
                      <div className="text-[10px] text-muted-foreground">{log.caller_name}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{log.agent_name}</TableCell>
                  <TableCell className="text-xs capitalize">{log.direction}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatDuration(log.duration_sec)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "h-5 rounded border px-1.5 text-[10px]",
                        STATUS_STYLE[log.status] ?? STATUS_STYLE.completed
                      )}
                    >
                      {STATUS_LABELS[log.status] ?? log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatCost(log.cost_usd)}
                  </TableCell>
                  <TableCell>
                    {log.outcome && log.outcome !== "unknown" ? (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "h-5 rounded border px-1.5 text-[10px]",
                          OUTCOME_STYLE[log.outcome] ?? OUTCOME_STYLE.unknown
                        )}
                      >
                        {OUTCOME_LABELS[log.outcome] ?? log.outcome}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {expandedId === log.id ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </TableCell>
                </TableRow>
                {expandedId === log.id && (
                  <TableRow>
                    <TableCell colSpan={9} className="bg-secondary/30 p-4">
                      {log.summary && (
                        <div className="mb-3">
                          <h4 className="mb-1 text-xs font-semibold">Summary</h4>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {log.summary}
                          </p>
                        </div>
                      )}
                      <h4 className="mb-2 text-xs font-semibold">Transcript</h4>
                      <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-muted-foreground">
                        {formatTranscript(log.transcript)}
                      </pre>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                  {logs.length === 0
                    ? "No call logs yet. Calls made through your voice agents will appear here."
                    : "No call logs match your filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}