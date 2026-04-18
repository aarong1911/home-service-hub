// Settings > Organization — wraps the shared OrganizationForm with the
// in-memory store so changes persist across routes during the session.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { OrganizationForm } from "./organization-form";
import {
  getOrganization,
  updateOrganization,
  useOrganization,
  type Organization,
} from "@/lib/organization";
import { toast } from "sonner";

export function OrganizationSettings() {
  const stored = useOrganization();
  const [draft, setDraft] = useState<Organization>(stored);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 300));
    updateOrganization(draft);
    setSaving(false);
    toast.success("Organization details saved");
  }

  return (
    <Card className="p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Organization</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Information shown on estimates, invoices, and client communications
        </p>
      </div>
      <OrganizationForm
        value={draft}
        onChange={setDraft}
        onSubmit={handleSave}
        saving={saving}
        submitLabel="Save changes"
        secondaryAction={
          dirty
            ? { label: "Reset", onClick: () => setDraft(getOrganization()) }
            : undefined
        }
      />
    </Card>
  );
}
