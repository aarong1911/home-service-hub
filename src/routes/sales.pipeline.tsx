import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, ChevronDown, LayoutGrid, List as ListIcon, AlertTriangle,
  DollarSign, TrendingUp, Target, Clock, SlidersHorizontal, Trophy, XCircle,
} from "lucide-react";
import { mockDeals, pipelineStages, type Deal, type LostReason } from "@/lib/mock-data";
const LOST_REASONS_ALL: LostReason[] = ["Budget", "Timing", "Scope", "Competitor", "No response"];
import { formatMoney, formatDateShort } from "@/lib/format";
import { DealDetailDrawer } from "@/components/sales/deal-detail-drawer";

export const Route = createFileRoute("/sales/pipeline")({
  component: PipelinePage,
});

const OWNER_FILTERS = ["All owners", "Alex Romero", "Priya Shah", "Jamal Burke", "Mei Lin", "Sara Holt"] as const;
type OwnerFilter = (typeof OWNER_FILTERS)[number];

const VALUE_FILTERS = ["Any value", "< $25k", "$25k–$75k", "> $75k"] as const;
type ValueFilter = (typeof VALUE_FILTERS)[number];

function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>(mockDeals);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("All owners");
  const [valueFilter, setValueFilter] = useState<ValueFilter>("Any value");
  const [view, setView] = useState<"board" | "list">("board");
  const [selected, setSelected] = useState<Deal | null>(null);

  const handleStageChange = (dealId: string, newStage: string) => {
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage, lostReason: undefined, lostAt: undefined } : d)));
  };

  const handleMarkLost = (dealId: string, reason: LostReason, _notes: string) => {
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? { ...d, stage: "lost", lostReason: reason, lostAt: new Date().toISOString() }
          : d,
      ),
    );
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    setDeals((prev) =>
      prev.map((d) => (d.id === draggableId ? { ...d, stage: destination.droppableId } : d)),
    );
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return deals.filter((d) => {
      if (ownerFilter !== "All owners" && d.owner !== ownerFilter) return false;
      if (valueFilter === "< $25k" && d.value >= 25000) return false;
      if (valueFilter === "$25k–$75k" && (d.value < 25000 || d.value > 75000)) return false;
      if (valueFilter === "> $75k" && d.value <= 75000) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q) || d.contactName.toLowerCase().includes(q);
    });
  }, [deals, search, ownerFilter, valueFilter]);

  const stats = useMemo(() => {
    const open = filtered.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const won = filtered.filter((d) => d.stage === "won");
    const lost = filtered.filter((d) => d.stage === "lost");
    const pipelineValue = open.reduce((s, d) => s + d.value, 0);
    const wonValue = won.reduce((s, d) => s + d.value, 0);
    const lostValue = lost.reduce((s, d) => s + d.value, 0);
    const decided = won.length + lost.length;
    const winRate = decided > 0 ? Math.round((won.length / decided) * 100) : 0;
    const total = filtered.length;
    const avgDeal = total > 0 ? Math.round(filtered.reduce((s, d) => s + d.value, 0) / total) : 0;
    const avgAge = open.length > 0 ? Math.round(open.reduce((s, d) => s + d.ageDays, 0) / open.length) : 0;
    return { pipelineValue, wonValue, lostValue, winRate, avgDeal, avgAge, openCount: open.length, wonCount: won.length, lostCount: lost.length };
  }, [filtered]);

  const lostBreakdown = useMemo(() => {
    const lost = filtered.filter((d) => d.stage === "lost" && d.lostReason);
    const totals = LOST_REASONS_ALL.map((reason) => {
      const items = lost.filter((d) => d.lostReason === reason);
      return { reason, count: items.length, value: items.reduce((s, d) => s + d.value, 0) };
    });
    const max = Math.max(1, ...totals.map((t) => t.count));
    return { totals, max, totalLost: lost.length };
  }, [filtered]);

  return (
    <>
      <PageHeader
        title="Sales Pipeline"
        subtitle="Track deals from first touch to won."
        breadcrumb={["CRM", "Pipeline"]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              Q4 Renovation Pipeline
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Deal
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Pipeline value" value={formatMoney(stats.pipelineValue)} sub={`${stats.openCount} open deals`} icon={DollarSign} tone="primary" />
        <Kpi label="Win rate" value={`${stats.winRate}%`} sub={`${formatMoney(stats.wonValue)} won`} icon={TrendingUp} tone="success" />
        <Kpi label="Won / Lost" value={`${stats.wonCount} / ${stats.lostCount}`} sub={`${formatMoney(stats.wonValue)} vs ${formatMoney(stats.lostValue)}`} icon={Trophy} tone="success" />
        <Kpi label="Avg deal size" value={formatMoney(stats.avgDeal)} sub="Across all stages" icon={Target} tone="warning" />
        <Kpi label="Avg age" value={`${stats.avgAge}d`} sub="In current stage" icon={Clock} tone="muted" />
      </div>

      {/* Lost-reason breakdown */}
      <Card className="mb-3 p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <XCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Lost reasons</div>
              <div className="text-[11px] text-muted-foreground">
                {lostBreakdown.totalLost === 0
                  ? "No lost deals yet"
                  : `${lostBreakdown.totalLost} lost · ${formatMoney(stats.lostValue)} in value`}
              </div>
            </div>
          </div>
        </div>
        {lostBreakdown.totalLost === 0 ? (
          <div className="py-4 text-center text-[11px] text-muted-foreground">
            Mark a deal as lost with a reason to see breakdown insights here.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {lostBreakdown.totals.map((t) => {
              const pct = Math.round((t.count / lostBreakdown.max) * 100);
              const sharePct = lostBreakdown.totalLost > 0 ? Math.round((t.count / lostBreakdown.totalLost) * 100) : 0;
              return (
                <div key={t.reason} className="rounded-md border border-border bg-secondary/30 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium">{t.reason}</span>
                    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{t.count}</span>
                  </div>
                  <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-destructive/70 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                    <span>{sharePct}% share</span>
                    <span>{formatMoney(t.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Filters */}
      <Card className="mb-3 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search deals or contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {OWNER_FILTERS.map((o) => (
              <FilterChip key={o} active={ownerFilter === o} onClick={() => setOwnerFilter(o)}>
                {o}
              </FilterChip>
            ))}
          </div>
          <div className="mx-1 h-5 w-px bg-border" />
          <div className="flex flex-wrap items-center gap-1.5">
            {VALUE_FILTERS.map((v) => (
              <FilterChip key={v} active={valueFilter === v} onClick={() => setValueFilter(v)}>
                {v}
              </FilterChip>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-8">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> More
          </Button>
          <div className="ml-auto flex h-8 items-center rounded-md border border-border bg-card p-0.5">
            <Button
              size="sm"
              variant={view === "board" ? "secondary" : "ghost"}
              className="h-7 px-2"
              onClick={() => setView("board")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              className="h-7 px-2"
              onClick={() => setView("list")}
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {view === "board" ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="-mx-6 h-[calc(100vh-22rem)] overflow-x-auto overflow-y-hidden px-6 pb-3">
            <div className="flex h-full min-w-max gap-3">
              {pipelineStages.map((stage) => {
                const stageDeals = filtered.filter((d) => d.stage === stage.id);
                const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);
                return (
                  <div key={stage.id} className="flex h-full w-[300px] shrink-0 flex-col">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${stageColor(stage.id)}`} />
                        <span className="text-sm font-semibold">{stage.name}</span>
                        <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">{stageDeals.length}</Badge>
                      </div>
                      <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {stageTotal >= 1000 ? `$${(stageTotal / 1000).toFixed(0)}k` : `$${stageTotal}`}
                      </span>
                    </div>

                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-lg border border-dashed p-2 transition-colors ${
                            snapshot.isDraggingOver ? "border-primary/40 bg-primary-soft/40" : "border-border bg-secondary/30"
                          }`}
                        >
                          {stageDeals.map((deal, idx) => (
                            <Draggable key={deal.id} draggableId={deal.id} index={idx}>
                              {(prov, snap) => (
                                <Card
                                  ref={prov.innerRef}
                                  {...prov.draggableProps}
                                  {...prov.dragHandleProps}
                                  onClick={() => setSelected(deal)}
                                  className={`cursor-pointer p-3 transition-shadow ${snap.isDragging ? "rotate-1 shadow-[var(--shadow-elev-2)]" : "hover:shadow-[var(--shadow-elev-1)]"}`}
                                >
                                  <div className="mb-1.5 flex items-start justify-between gap-2">
                                    <div className={`text-[13px] font-medium leading-snug ${deal.lostReason ? "text-muted-foreground line-through" : ""}`}>
                                      {deal.name}
                                    </div>
                                    <div className="text-[13px] font-semibold tabular-nums">
                                      ${(deal.value / 1000).toFixed(1)}k
                                    </div>
                                  </div>
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="text-[11px] text-muted-foreground">{deal.contactName}</div>
                                    {deal.lostReason && (
                                      <Badge variant="outline" className="h-4 rounded border-destructive/30 bg-destructive/5 px-1 text-[9px] font-medium text-destructive">
                                        Lost · {deal.lostReason}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="mb-2 flex items-center gap-1.5">
                                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                                      <div
                                        className={`h-full rounded-full ${stageColor(deal.stage)}`}
                                        style={{ width: `${stageProgress(deal.stage)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] tabular-nums text-muted-foreground">
                                      {stageProgress(deal.stage)}%
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <Avatar className="h-5 w-5">
                                        <AvatarFallback className="bg-primary-soft text-[9px] font-medium text-primary">
                                          {deal.ownerInitials}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-[11px] text-muted-foreground">
                                        {formatExpectedClose(deal.expectedClose)}
                                      </span>
                                    </div>
                                    {deal.ageDays > 14 && (
                                      <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="h-3 w-3" />
                                        {deal.ageDays}d
                                      </span>
                                    )}
                                  </div>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {stageDeals.length === 0 && (
                            <div className="py-8 text-center text-[11px] text-muted-foreground">
                              Drag deals here
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-secondary/60 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2.5 pl-4 pr-4 text-left">Deal</th>
                  <th className="py-2.5 pr-4 text-left">Contact</th>
                  <th className="py-2.5 pr-4 text-left">Stage</th>
                  <th className="py-2.5 pr-4 text-right">Value</th>
                  <th className="py-2.5 pr-4 text-left">Owner</th>
                  <th className="py-2.5 pr-4 text-left">Expected close</th>
                  <th className="py-2.5 pr-4 text-left">Age</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No deals match your filters.</td></tr>
                )}
                {filtered.map((d) => (
                  <tr key={d.id} onClick={() => setSelected(d)} className="cursor-pointer border-b border-border hover:bg-secondary/40">
                    <td className="py-2.5 pl-4 pr-4 font-medium">{d.name}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{d.contactName}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="outline" className="h-5 rounded px-1.5 text-[10px]">
                        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${stageColor(d.stage)}`} />
                        {pipelineStages.find((s) => s.id === d.stage)?.name ?? d.stage}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{formatMoney(d.value)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{d.owner}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDateShort(d.expectedClose)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground tabular-nums">{d.ageDays}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <DealDetailDrawer
        deal={selected ? deals.find((d) => d.id === selected.id) ?? selected : null}
        onOpenChange={(o) => !o && setSelected(null)}
        onStageChange={handleStageChange}
        onMarkLost={handleMarkLost}
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
      className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary/30 bg-primary-soft text-primary"
          : "border-border bg-background text-muted-foreground hover:bg-secondary/60"
      }`}
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
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    muted: "bg-secondary text-muted-foreground",
  }[tone];
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${toneClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function formatExpectedClose(value: string) {
  const target = utcDayTimestamp(new Date(value));
  const today = utcDayTimestamp(new Date());
  const diffDays = Math.max(0, Math.round((target - today) / 86_400_000));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "in 1 day";
  if (diffDays < 30) return `in ${diffDays} days`;

  const months = Math.round(diffDays / 30);
  return months === 1 ? "in 1 month" : `in ${months} months`;
}

function utcDayTimestamp(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function stageColor(id: string) {
  const map: Record<string, string> = {
    new: "bg-muted-foreground",
    qualified: "bg-primary",
    "site-visit": "bg-chart-2",
    proposal: "bg-warning",
    negotiation: "bg-chart-5",
    won: "bg-success",
    lost: "bg-destructive",
  };
  return map[id] ?? "bg-muted-foreground";
}

function stageProgress(id: string) {
  const map: Record<string, number> = {
    new: 10,
    qualified: 30,
    "site-visit": 50,
    proposal: 70,
    negotiation: 85,
    won: 100,
    lost: 100,
  };
  return map[id] ?? 0;
}
