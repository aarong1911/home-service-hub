import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Receipt, AlertTriangle, CheckCircle2, Clock, MoreHorizontal } from "lucide-react";
import { mockInvoices, type Invoice } from "@/lib/mock-data";
import { formatDate, formatMoney, daysFromNow } from "@/lib/format";
import { useMemo, useState } from "react";
import { FinancialDetailDrawer } from "@/components/financials/financial-detail-drawer";

export const Route = createFileRoute("/financials/invoices")({
  component: InvoicesPage,
});

const STATUSES: Invoice["status"][] = ["Draft", "Sent", "Viewed", "Paid", "Overdue"];

function InvoicesPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Invoice["status"] | "All">("All");
  const [selected, setSelected] = useState<Invoice | null>(null);

  const stats = useMemo(() => {
    const total = mockInvoices.reduce((s, i) => s + i.amount, 0);
    const paid = mockInvoices.filter((i) => i.status === "Paid");
    const overdue = mockInvoices.filter((i) => i.status === "Overdue");
    const outstanding = mockInvoices.filter((i) => i.status !== "Paid" && i.status !== "Draft");
    return {
      total,
      paid: paid.reduce((s, i) => s + i.amount, 0),
      overdue: overdue.reduce((s, i) => s + i.amount, 0),
      overdueCount: overdue.length,
      outstanding: outstanding.reduce((s, i) => s + i.amount, 0),
    };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockInvoices.filter((i) => {
      if (status !== "All" && i.status !== status) return false;
      if (!q) return true;
      return i.client.toLowerCase().includes(q) || i.number.toLowerCase().includes(q);
    });
  }, [query, status]);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total invoiced" value={formatMoney(stats.total)} sub={`${mockInvoices.length} invoices`} icon={Receipt} tone="primary" />
        <Kpi label="Outstanding" value={formatMoney(stats.outstanding)} sub="awaiting payment" icon={Clock} tone="warning" />
        <Kpi label="Overdue" value={formatMoney(stats.overdue)} sub={`${stats.overdueCount} invoices`} icon={AlertTriangle} tone="destructive" />
        <Kpi label="Collected" value={formatMoney(stats.paid)} sub="fully paid" icon={CheckCircle2} tone="success" />
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
              <th className="px-4 py-2 text-left font-medium">Due</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const days = daysFromNow(i.due);
              const isOverdue = i.status === "Overdue" || (days < 0 && i.status !== "Paid" && i.status !== "Draft");
              const dueLabel =
                i.status === "Paid"
                  ? formatDate(i.due)
                  : days === 0
                    ? "Due today"
                    : days > 0
                      ? `In ${days}d · ${formatDate(i.due)}`
                      : `${Math.abs(days)}d late · ${formatDate(i.due)}`;
              return (
                <tr
                  key={i.id}
                  onClick={() => setSelected(i)}
                  className="h-12 cursor-pointer border-b border-border last:border-b-0 hover:bg-secondary/30"
                >
                  <td className="px-4 font-mono text-xs">{i.number}</td>
                  <td className="px-4 font-medium">{i.client}</td>
                  <td className="px-4">
                    <InvoiceStatus status={i.status} />
                  </td>
                  <td className="px-4 text-right font-medium tabular-nums">{formatMoney(i.amount)}</td>
                  <td className={"px-4 text-xs " + (isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {dueLabel}
                  </td>
                  <td className="px-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No invoices match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <FinancialDetailDrawer
        record={selected ? { kind: "invoice", ...selected } : null}
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
  tone: "primary" | "success" | "warning" | "destructive" | "muted";
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
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

function InvoiceStatus({ status }: { status: Invoice["status"] }) {
  const map: Record<Invoice["status"], string> = {
    Draft: "bg-secondary text-secondary-foreground",
    Sent: "bg-primary-soft text-primary",
    Viewed: "bg-chart-2/15 text-chart-2",
    Paid: "bg-success/15 text-success",
    Overdue: "bg-destructive/15 text-destructive",
  };
  return (
    <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${map[status]}`}>
      {status}
    </Badge>
  );
}
