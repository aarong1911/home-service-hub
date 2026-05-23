import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, FileText, CheckCircle2, Eye, Send, MoreHorizontal, Sparkles, Star, ArrowRight, Trash2, Plus,
} from "lucide-react";
import { mockEstimates, mockContacts, type Estimate } from "@/lib/mock-data";
import {
  estimateTemplates, estimateTemplateSubtotal, estimateTemplateTotal,
  type SharedEstimateTemplate, type EstimateLine,
} from "@/lib/estimate-templates";
import { formatDate, formatMoney } from "@/lib/format";
import { useMemo, useState } from "react";
import { FinancialDetailDrawer } from "@/components/financials/financial-detail-drawer";
import { toast } from "sonner";
import { useEffect } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";

type EstimatesSearch = { template?: string; clientName?: string };

export const Route = createFileRoute("/financials/estimates")({
  validateSearch: (raw: Record<string, unknown>): EstimatesSearch => ({
    template: typeof raw.template === "string" ? raw.template : undefined,
    clientName: typeof raw.clientName === "string" ? raw.clientName : undefined,
  }),
  component: EstimatesPage,
});

const STATUSES: Estimate["status"][] = ["Draft", "Sent", "Viewed", "Accepted", "Declined"];

function EstimatesPage() {
  const search = useSearch({ from: "/financials/estimates" });
  const navigate = useNavigate({ from: "/financials/estimates" });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Estimate["status"] | "All">("All");
  const [selected, setSelected] = useState<Estimate | null>(null);
  const [drafts, setDrafts] = useState<Estimate[]>([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [prefillClient, setPrefillClient] = useState<string | undefined>(undefined);

  // Deep-link: open template wizard with prefilled client
  useEffect(() => {
    if (search.template === "open" || search.clientName) {
      setPrefillClient(search.clientName);
      setTplOpen(true);
      navigate({ search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.template, search.clientName]);

  const allEstimates = useMemo(() => [...drafts, ...mockEstimates], [drafts]);

  const stats = useMemo(() => {
    const total = allEstimates.reduce((s, e) => s + e.amount, 0);
    const accepted = allEstimates.filter((e) => e.status === "Accepted");
    const pending = allEstimates.filter((e) => e.status === "Sent" || e.status === "Viewed");
    const winRate = Math.round(
      (accepted.length / Math.max(1, allEstimates.filter((e) => e.status !== "Draft").length)) * 100,
    );
    return {
      total,
      accepted: accepted.reduce((s, e) => s + e.amount, 0),
      pending: pending.reduce((s, e) => s + e.amount, 0),
      winRate,
      count: allEstimates.length,
    };
  }, [allEstimates]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEstimates.filter((e) => {
      if (status !== "All" && e.status !== status) return false;
      if (!q) return true;
      return e.client.toLowerCase().includes(q) || e.number.toLowerCase().includes(q);
    });
  }, [allEstimates, query, status]);

  const handleCreated = (estimate: Estimate) => {
    setDrafts((prev) => [estimate, ...prev]);
    setTplOpen(false);
    toast.success(`Draft ${estimate.number} created for ${estimate.client}`);
    setSelected(estimate);
  };

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Pipeline value" value={formatMoney(stats.total)} sub={`${stats.count} estimates`} icon={FileText} tone="primary" />
        <Kpi label="Accepted" value={formatMoney(stats.accepted)} sub="ready to invoice" icon={CheckCircle2} tone="success" />
        <Kpi label="Awaiting response" value={formatMoney(stats.pending)} sub="sent / viewed" icon={Send} tone="warning" />
        <Kpi label="Win rate" value={`${stats.winRate}%`} sub="excl. drafts" icon={Eye} tone="muted" />
      </div>

      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search number or client…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterChip active={status === "All"} onClick={() => setStatus("All")}>
              All
            </FilterChip>
            {STATUSES.map((s) => (
              <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s}
              </FilterChip>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-8" onClick={() => setTplOpen(true)}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" /> Start from template
            </Button>
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New estimate
            </Button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Number</th>
              <th className="px-4 py-2 text-left font-medium">Client</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-left font-medium">Issued</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.id}
                onClick={() => setSelected(e)}
                className="h-12 cursor-pointer border-b border-border last:border-b-0 hover:bg-secondary/30"
              >
                <td className="px-4 font-mono text-xs">{e.number}</td>
                <td className="px-4 font-medium">{e.client}</td>
                <td className="px-4">
                  <EstimateStatus status={e.status} />
                </td>
                <td className="px-4 text-right font-medium tabular-nums">{formatMoney(e.amount)}</td>
                <td className="px-4 text-xs text-muted-foreground">{formatDate(e.issued)}</td>
                <td className="px-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No estimates match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <FinancialDetailDrawer
        record={selected ? { kind: "estimate", ...selected } : null}
        onOpenChange={(open) => !open && setSelected(null)}
      />

      <StartFromTemplateDialog
        open={tplOpen}
        onOpenChange={setTplOpen}
        existingCount={allEstimates.length}
        onCreate={handleCreated}
        prefillClient={prefillClient}
      />
    </>
  );
}

// ============ Start-from-template wizard ============
function StartFromTemplateDialog({
  open,
  onOpenChange,
  existingCount,
  onCreate,
  prefillClient,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingCount: number;
  onCreate: (estimate: Estimate) => void;
  prefillClient?: string;
}) {
  const [step, setStep] = useState<"pick" | "customize">("pick");
  const [tplId, setTplId] = useState<string>(estimateTemplates[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [client, setClient] = useState<string>(mockContacts[0]?.name ?? "");
  const [markup, setMarkup] = useState<number>(estimateTemplates[0]?.markup ?? 20);
  const [notes, setNotes] = useState<string>(estimateTemplates[0]?.notes ?? "");
  const [lines, setLines] = useState<EstimateLine[]>(estimateTemplates[0]?.lines ?? []);

  // Apply prefilled client when dialog opens from a deep link
  useEffect(() => {
    if (open && prefillClient) setClient(prefillClient);
  }, [open, prefillClient]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return estimateTemplates;
    return estimateTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [search]);

  const reset = () => {
    setStep("pick");
    setSearch("");
  };

  const choose = (t: SharedEstimateTemplate) => {
    setTplId(t.id);
    setMarkup(t.markup);
    setNotes(t.notes);
    setLines(t.lines.map((l) => ({ ...l })));
    setStep("customize");
  };

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * l.price, 0), [lines]);
  const total = Math.round(subtotal * (1 + markup / 100));

  const updateLine = (idx: number, patch: Partial<EstimateLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));
  const addLine = () =>
    setLines((prev) => [...prev, { name: "New line item", qty: 1, unit: "ea", price: 0 }]);

  const create = () => {
    if (!client.trim()) {
      toast.error("Pick a client for this estimate");
      return;
    }
    const tpl = estimateTemplates.find((t) => t.id === tplId);
    const number = `EST-${String(8000 + existingCount + 1).padStart(4, "0")}`;
    const newDraft: Estimate = {
      id: `draft-${Date.now()}`,
      number,
      client,
      amount: total,
      status: "Draft",
      issued: new Date().toISOString().slice(0, 10),
    };
    onCreate(newDraft);
    // Suppress unused notes/tpl warning — they would be persisted alongside the estimate
    // in a real backend. Here we surface them via toast for confirmation.
    toast.message(`Imported ${lines.length} lines from "${tpl?.name ?? "template"}"`, {
      description: notes ? notes.slice(0, 80) + (notes.length > 80 ? "…" : "") : undefined,
    });
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {step === "pick" ? "Start from template" : "Customize draft"}
          </DialogTitle>
          <DialogDescription>
            {step === "pick"
              ? "Pick a renovation-specific starting point. You can edit every line in the next step."
              : "Tweak line items, markup, and notes. Then create a Draft estimate."}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates by name, category, or description…"
                className="h-9 pl-8 text-sm"
                autoFocus
              />
            </div>
            <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {filtered.map((t) => {
                const tplTotal = estimateTemplateTotal(t);
                return (
                  <button
                    key={t.id}
                    onClick={() => choose(t)}
                    className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-secondary/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">{t.name}</span>
                          {t.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                        </div>
                        <Badge variant="outline" className="mt-1 h-4 px-1.5 text-[9px]">
                          {t.category}
                        </Badge>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                    <p className="line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
                    <div className="mt-auto flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {t.lines.length} lines · {t.markup}% markup
                      </span>
                      <span className="font-semibold tabular-nums">{formatMoney(tplTotal)}</span>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full py-10 text-center text-xs text-muted-foreground">
                  No templates match "{search}".
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Client</Label>
                <Input
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Client name"
                  className="h-8 text-sm"
                  list="estimate-template-clients"
                />
                <datalist id="estimate-template-clients">
                  {mockContacts.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Markup %</Label>
                <Input
                  type="number"
                  value={markup}
                  onChange={(e) => setMarkup(Number(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="rounded-md border border-border">
              <div className="grid grid-cols-[1fr_70px_70px_100px_32px] items-center gap-2 border-b border-border bg-secondary/40 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Price</span>
                <span />
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_70px_100px_32px] items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0">
                    <Input
                      value={l.name}
                      onChange={(e) => updateLine(i, { name: e.target.value })}
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      value={l.qty}
                      onChange={(e) => updateLine(i, { qty: Number(e.target.value) || 0 })}
                      className="h-7 text-right text-xs tabular-nums"
                    />
                    <Input
                      value={l.unit}
                      onChange={(e) => updateLine(i, { unit: e.target.value })}
                      className="h-7 text-xs"
                    />
                    <Input
                      type="number"
                      value={l.price}
                      onChange={(e) => updateLine(i, { price: Number(e.target.value) || 0 })}
                      className="h-7 text-right text-xs tabular-nums"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={addLine}>
                  <Plus className="mr-1 h-3 w-3" /> Add line
                </Button>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-muted-foreground">
                    Subtotal <span className="ml-1 tabular-nums text-foreground">{formatMoney(subtotal)}</span>
                  </span>
                  <span className="font-semibold">
                    Total <span className="ml-1 tabular-nums">{formatMoney(total)}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Notes / terms</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "customize" && (
            <Button variant="ghost" size="sm" onClick={() => setStep("pick")}>
              Back to templates
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === "customize" && (
            <Button size="sm" onClick={create}>
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Create draft
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors " +
        (active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-secondary")
      }
    >
      {children}
    </button>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning" | "muted";
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    muted: "bg-secondary text-muted-foreground",
  }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
        </div>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function EstimateStatus({ status }: { status: Estimate["status"] }) {
  const map: Record<Estimate["status"], string> = {
    Draft: "bg-secondary text-secondary-foreground",
    Sent: "bg-primary-soft text-primary",
    Viewed: "bg-chart-2/15 text-chart-2",
    Accepted: "bg-success/15 text-success",
    Declined: "bg-destructive/15 text-destructive",
  };
  return (
    <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${map[status]}`}>
      {status}
    </Badge>
  );
}
