import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Mail, Phone, MapPin, Target, Flame, Thermometer, Snowflake,
  ArrowRight, User, Building2, Calendar, ExternalLink, Pencil,
  CalendarCheck, StickyNote, Clock,
} from "lucide-react";
import { type Lead, type LeadSource, type LeadStatus, type LeadScore } from "@/lib/mock-data";
import { formatMoney, formatDateShort } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const ALL_SCORES: LeadScore[] = ["hot", "warm", "cold"];
const LOSS_REASONS = ["Price", "Timing", "Competitor", "No Response"] as const;
type LossReason = (typeof LOSS_REASONS)[number];

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", converted: "Converted", lost: "Lost",
};

function scoreIcon(score: LeadScore) {
  switch (score) {
    case "hot": return { Icon: Flame, className: "text-red-500" };
    case "warm": return { Icon: Thermometer, className: "text-amber-500" };
    case "cold": return { Icon: Snowflake, className: "text-sky-500" };
  }
}

function statusBadgeVariant(status: LeadStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "new": return "default";
    case "contacted": return "secondary";
    case "qualified": return "outline";
    case "converted": return "default";
    case "lost": return "destructive";
  }
}

type InternalNote = { id: string; text: string; at: string };

export function LeadDrawerPanel({
  lead,
  onOpenChange,
  onStatusChange,
  onScoreChange,
  onConvert,
  teamMembers,
}: {
  lead: Lead | null;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
  onScoreChange: (id: string, score: LeadScore) => void;
  onConvert: (lead: Lead) => void;
  teamMembers: { id: string; name: string }[];
}) {
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState<LossReason | null>(null);
  const [lostNotes, setLostNotes] = useState("");
  const [editBudget, setEditBudget] = useState(false);
  const [budgetVal, setBudgetVal] = useState("");
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState<InternalNote[]>([]);

  if (!lead) return <Sheet open={false} onOpenChange={onOpenChange}><SheetContent className="hidden" /></Sheet>;

  const { Icon: ScoreIcon, className: scoreCls } = scoreIcon(lead.score);
  const nextStatuses: LeadStatus[] = (() => {
    switch (lead.status) {
      case "new": return ["contacted"];
      case "contacted": return ["qualified"];
      case "qualified": return [];
      default: return [];
    }
  })();

  const canAct = lead.status !== "converted" && lead.status !== "lost";

  const openLostDialog = () => {
    setLostReason(null);
    setLostNotes("");
    setLostOpen(true);
  };

  const confirmLost = () => {
    if (!lostReason) return;
    onStatusChange(lead.id, "lost");
    toast(`${lead.name} marked as Lost`, { description: `Reason: ${lostReason}${lostNotes ? ` · ${lostNotes.slice(0, 60)}` : ""}` });
    setLostOpen(false);
  };

  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    setNotes((prev) => [{ id: `n-${Date.now()}`, text, at: new Date().toISOString() }, ...prev]);
    setNoteText("");
    toast.success("Note added");
  };

  const mapsUrl = lead.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`
    : null;

  return (
    <>
      <Sheet open={!!lead} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader className="space-y-3 border-b border-border pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-left">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge variant={statusBadgeVariant(lead.status)} className="text-[10px]">
                    {STATUS_LABELS[lead.status]}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <ScoreIcon className={`h-3.5 w-3.5 ${scoreCls}`} />
                    <span className="text-[11px] capitalize text-muted-foreground">{lead.score}</span>
                  </div>
                </div>
                <SheetTitle className="text-base leading-snug">{lead.name}</SheetTitle>
                <SheetDescription className="mt-0.5 text-xs">
                  {lead.source} · Owned by {lead.owner}
                </SheetDescription>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <div className="text-xl font-semibold tabular-nums">{formatMoney(lead.estimatedBudget)}</div>
                  <button
                    onClick={() => { setBudgetVal(String(lead.estimatedBudget)); setEditBudget(true); }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Edit budget"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground">Est. budget</div>
                {editBudget && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <Input
                      value={budgetVal}
                      onChange={(e) => setBudgetVal(e.target.value)}
                      className="h-7 w-24 text-xs"
                      type="number"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { toast.success("Budget updated"); setEditBudget(false); }
                        if (e.key === "Escape") setEditBudget(false);
                      }}
                    />
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { toast.success("Budget updated"); setEditBudget(false); }}>
                      Save
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {canAct && (
                <>
                  <Button size="sm" className="flex-1 min-w-[120px]" onClick={() => onConvert(lead)}>
                    <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> Convert to Deal
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 min-w-[120px]" onClick={() => toast.success("Estimate scheduled", { description: `For ${lead.name}` })}>
                    <CalendarCheck className="mr-1.5 h-3.5 w-3.5" /> Schedule Estimate
                  </Button>
                </>
              )}
              {nextStatuses.map((ns) => (
                <Button key={ns} size="sm" variant="outline" className="flex-1 min-w-[100px]" onClick={() => onStatusChange(lead.id, ns)}>
                  {STATUS_LABELS[ns]}
                </Button>
              ))}
              {canAct && (
                <Button size="sm" variant="outline" className="flex-1 min-w-[80px] text-destructive hover:bg-destructive/10" onClick={openLostDialog}>
                  Lost
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            {/* Contact info — actionable links */}
            <section>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Contact Info</div>
              <div className="space-y-2">
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{lead.email}</span>
                  </a>
                )}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors min-h-[44px] sm:min-h-0">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{lead.phone}</span>
                    <Badge variant="outline" className="ml-auto text-[9px] px-1.5 py-0">Call</Badge>
                  </a>
                )}
                {lead.address && mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors min-h-[44px] sm:min-h-0">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{lead.address}</span>
                    <Badge variant="outline" className="ml-auto shrink-0 text-[9px] px-1.5 py-0">Map</Badge>
                  </a>
                )}
              </div>
            </section>

            {/* Facts — uniform border-only style */}
            <section className="grid grid-cols-2 gap-3">
              <FactCard icon={User} label="Owner" value={lead.owner} />
              <FactCard icon={Target} label="Source" value={lead.source} />
              <FactCard icon={Building2} label="Project" value={lead.projectType} />
              <FactCard icon={Calendar} label="Created" value={formatDateShort(lead.createdAt)} />
            </section>

            <Separator />

            {/* Lead Score — compact toggle group */}
            <section>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Lead Score</div>
              <ToggleGroup
                type="single"
                value={lead.score}
                onValueChange={(v) => { if (v) onScoreChange(lead.id, v as LeadScore); }}
                className="w-full"
              >
                {ALL_SCORES.map((s) => {
                  const { Icon: SI, className: sc } = scoreIcon(s);
                  return (
                    <ToggleGroupItem
                      key={s}
                      value={s}
                      className="flex-1 gap-1.5 capitalize text-xs h-8 data-[state=on]:bg-primary-soft data-[state=on]:text-primary"
                      aria-label={s}
                    >
                      <SI className={`h-3 w-3 ${sc}`} />
                      {s}
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            </section>

            <Separator />

            {/* Internal Notes */}
            <section>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Internal Notes</div>
              <div className="flex gap-2">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a quick note…"
                  rows={2}
                  className="flex-1 resize-none text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote(); }}
                />
                <Button size="sm" variant="outline" className="self-end h-8" onClick={addNote} disabled={!noteText.trim()}>
                  <StickyNote className="h-3.5 w-3.5" />
                </Button>
              </div>
              {(notes.length > 0 || lead.notes) && (
                <div className="mt-3 max-h-[140px] space-y-2 overflow-y-auto scrollbar-thin">
                  {notes.slice(0, 3).map((n) => (
                    <div key={n.id} className="rounded-md border border-border bg-card p-2">
                      <p className="text-xs text-foreground">{n.text}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(n.at), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                  {lead.notes && notes.length === 0 && (
                    <div className="rounded-md border border-border bg-card p-2">
                      <p className="text-xs text-muted-foreground">{lead.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {lead.convertedDealId && (
              <>
                <Separator />
                <section>
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Converted Deal</div>
                  <div className="flex items-center gap-2 rounded-md border border-border bg-card p-3 text-sm">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Deal ID: {lead.convertedDealId}</span>
                  </div>
                </section>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Lost reason dialog */}
      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reason for Loss</DialogTitle>
            <DialogDescription>Help track why this lead didn't convert.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-1.5">
              {LOSS_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setLostReason(r)}
                  className={`h-9 rounded-md border px-3 text-left text-sm font-medium transition-colors ${
                    lostReason === r
                      ? "border-primary/40 bg-primary-soft text-primary"
                      : "border-border bg-background text-foreground hover:bg-secondary/60"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea
              value={lostNotes}
              onChange={(e) => setLostNotes(e.target.value)}
              placeholder="Additional context (optional)"
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setLostOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!lostReason} onClick={confirmLost}>Mark as Lost</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FactCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}