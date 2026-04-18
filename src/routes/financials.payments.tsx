import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, DollarSign, Building2, CreditCard as CardIcon, Banknote, MoreHorizontal } from "lucide-react";
import { mockPayments, type Payment } from "@/lib/mock-data";
import { formatDate, formatMoney } from "@/lib/format";
import { useMemo, useState } from "react";
import { PaymentDetailDrawer } from "@/components/financials/payment-detail-drawer";

export const Route = createFileRoute("/financials/payments")({
  component: PaymentsPage,
});

const METHODS: Payment["method"][] = ["ACH", "Card", "Check", "Wire"];

function PaymentsPage() {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<Payment["method"] | "All">("All");
  const [selected, setSelected] = useState<Payment | null>(null);

  const stats = useMemo(() => {
    const total = mockPayments.reduce((s, p) => s + p.amount, 0);
    const byMethod: Record<string, number> = {};
    mockPayments.forEach((p) => {
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
    });
    const top = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0];
    const avg = Math.round(total / Math.max(1, mockPayments.length));
    return { total, top, avg, count: mockPayments.length };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockPayments.filter((p) => {
      if (method !== "All" && p.method !== method) return false;
      if (!q) return true;
      return (
        p.client.toLowerCase().includes(q) ||
        p.invoice.toLowerCase().includes(q)
      );
    });
  }, [query, method]);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Received" value={formatMoney(stats.total)} sub={`${stats.count} payments`} icon={DollarSign} tone="success" />
        <Kpi label="Average payment" value={formatMoney(stats.avg)} sub="per transaction" icon={Banknote} tone="primary" />
        <Kpi label="Top method" value={stats.top?.[0] ?? "—"} sub={stats.top ? formatMoney(stats.top[1]) : ""} icon={CardIcon} tone="muted" />
        <Kpi label="Unique clients" value={String(new Set(mockPayments.map((p) => p.client)).size)} sub="this period" icon={Building2} tone="muted" />
      </div>

      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoice or client…"
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <FilterChip active={method === "All"} onClick={() => setMethod("All")}>
              All
            </FilterChip>
            {METHODS.map((m) => (
              <FilterChip key={m} active={method === m} onClick={() => setMethod(m)}>
                {m}
              </FilterChip>
            ))}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Invoice</th>
              <th className="px-4 py-2 text-left font-medium">Client</th>
              <th className="px-4 py-2 text-left font-medium">Method</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-left font-medium">Received</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelected(p)}
                className="h-12 cursor-pointer border-b border-border last:border-b-0 hover:bg-secondary/30"
              >
                <td className="px-4 font-mono text-xs">{p.invoice}</td>
                <td className="px-4 font-medium">{p.client}</td>
                <td className="px-4">
                  <MethodBadge method={p.method} />
                </td>
                <td className="px-4 text-right font-semibold tabular-nums text-success">
                  +{formatMoney(p.amount)}
                </td>
                <td className="px-4 text-xs text-muted-foreground">{formatDate(p.receivedAt)}</td>
                <td className="px-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No payments match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <PaymentDetailDrawer
        payment={selected}
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

function MethodBadge({ method }: { method: Payment["method"] }) {
  const map: Record<Payment["method"], string> = {
    ACH: "bg-chart-2/15 text-chart-2",
    Card: "bg-primary-soft text-primary",
    Check: "bg-secondary text-secondary-foreground",
    Wire: "bg-chart-5/15 text-chart-5",
  };
  return (
    <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${map[method]}`}>
      {method}
    </Badge>
  );
}
