import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockInvoices, type Invoice } from "@/lib/mock-data";

export const Route = createFileRoute("/financials/invoices")({
  component: InvoicesPage,
});

function InvoicesPage() {
  return (
    <Card className="overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Number</th>
            <th className="px-4 py-2 text-left font-medium">Client</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
            <th className="px-4 py-2 text-left font-medium">Due</th>
          </tr>
        </thead>
        <tbody>
          {mockInvoices.map((i) => (
            <tr key={i.id} className="h-11 border-b border-border last:border-b-0 hover:bg-secondary/30">
              <td className="px-4 font-mono text-xs">{i.number}</td>
              <td className="px-4 font-medium">{i.client}</td>
              <td className="px-4"><InvoiceStatus status={i.status} /></td>
              <td className="px-4 text-right font-medium tabular-nums">${i.amount.toLocaleString()}</td>
              <td className="px-4 text-xs text-muted-foreground">{new Date(i.due).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  return <Badge variant="secondary" className={`h-5 rounded px-1.5 text-[10px] ${map[status]}`}>{status}</Badge>;
}
