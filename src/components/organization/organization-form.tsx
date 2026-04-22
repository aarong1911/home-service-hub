// Reusable Organization details form. Shape matches the onboarding
// CompanyStep + BrandingStep so it can be embedded in either flow.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown, ImagePlus, Loader2 } from "lucide-react";
import {
  CRM_GOALS,
  INDUSTRIES,
  TIMEZONE_OPTIONS,
  guessTimezoneFromAddress,
  type Organization,
} from "@/lib/organization";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 10);
  if (digits.length <= 3) return p1;
  if (digits.length <= 6) return `(${p1}) ${p2}`;
  return `(${p1}) ${p2}-${p3}`;
}

export type OrganizationFormProps = {
  value: Organization;
  onChange: (next: Organization) => void;
  onSubmit?: () => void | Promise<void>;
  submitLabel?: string;
  saving?: boolean;
  /** Hide the submit row (e.g. when caller renders its own footer). */
  hideActions?: boolean;
  /** Optional secondary action (e.g. Cancel / Back). */
  secondaryAction?: { label: string; onClick: () => void };
};

export function OrganizationForm({
  value,
  onChange,
  onSubmit,
  submitLabel = "Save changes",
  saving,
  hideActions,
  secondaryAction,
}: OrganizationFormProps) {
  const set = <K extends keyof Organization>(k: K, v: Organization[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Company name">
          <Input
            value={value.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            placeholder="e.g. RenoMeta Builders"
          />
        </Field>

        <Field label="Primary phone">
          <Input
            value={value.primaryPhone}
            onChange={(e) => set("primaryPhone", formatPhone(e.target.value))}
            placeholder="(555) 555-5555"
            inputMode="tel"
          />
        </Field>

        <Field label="Website">
          <Input
            value={value.website}
            onChange={(e) => set("website", e.target.value)}
            placeholder="https://yourcompany.com"
          />
        </Field>

        <Field label="Industry">
          <Select
            value={value.industry ?? ""}
            onValueChange={(v) => set("industry", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Primary business address" className="md:col-span-2">
          <Input
            value={value.address}
            onChange={(e) => {
              const addr = e.target.value;
              set("address", addr);
              const tz = guessTimezoneFromAddress(addr);
              if (tz && tz !== value.timezone) set("timezone", tz);
            }}
            placeholder="Street, City, State"
          />
        </Field>

        <Field label="Timezone">
          <Select
            value={value.timezone}
            onValueChange={(v) => set("timezone", v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Primary CRM goals" className="md:col-span-2">
          <GoalsMultiSelect
            value={value.crmGoals}
            onChange={(next) => set("crmGoals", next)}
          />
        </Field>

        <Field label="Company logo" className="md:col-span-2">
          <LogoPicker
            value={value.logoUrl}
            onChange={(url) => set("logoUrl", url)}
          />
        </Field>
      </div>

      {!hideActions && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            {secondaryAction && (
              <Button variant="outline" size="sm" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
          <Button size="sm" onClick={() => onSubmit?.()} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : submitLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function GoalsMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    value.length === 0
      ? "Select CRM goals"
      : value.length === 1
        ? value[0]
        : `${value.length} selected`;

  const toggle = (g: string) => {
    onChange(value.includes(g) ? value.filter((v) => v !== g) : [...value, g]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between text-sm font-normal"
        >
          <span className={value.length ? "" : "text-muted-foreground"}>
            {label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-50 w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder="Search goals…" />
          <CommandList>
            <CommandEmpty>No goals found.</CommandEmpty>
            <CommandGroup>
              {CRM_GOALS.map((g) => {
                const selected = value.includes(g);
                return (
                  <CommandItem
                    key={g}
                    onSelect={() => toggle(g)}
                    className="cursor-pointer"
                  >
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded border">
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    {g}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex justify-end border-t p-2">
          <Button size="sm" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LogoPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-secondary/40">
        {value ? (
          <img src={value} alt="Logo preview" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <label className="cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onChange(URL.createObjectURL(file));
          }}
        />
        <span className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-secondary">
          {value ? "Replace logo" : "Upload logo"}
        </span>
      </label>
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => onChange(null)}
        >
          Remove
        </Button>
      )}
    </div>
  );
}
