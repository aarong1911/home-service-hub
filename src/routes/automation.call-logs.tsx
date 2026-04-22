import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/automation/call-logs")({
  head: () => ({
    meta: [
      { title: "Call Logs — RenoMeta" },
      { name: "description", content: "Voice agent call history and transcripts." },
    ],
  }),
  component: CallLogsPage,
});

type CallStatus = "Completed" | "Missed" | "Failed" | "Voicemail";
type CallDirection = "Inbound" | "Outbound";
type CallOutcome = "Lead Saved" | "Appointment Booked" | "Info Request" | "Transferred";

type CallLog = {
  id: string;
  dateTime: string;
  callerPhone: string;
  callerName: string;
  agentName: string;
  direction: CallDirection;
  duration: string;
  status: CallStatus;
  cost: string;
  outcome: CallOutcome;
  transcript: string;
};

const STATUS_STYLE: Record<CallStatus, string> = {
  Completed: "bg-success/15 text-success border-success/30",
  Missed: "bg-warning/15 text-warning border-warning/30",
  Failed: "bg-destructive/15 text-destructive border-destructive/30",
  Voicemail: "bg-muted text-muted-foreground border-border",
};

const OUTCOME_STYLE: Record<CallOutcome, string> = {
  "Lead Saved": "bg-primary/15 text-primary border-primary/30",
  "Appointment Booked": "bg-success/15 text-success border-success/30",
  "Info Request": "bg-muted text-muted-foreground border-border",
  Transferred: "bg-warning/15 text-warning border-warning/30",
};

const MOCK_LOGS: CallLog[] = [
  {
    id: "1",
    dateTime: "2026-04-22 09:14 AM",
    callerPhone: "(555) 234-5678",
    callerName: "Sarah Mitchell",
    agentName: "Inbound Receptionist",
    direction: "Inbound",
    duration: "3:42",
    status: "Completed",
    cost: "$0.18",
    outcome: "Lead Saved",
    transcript: "Agent: Hi there! Thanks for calling. My name is Sarah and I'd love to help you get started on your project. Can I ask what type of work you're looking to have done?\n\nCaller: Yeah, hi. I'm looking to get my kitchen remodeled. We have a pretty outdated layout and want to modernize it.\n\nAgent: That sounds exciting! Kitchen remodels are one of our specialties. Can you tell me a bit about your timeline? When were you hoping to start?\n\nCaller: Ideally in the next month or two. We're flexible though.\n\nAgent: Perfect. And do you have a rough budget range in mind?\n\nCaller: We're thinking somewhere between $60,000 and $80,000.\n\nAgent: Great, that's a solid range for a full kitchen remodel. Let me get some information and set you up with one of our project consultants for a site visit. Can I get your name and the best number to reach you?",
  },
  {
    id: "2",
    dateTime: "2026-04-22 08:47 AM",
    callerPhone: "(555) 876-5432",
    callerName: "Unknown",
    agentName: "Inbound Receptionist",
    direction: "Inbound",
    duration: "0:32",
    status: "Missed",
    cost: "$0.02",
    outcome: "Info Request",
    transcript: "Call was not answered. Caller hung up before voicemail.",
  },
  {
    id: "3",
    dateTime: "2026-04-21 04:22 PM",
    callerPhone: "(555) 345-6789",
    callerName: "Mike Chen",
    agentName: "Inbound Receptionist",
    direction: "Inbound",
    duration: "5:18",
    status: "Completed",
    cost: "$0.26",
    outcome: "Appointment Booked",
    transcript: "Agent: Hi there! Thanks for calling. My name is Sarah and I'd love to help you get started on your project.\n\nCaller: Hi Sarah, this is Mike Chen. I spoke with Marcus last week about an addition to our home. He mentioned I should call back to schedule the site visit.\n\nAgent: Of course, Mike! Let me pull up Marcus's calendar. I can see he has availability this Thursday at 10 AM or Friday at 2 PM. Would either of those work for you?\n\nCaller: Thursday at 10 works perfectly.\n\nAgent: Wonderful! I've got you booked for Thursday at 10 AM. You'll receive a confirmation text shortly with all the details. Is there anything else I can help with?\n\nCaller: No, that's all. Thank you!\n\nAgent: Great, thank you Mike! We look forward to seeing you Thursday. Have a great day!",
  },
  {
    id: "4",
    dateTime: "2026-04-21 02:11 PM",
    callerPhone: "(555) 111-2233",
    callerName: "Lisa Park",
    agentName: "Inbound Receptionist",
    direction: "Inbound",
    duration: "1:45",
    status: "Voicemail",
    cost: "$0.08",
    outcome: "Info Request",
    transcript: "Voicemail: Hi, this is Lisa Park calling about getting a quote for bathroom remodeling. Can someone give me a call back at 555-111-2233? Thank you.",
  },
  {
    id: "5",
    dateTime: "2026-04-21 11:03 AM",
    callerPhone: "(555) 999-8877",
    callerName: "James Rodriguez",
    agentName: "Inbound Receptionist",
    direction: "Inbound",
    duration: "4:56",
    status: "Completed",
    cost: "$0.24",
    outcome: "Transferred",
    transcript: "Agent: Hi there! Thanks for calling.\n\nCaller: Hi, I have a question about the warranty on the work your crew did at my place last year. The tiles in the shower are cracking.\n\nAgent: I'm sorry to hear that. Let me connect you with our project manager who handles warranty claims. Please hold for just a moment.\n\n[Call transferred to Marcus]",
  },
];

function CallLogsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = MOCK_LOGS.filter((log) => {
    if (statusFilter !== "all" && log.status !== statusFilter) return false;
    if (directionFilter !== "all" && log.direction !== directionFilter) return false;
    return true;
  });

  const handleExportCSV = () => {
    const headers = ["Date/Time", "Caller", "Agent", "Direction", "Duration", "Status", "Cost", "Outcome"];
    const rows = MOCK_LOGS.map((l) => [l.dateTime, `${l.callerPhone} ${l.callerName}`, l.agentName, l.direction, l.duration, l.status, l.cost, l.outcome]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "call-logs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/automation/agents">
          <Button variant="ghost" size="sm" className="h-8">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs">Back to AI Center</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Call Logs</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="h-8 w-36 text-xs" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" className="h-8 w-36 text-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Status</SelectItem>
            <SelectItem value="Completed" className="text-xs">Completed</SelectItem>
            <SelectItem value="Missed" className="text-xs">Missed</SelectItem>
            <SelectItem value="Failed" className="text-xs">Failed</SelectItem>
            <SelectItem value="Voicemail" className="text-xs">Voicemail</SelectItem>
          </SelectContent>
        </Select>
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Directions</SelectItem>
            <SelectItem value="Inbound" className="text-xs">Inbound</SelectItem>
            <SelectItem value="Outbound" className="text-xs">Outbound</SelectItem>
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
              <TableHead className="text-xs w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => (
              <>
                <TableRow key={log.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                  <TableCell className="text-xs whitespace-nowrap">{log.dateTime}</TableCell>
                  <TableCell className="text-xs">
                    <div>{log.callerPhone}</div>
                    {log.callerName !== "Unknown" && <div className="text-[10px] text-muted-foreground">{log.callerName}</div>}
                  </TableCell>
                  <TableCell className="text-xs">{log.agentName}</TableCell>
                  <TableCell className="text-xs">{log.direction}</TableCell>
                  <TableCell className="text-xs tabular-nums">{log.duration}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("h-5 rounded border px-1.5 text-[10px]", STATUS_STYLE[log.status])}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{log.cost}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("h-5 rounded border px-1.5 text-[10px]", OUTCOME_STYLE[log.outcome])}>
                      {log.outcome}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {expandedId === log.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </TableCell>
                </TableRow>
                {expandedId === log.id && (
                  <TableRow key={`${log.id}-transcript`}>
                    <TableCell colSpan={9} className="bg-secondary/30 p-4">
                      <h4 className="mb-2 text-xs font-semibold">Transcript</h4>
                      <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground font-sans">
                        {log.transcript}
                      </pre>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                  No call logs match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}