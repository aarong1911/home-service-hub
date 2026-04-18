import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financials")({
  component: FinancialsLayout,
});

const tabs = [
  { to: "/financials/estimates", label: "Estimates" },
  { to: "/financials/invoices", label: "Invoices" },
  { to: "/financials/payments", label: "Payments" },
  { to: "/financials/reports", label: "Reports" },
];

function FinancialsLayout() {
  const { pathname } = useLocation();
  const isRoot = pathname === "/financials" || pathname === "/financials/";

  return (
    <>
      <PageHeader
        title="Financials"
        subtitle="Estimates, invoices, payments, and reports"
        breadcrumb={["Financials"]}
        actions={
          <Button size="sm" className="h-8">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New
          </Button>
        }
      />

      <div className="mb-5 flex gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = pathname.startsWith(t.to) || (isRoot && t.to === "/financials/estimates");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {isRoot ? <FinancialsDefault /> : <Outlet />}
    </>
  );
}

function FinancialsDefault() {
  if (typeof window !== "undefined") {
    window.location.replace("/financials/estimates");
  }
  return null;
}
