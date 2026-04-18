import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/app-shell";
import {
  Building2, Users, Plug, CreditCard, Wand2, Palette, Key, Bell, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

const sections = [
  { to: "/settings", label: "Organization", icon: Building2, exact: true },
  { to: "/settings/team", label: "Team & Roles", icon: Users },
  { to: "/settings/integrations", label: "Integrations", icon: Plug },
  { to: "/settings/billing", label: "Plans & Billing", icon: CreditCard },
  { to: "/settings/templates", label: "Templates", icon: FileText },
  { to: "/settings/custom-fields", label: "Custom Fields", icon: Wand2 },
  { to: "/settings/branding", label: "Branding", icon: Palette },
  { to: "/settings/api-keys", label: "API Keys", icon: Key },
  { to: "/settings/notifications", label: "Notifications", icon: Bell },
];

function SettingsLayout() {
  const { pathname } = useLocation();
  const isRoot = pathname === "/settings" || pathname === "/settings/";

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your workspace, team, integrations, and billing" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-0.5">
          {sections.map((s) => {
            const active = s.exact ? isRoot : pathname.startsWith(s.to);
            const Icon = s.icon;
            return (
              <Link
                key={s.to}
                to={s.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </Link>
            );
          })}
        </nav>

        <div>{isRoot ? <OrganizationSettings /> : <Outlet />}</div>
      </div>
    </>
  );
}

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function OrganizationSettings() {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold">Organization</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Basic info about your workspace</p>
      </div>
      <div className="grid max-w-xl grid-cols-1 gap-4">
        <div>
          <Label className="text-xs" htmlFor="org-name">Organization name</Label>
          <Input id="org-name" defaultValue="RenoMeta Builders" className="mt-1.5 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs" htmlFor="org-domain">Workspace URL</Label>
          <Input id="org-domain" defaultValue="connect.renometa.com" className="mt-1.5 h-9 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs" htmlFor="org-tz">Timezone</Label>
            <Input id="org-tz" defaultValue="America/Los_Angeles" className="mt-1.5 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs" htmlFor="org-currency">Currency</Label>
            <Input id="org-currency" defaultValue="USD" className="mt-1.5 h-9 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" size="sm" className="h-8">Cancel</Button>
          <Button size="sm" className="h-8">Save changes</Button>
        </div>
      </div>
    </Card>
  );
}
