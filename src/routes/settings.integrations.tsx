import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, FolderOpen, Phone, FileSignature, CreditCard } from "lucide-react";

export const Route = createFileRoute("/settings/integrations")({
  component: IntegrationsSettings,
});

const integrations = [
  { name: "Gmail", desc: "Sync email threads with contacts", icon: Mail, connected: true, syncedAt: "2 min ago" },
  { name: "Google Calendar", desc: "Two-way calendar sync for jobs and visits", icon: Calendar, connected: true, syncedAt: "5 min ago" },
  { name: "Google Drive", desc: "Attach project files from Drive", icon: FolderOpen, connected: false },
  { name: "Twilio", desc: "Send and receive SMS in the inbox", icon: Phone, connected: true, syncedAt: "1 hr ago" },
  { name: "DocuSign", desc: "E-signatures on estimates and contracts", icon: FileSignature, connected: false },
  { name: "Stripe", desc: "Accept card and ACH payments on invoices", icon: CreditCard, connected: true, syncedAt: "12 min ago" },
];

function IntegrationsSettings() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {integrations.map((i) => {
        const Icon = i.icon;
        return (
          <Card key={i.name} className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{i.name}</span>
                  {i.connected && (
                    <Badge variant="secondary" className="h-5 rounded bg-success/15 px-1.5 text-[10px] text-success">
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{i.desc}</p>
                {i.connected && (
                  <p className="mt-1 text-[10px] text-muted-foreground">Last synced {i.syncedAt}</p>
                )}
                <div className="mt-3 flex gap-2">
                  {i.connected ? (
                    <>
                      <Button variant="outline" size="sm" className="h-7 text-xs">Configure</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">Disconnect</Button>
                    </>
                  ) : (
                    <Button size="sm" className="h-7 text-xs">Connect</Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
