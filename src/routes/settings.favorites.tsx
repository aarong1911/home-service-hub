import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pin, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FAVORITE_CATALOG,
  MAX_FAVORITES,
  setFavorites,
  toggleFavorite,
  useFavorites,
} from "@/lib/favorites";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/favorites")({
  component: FavoritesSettings,
});

function FavoritesSettings() {
  const favs = useFavorites();
  const grouped = useMemo(() => {
    const g = new Map<string, typeof FAVORITE_CATALOG>();
    for (const opt of FAVORITE_CATALOG) {
      if (!g.has(opt.group)) g.set(opt.group, []);
      g.get(opt.group)!.push(opt);
    }
    return Array.from(g.entries());
  }, []);

  const selected = favs
    .map((to) => FAVORITE_CATALOG.find((o) => o.to === to))
    .filter((x): x is (typeof FAVORITE_CATALOG)[number] => !!x);

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Pin className="h-4 w-4" /> Sidebar Favorites
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pin up to {MAX_FAVORITES} shortcuts to the top of your sidebar for quick access.
          </p>
        </div>
        {favs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFavorites([]);
              toast.success("Favorites cleared");
            }}
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="mb-6 rounded-md border border-dashed p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Current favorites ({favs.length}/{MAX_FAVORITES})
        </div>
        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No favorites pinned yet. Select up to {MAX_FAVORITES} below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map((opt) => {
              const Icon = opt.icon;
              return (
                <Badge
                  key={opt.to}
                  variant="secondary"
                  className="gap-1.5 pr-1 text-xs"
                >
                  <Icon className="h-3 w-3" />
                  {opt.label}
                  <button
                    type="button"
                    onClick={() => toggleFavorite(opt.to)}
                    className="ml-0.5 rounded p-0.5 hover:bg-muted"
                    aria-label={`Remove ${opt.label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {grouped.map(([group, items]) => (
          <div key={group}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {items.map((opt) => {
                const Icon = opt.icon;
                const isFav = favs.includes(opt.to);
                const disabled = !isFav && favs.length >= MAX_FAVORITES;
                return (
                  <button
                    key={opt.to}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      toggleFavorite(opt.to);
                      if (!isFav) toast.success(`Pinned ${opt.label}`);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      isFav
                        ? "border-primary/40 bg-primary-soft text-primary"
                        : "border-border hover:bg-secondary",
                      disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{opt.label}</span>
                    </span>
                    {isFav && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}