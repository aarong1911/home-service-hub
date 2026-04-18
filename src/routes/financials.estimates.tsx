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

export const Route = createFileRoute("/financials/estimates")({
  component: EstimatesPage,
});

const STATUSES: Estimate["status"][] = ["Draft", "Sent", "Viewed", "Accepted", "Declined"];

function EstimatesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Estimate["status"] | "All">("All");
  const [selected, setSelected] = useState<Estimate | null>(null);
  const [drafts, setDrafts] = useState<Estimate[]>([]);
  const [tplOpen, setTplOpen] = useState(false);

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
    </>
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
