import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Filter, ChevronDown, LayoutGrid, List, AlertTriangle } from "lucide-react";
import { mockDeals, pipelineStages, type Deal } from "@/lib/mock-data";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/sales/pipeline")({
  component: PipelinePage,
});

function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>(mockDeals);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    setDeals((prev) =>
      prev.map((d) => (d.id === draggableId ? { ...d, stage: destination.droppableId } : d)),
    );
  };

  const totalValue = deals.reduce((s, d) => s + d.value, 0);

  return (
    <>
      <PageHeader
        title="Sales Pipeline"
        subtitle={`${deals.length} active deals · $${totalValue.toLocaleString()} total`}
        breadcrumb={["CRM", "Pipeline"]}
        actions={
          <>
            <Button variant="outline" size="sm" className="h-8">
              Q4 Renovation Pipeline
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
            <div className="flex h-8 items-center rounded-md border border-border bg-card p-0.5">
              <Button size="sm" variant="secondary" className="h-7 px-2"><LayoutGrid className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" className="h-7 px-2"><List className="h-3.5 w-3.5" /></Button>
            </div>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="mr-1.5 h-3.5 w-3.5" /> Filter
            </Button>
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Deal
            </Button>
          </>
        }
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="-mx-6 overflow-x-scroll px-6 pb-4" style={{ scrollbarGutter: "stable" }}>
          <div className="flex min-w-max gap-3">
            {pipelineStages.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage.id);
              const stageTotal = stageDeals.reduce((s, d) => s + d.value, 0);
              return (
                <div key={stage.id} className="flex w-[300px] shrink-0 flex-col">
                  {/* Stage header */}
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${stageColor(stage.id)}`} />
                      <span className="text-sm font-semibold">{stage.name}</span>
                      <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">{stageDeals.length}</Badge>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      ${(stageTotal / 1000).toFixed(0)}k
                    </span>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex min-h-[400px] flex-1 flex-col gap-2 rounded-lg border border-dashed border-border p-2 transition-colors ${
                          snapshot.isDraggingOver ? "border-primary/40 bg-primary-soft/40" : "bg-secondary/30"
                        }`}
                      >
                        {stageDeals.map((deal, idx) => (
                          <Draggable key={deal.id} draggableId={deal.id} index={idx}>
                            {(prov, snap) => (
                              <Card
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                className={`p-3 transition-shadow ${snap.isDragging ? "shadow-[var(--shadow-elev-2)] rotate-1" : "hover:shadow-[var(--shadow-elev-1)]"}`}
                              >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <div className="text-[13px] font-medium leading-snug">{deal.name}</div>
                                  <div className="text-[13px] font-semibold tabular-nums text-foreground">
                                    ${(deal.value / 1000).toFixed(1)}k
                                  </div>
                                </div>
                                <div className="mb-2.5 text-[11px] text-muted-foreground">{deal.contactName}</div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="bg-primary-soft text-[9px] font-medium text-primary">
                                        {deal.ownerInitials}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-[11px] text-muted-foreground">
                                      {formatDistanceToNow(new Date(deal.expectedClose), { addSuffix: true })}
                                    </span>
                                  </div>
                                  {deal.ageDays > 14 && (
                                    <span className="flex items-center gap-1 text-[10px] font-medium text-warning">
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
    </>
  );
}

function stageColor(id: string) {
  const map: Record<string, string> = {
    new: "bg-muted-foreground",
    qualified: "bg-primary",
    "site-visit": "bg-chart-2",
    proposal: "bg-warning",
    negotiation: "bg-chart-5",
    won: "bg-success",
  };
  return map[id] ?? "bg-muted-foreground";
}
