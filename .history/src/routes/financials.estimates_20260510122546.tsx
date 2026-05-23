// src/routes/financials.estimates.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, FileText, CheckCircle2, Clock, Send, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/financials/estimates")({ component: EstimatesPage });

type Estimate = {
  id: string;
  number: string | null;
  title: string;
  status: string;
  client_id: string;
  client_name: string;
  subtotal: number;
  tax_total: number;
  total: number;
  client_total: number;
  contractor_margin: number;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-muted text-muted-foreground border-border",
  sent:     "bg-sky-500/10 text-sky-600 border-sky-200",
  viewed:   "bg-violet-500/10 text-violet-600 border-violet-200",
  accepted: "bg-success/10 text-success border-success/20",
  declined: "bg-destructive/10 text-destructive border-destructive/20",
  signed:   "bg-emerald-500/10 text-emerald-600 border-emerald-200",
};

function fmtDate(s: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(s));
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (p?.organization_id) return p.organization_id;
  const { data: m } = await supabase.from("org_memberships").select("org_id").eq("member_id", user.id).maybeSingle();
  return m?.org_id ?? null;
}

function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Estimate | null>(null);

  const load = useCallback(async () => {
    const orgId = await getOrgId();
    if (!orgId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("estimates")
      .select(`*, contacts!client_id(full_name)`)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[estimates]", error); setLoading(false); return; }
    setEstimates((data ?? []).map((r: any) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      status: r.status ?? "draft",
      client_id: r.client_id,
      client_name: r.client_name ?? r.contacts?.full_name ?? "—",
      subtotal: Number(r.subtotal ?? 0),
      tax_total: Number(r.tax_total ?? 0),
      total: Number(r.total ?? 0),
      client_total: Number(r.client_total ?? 0),
      contractor_margin: Number(r.contractor_margin ?? 0),
      valid_until: r.valid_until,
      sent_at: r.sent_at,
      viewed_at: r.viewed_at,
      signed_at: r.signed_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return estimates.filter(e => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (!q) return true;
      return e.title.toLowerCase().includes(q) || e.client_name.toLowerCase().includes(q) || (e.number ?? "").toLowerCase().includes(q);
    });
  }, [estimates, search, statusFilter]);

  const stats = useMemo(() => ({
    total: estimates.length,
    totalValue: estimates.reduce((s, e) => s + e.client_total, 0),
    accepted: estimates.filter(e => ["accepted","signed"].includes(e.status)).length,
    pending: estimates.filter(e => ["sent","viewed"].includes(e.status)).length,
  }), [estimates]);

  const updateStatus = async (id: string, status: string) => {
    const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
    if (status === "sent") patch.sent_at = new Date().toISOString();
    const { error } = await supabase.from("estimates").update(patch).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success(`Estimate marked as ${status}`);
    load();
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s);
  };

  return (
    <>
      <PageHeader title="Estimates" subtitle="Proposals and bids across all clients." breadcrumb={["Financials", "Estimates"]}
        actions={<Button size="sm" onClick={() => toast.info("New estimate — coming soon")}><FileText className="mr-1.5 h-3.5 w-3.5" /> New Estimate</Button>}
      />

      {/* KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total estimates", value: stats.total, icon: FileText },
          { label: "Total value", value: formatMoney(stats.totalValue), icon: CheckCircle2 },
          { label: "Accepted", value: stats.accepted, icon: CheckCircle2, tone: "success" },
          { label: "Awaiting response", value: stats.pending, icon: Clock, tone: "warning" },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <div className="flex items-start justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</div>
              <k.icon className={cn("h-4 w-4", k.tone === "success" ? "text-success" : k.tone === "warning" ? "text-warning" : "text-muted-foreground")} />
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-3 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search estimates…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.keys(STATUS_STYLES).map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2.5 pl-4 pr-3 text-left">Estimate</th>
              <th className="py-2.5 pr-4 text-left">Client</th>
              <th className="py-2.5 pr-4 text-left">Status</th>
              <th className="py-2.5 pr-4 text-right">Total</th>
              <th className="py-2.5 pr-4 text-left">Valid Until</th>
              <th className="py-2.5 pr-4 text-left">Activity</th>
              <th className="w-10 py-2.5 pr-3" />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({length:5}).map((_,i) => (
              <tr key={i} className="border-b border-border">{Array.from({length:6}).map((_,j)=><td key={j} className="py-3 pr-4"><Skeleton className="h-4 w-24" /></td>)}<td/></tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No estimates found.</td></tr>
            )}
            {!loading && filtered.map(e => (
              <tr key={e.id} onClick={() => setSelected(e)} className="cursor-pointer border-b border-border hover:bg-secondary/30">
                <td className="py-2.5 pl-4 pr-3">
                  <div className="font-medium">{e.title}</div>
                  {e.number && <div className="text-[11px] text-muted-foreground">{e.number}</div>}
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">{e.client_name}</td>
                <td className="py-2.5 pr-4">
                  <Badge variant="secondary" className={cn("h-5 rounded border px-1.5 text-[10px] capitalize", STATUS_STYLES[e.status] ?? STATUS_STYLES.draft)}>{e.status}</Badge>
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{formatMoney(e.client_total || e.total)}</td>
                <td className="py-2.5 pr-4 text-[11px] text-muted-foreground">{e.valid_until ? fmtDate(e.valid_until) : "—"}</td>
                <td className="py-2.5 pr-4 text-[11px] text-muted-foreground">
                  {e.viewed_at ? <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Viewed</span>
                    : e.sent_at ? <span className="flex items-center gap-1"><Send className="h-3 w-3" /> Sent</span>
                    : "—"}
                </td>
                <td className="py-2.5 pr-3" onClick={ev => ev.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelected(e)}>View</DropdownMenuItem>
                      {e.status === "draft" && <DropdownMenuItem onClick={() => updateStatus(e.id, "sent")}>Mark as Sent</DropdownMenuItem>}
                      {["sent","viewed"].includes(e.status) && <DropdownMenuItem onClick={() => updateStatus(e.id, "accepted")}>Mark as Accepted</DropdownMenuItem>}
                      {["sent","viewed"].includes(e.status) && <DropdownMenuItem onClick={() => updateStatus(e.id, "declined")} className="text-destructive">Mark as Declined</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="border-b border-border pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <SheetTitle className="text-base">{selected.title}</SheetTitle>
                    <SheetDescription className="text-xs">{selected.client_name}{selected.number ? ` · ${selected.number}` : ""}</SheetDescription>
                  </div>
                  <Badge variant="secondary" className={cn("h-5 shrink-0 rounded border px-1.5 text-[10px] capitalize", STATUS_STYLES[selected.status] ?? STATUS_STYLES.draft)}>{selected.status}</Badge>
                </div>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <FactBox label="Subtotal" value={formatMoney(selected.subtotal)} />
                  <FactBox label="Tax" value={formatMoney(selected.tax_total)} />
                  <FactBox label="Total (client)" value={formatMoney(selected.client_total || selected.total)} highlight />
                  {selected.contractor_margin > 0 && <FactBox label="Margin" value={`${selected.contractor_margin}%`} />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {selected.valid_until && <FactBox label="Valid until" value={fmtDate(selected.valid_until)} />}
                  {selected.sent_at && <FactBox label="Sent" value={fmtDate(selected.sent_at)} />}
                  {selected.viewed_at && <FactBox label="Viewed" value={fmtDate(selected.viewed_at)} />}
                  {selected.signed_at && <FactBox label="Signed" value={fmtDate(selected.signed_at)} />}
                </div>
                <div className="flex gap-2">
                  {selected.status === "draft" && <Button className="flex-1" onClick={() => updateStatus(selected.id, "sent")}><Send className="mr-1.5 h-3.5 w-3.5" />Mark Sent</Button>}
                  {["sent","viewed"].includes(selected.status) && <Button className="flex-1 bg-success hover:bg-success/90" onClick={() => updateStatus(selected.id, "accepted")}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Accept</Button>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FactBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular-nums", highlight && "text-base text-primary")}>{value}</div>
    </div>
  );
}