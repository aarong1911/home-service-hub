import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Link2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Integration } from "@/lib/integrations-data";

interface Props {
  integration: Integration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IntegrationConfigDrawer({ integration, open, onOpenChange }: Props) {
  if (!integration) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
              <Link2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <SheetTitle className="text-base">{integration.name}</SheetTitle>
              <SheetDescription className="text-xs">{integration.vendor}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-1">
          <p className="text-sm text-muted-foreground">{integration.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {integration.syncBadges.map((b) => (
              <Badge key={b} variant="secondary" className="text-[10px] h-5 px-1.5 rounded-full">
                {b}
              </Badge>
            ))}
          </div>

          {integration.connectMethod === "oauth" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">
                Click below to securely connect your {integration.vendor} account via OAuth.
              </p>
              <Button className="w-full gap-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Connect with {integration.vendor}
              </Button>
            </div>
          )}

          {integration.connectMethod === "apikey" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">
                Enter your {integration.vendor} API credentials below.
              </p>
              {integration.name === "Twilio" ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Account SID</Label>
                    <Input placeholder="AC..." className="text-xs h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Auth Token</Label>
                    <Input type="password" placeholder="Enter auth token" className="text-xs h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone Number</Label>
                    <Input placeholder="+1..." className="text-xs h-8" />
                  </div>
                </>
              ) : integration.name === "Jotform" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key</Label>
                  <Input type="password" placeholder="Enter Jotform API key" className="text-xs h-8" />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">API Key</Label>
                    <Input type="password" placeholder="Enter API key" className="text-xs h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Secret Key</Label>
                    <Input type="password" placeholder="Enter secret key" className="text-xs h-8" />
                  </div>
                </>
              )}
              <Button className="w-full">Save Credentials</Button>
            </div>
          )}

          {integration.connectMethod === "link" && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">
                Use the webhook URL below in your {integration.vendor} settings, or follow the setup instructions.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`https://api.renometa.com/webhooks/${integration.id}`}
                    className="text-xs h-8 font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(`https://api.renometa.com/webhooks/${integration.id}`)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {integration.name === "Native Form (Embed)" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Embed Code</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`<iframe src="https://forms.renometa.com/embed/lead" />`}
                      className="text-xs h-8 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyToClipboard(`<iframe src="https://forms.renometa.com/embed/lead" />`)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <Button className="w-full">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Setup Guide
              </Button>
            </div>
          )}

          {integration.automations && integration.automations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Available Automations</p>
              <ul className="space-y-1">
                {integration.automations.map((a) => (
                  <li key={a} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}