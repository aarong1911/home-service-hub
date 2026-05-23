// Settings > Organization — wraps the shared OrganizationForm with the
// in-memory store so changes persist across routes during the session.
// Important: this file must NOT overwrite logoUrl/logoPath.
// Logo upload is handled only by settings.branding.tsx.

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { OrganizationForm } from "./organization-form";
import {
  getOrganization,
  updateOrganization,
  useOrganization,
  type Organization,
} from "@/lib/organization";
import { toast } from "sonner";

function isValidLogoUrl(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      !value.startsWith("blob:") &&
      !value.startsWith("data:")
  );
}

function preserveLogoFields(draft: Organization, stored: Organization): Organization {
  const currentLogo =
    isValidLogoUrl(stored.logoUrl) ? stored.logoUrl : null;

  return {
    ...draft,

    // Never allow Organization settings to save blob/data/empty logo values.
    // Branding page owns logo upload.
    logoUrl: currentLogo,
  };
}

export function OrganizationSettings() {
  const stored = useOrganization();

  const [draft, setDraft] = useState<Organization>(() => {
    const org = getOrganization();

    return {
      ...org,
      logoUrl: isValidLogoUrl(org.logoUrl) ? org.logoUrl : null,
    };
  });

  const [saving, setSaving] = useState(false);

  // Sync draft when the store hydrates from localStorage or changes externally,
  // but only while the user has no unsaved edits.
  const lastSyncedRef = useRef<string>(
    JSON.stringify({
      ...getOrganization(),
      logoUrl: isValidLogoUrl(getOrganization().logoUrl)
        ? getOrganization().logoUrl
        : null,
    })
  );

  useEffect(() => {
    const cleanStored: Organization = {
      ...stored,
      logoUrl: isValidLogoUrl(stored.logoUrl) ? stored.logoUrl : null,
    };

    const cleanDraft: Organization = {
      ...draft,
      logoUrl: isValidLogoUrl(draft.logoUrl) ? draft.logoUrl : null,
    };

    const storedStr = JSON.stringify(cleanStored);
    const draftStr = JSON.stringify(cleanDraft);

    if (storedStr === draftStr) {
      lastSyncedRef.current = storedStr;
      return;
    }

    // If draft matches the last synced snapshot, user hasn't edited —
    // adopt new stored value.
    if (draftStr === lastSyncedRef.current) {
      setDraft(cleanStored);
      lastSyncedRef.current = storedStr;
    }
  }, [stored, draft]);

  const safeDraft = preserveLogoFields(draft, stored);
  const dirty = JSON.stringify(safeDraft) !== JSON.stringify(stored);

  async function handleSave() {
    setSaving(true);

    try {
      await new Promise((r) => setTimeout(r, 300));

      const nextOrganization = preserveLogoFields(draft, getOrganization());

      updateOrganization(nextOrganization);

      // Notify topbar/branding to re-read safe org state.
      window.dispatchEvent(new Event("org-updated"));

      toast.success("Organization details saved");
    } finally {
      setSaving(false);
    }
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
        onChange={(nextDraft) => {
          setDraft({
            ...nextDraft,

            // Prevent OrganizationForm from injecting a temporary logo value.
            logoUrl: isValidLogoUrl(stored.logoUrl) ? stored.logoUrl : null,
          });
        }}
        onSubmit={handleSave}
        saving={saving}
        submitLabel="Save changes"
        secondaryAction={
          dirty
            ? {
                label: "Reset",
                onClick: () => {
                  const org = getOrganization();

                  setDraft({
                    ...org,
                    logoUrl: isValidLogoUrl(org.logoUrl) ? org.logoUrl : null,
                  });
                },
              }
            : undefined
        }
      />
    </Card>
  );
}