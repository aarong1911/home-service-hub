import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockPayments } from "@/lib/mock-data";

export const Route = createFileRoute("/financials/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const total = mockPayments.reduce((s, p) => s + p.amount, 0);
  return (
    <>
      <Card className="mb-4 p-4">
        <div className="text-xs text-muted-foreground">Received this period</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">${total.toLocaleString()}</div>
      </Card>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Invoice</th>
              <th className="px-4 py-2 text-left font-medium">Client</th>
              <th className="px-4 py-2 text-left font-medium">Method</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-left font-medium">Received</th>
            </tr>
          </thead>
          <tbody>
            {mockPayments.map((p) => (
              <tr key={p.id} className="h-11 border-b border-border last:border-b-0 hover:bg-secondary/30">
                <td className="px-4 font-mono text-xs">{p.invoice}</td>
                <td className="px-4 font-medium">{p.client}</td>
                <td className="px-4">
                  <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">{p.method}</Badge>
                </td>
                <td className="px-4 text-right font-semibold tabular-nums text-success">${p.amount.toLocaleString()}</td>
                <td className="px-4 text-xs text-muted-foreground">{new Date(p.receivedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
