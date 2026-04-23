import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link2, Search, Plug, CheckCircle2, Circle } from "lucide-react";
import { INTEGRATIONS, CATEGORIES, type Integration, type CategoryId } from "@/lib/integrations-data";
import { IntegrationConfigDrawer } from "@/components/integrations/integration-config-drawer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings/integrations")({
  component: IntegrationsSettings,
});

function IntegrationsSettings() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Integration | null>(null);

  const filtered = useMemo(() => {
    return INTEGRATIONS.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.vendor.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, category]);

  const total = INTEGRATIONS.length;
  const connectedCount = INTEGRATIONS.filter((i) => i.connected).length;
  const availableCount = total - connectedCount;

  const openDrawer = (i: Integration) => {
    setSelected(i);
    setDrawerOpen(true);
  };

  const actionLabel = (i: Integration) => {
    if (i.connected) return null;
    if (i.connectMethod === "oauth") return "Connect";
    if (i.connectMethod === "apikey") return "Configure";
    return "Get Started";
  };

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Plug className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{total}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Total Integrations</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none text-success">{connectedCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Connected</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Circle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none text-primary">{availableCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Available</p>
          </div>
        </Card>
      </div>

      {/* Search + category pills */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((i) => (
          <Card key={i.id} className="flex flex-col p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
                <Link2 className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold leading-tight">{i.name}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-5 shrink-0 rounded-full px-1.5 text-[10px]",
                      i.connected
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i.connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{i.vendor}</p>
              </div>
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{i.description}</p>

            <div className="mt-2 flex flex-wrap gap-1">
              {i.syncBadges.map((b) => (
                <span key={b} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {b}
                </span>
              ))}
            </div>

            {i.connected && i.automations && i.automations.length > 0 && (
              <div className="mt-3 rounded-md border border-border bg-muted/50 p-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Automations</p>
                <ul className="space-y-0.5">
                  {i.automations.map((a) => (
                    <li key={a} className="flex items-start gap-1.5 text-[11px] text-foreground">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto flex gap-2 pt-3">
              {i.connected ? (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openDrawer(i)}>Configure</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">Disconnect</Button>
                </>
              ) : (
                <Button size="sm" className="h-7 text-xs" onClick={() => openDrawer(i)}>
                  {actionLabel(i)}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No integrations found.
        </div>
      )}

      <IntegrationConfigDrawer
        integration={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
