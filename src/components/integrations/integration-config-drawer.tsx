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
import { useState, useCallback } from "react";
import type { Integration } from "@/lib/integrations-data";

interface Props {
  integration: Integration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect?: (integration: Integration) => void;
}

export function IntegrationConfigDrawer({ integration, open, onOpenChange, onConnect }: Props) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const updateField = useCallback((key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  const markTouched = useCallback((key: string) => {
    setTouched((t) => ({ ...t, [key]: true }));
  }, []);

  if (!integration) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  function getApiKeyFields(): { key: string; label: string; placeholder: string; type: string; minLength?: number; pattern?: RegExp; patternMsg?: string }[] {
    if (integration.name === "Twilio") {
      return [
        { key: "accountSid", label: "Account SID", placeholder: "AC...", type: "text", minLength: 34, pattern: /^AC[a-f0-9]{32}$/i, patternMsg: "Must start with AC followed by 32 hex characters" },
        { key: "authToken", label: "Auth Token", placeholder: "Enter auth token", type: "password", minLength: 32 },
        { key: "phoneNumber", label: "Phone Number", placeholder: "+1...", type: "text", minLength: 10, pattern: /^\+\d{10,15}$/, patternMsg: "Must be a valid phone number starting with +" },
      ];
    }
    if (integration.name === "Jotform") {
      return [{ key: "apiKey", label: "API Key", placeholder: "Enter Jotform API key", type: "password", minLength: 8 }];
    }
    return [
      { key: "apiKey", label: "API Key", placeholder: "Enter API key", type: "password", minLength: 8 },
      { key: "secretKey", label: "Secret Key", placeholder: "Enter secret key", type: "password", minLength: 8 },
    ];
  }

  function validateAndSave() {
    const fieldDefs = getApiKeyFields();
    const newErrors: Record<string, string> = {};
    const allTouched: Record<string, boolean> = {};

    for (const f of fieldDefs) {
      allTouched[f.key] = true;
      const val = (fields[f.key] ?? "").trim();
      if (!val) {
        newErrors[f.key] = `${f.label} is required`;
      } else if (f.minLength && val.length < f.minLength) {
        newErrors[f.key] = `Must be at least ${f.minLength} characters`;
      } else if (f.pattern && !f.pattern.test(val)) {
        newErrors[f.key] = f.patternMsg ?? "Invalid format";
      }
    }

    setTouched(allTouched);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    onConnect?.(integration);
    setFields({});
    setErrors({});
    setTouched({});
  }

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
              <Button className="w-full gap-2" onClick={() => onConnect?.(integration)}>
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
              {getApiKeyFields().map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type}
                    placeholder={f.placeholder}
                    className={`text-xs h-8 ${touched[f.key] && errors[f.key] ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    value={fields[f.key] ?? ""}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    onBlur={() => markTouched(f.key)}
                  />
                  {touched[f.key] && errors[f.key] && (
                    <p className="text-[11px] text-destructive">{errors[f.key]}</p>
                  )}
                </div>
              ))}
              <Button className="w-full" onClick={validateAndSave}>Save Credentials</Button>
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
              <Button className="w-full" onClick={() => onConnect?.(integration)}>
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