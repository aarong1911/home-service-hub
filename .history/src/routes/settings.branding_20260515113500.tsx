// src/routes/settings.branding.tsx

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization, updateOrganization } from "@/lib/organization";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/settings/branding")({
  component: BrandingSettings,
});

const LOGO_KEY = "rm_org_logo";
const STORAGE_BUCKET = "org-assets";
const LOGO_FOLDER = "logos";

const PRESETS = [
  { name: "Indigo", hex: "#4F46E5" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Sky", hex: "#0EA5E9" },
  { name: "Slate", hex: "#475569" },
];

function isValidLogoUrl(value: string | null | undefined): value is string {
  return Boolean(
    value &&
      !value.startsWith("blob:") &&
      !value.startsWith("data:")
  );
}

async function getCurrentOrgId(): Promise<string | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("[branding] session error:", sessionError);
    toast.error("Could not verify your session");
    return null;
  }

  if (!session?.user) {
    toast.error("You must be signed in");
    return null;
  }

  const userId = session.user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[branding] profile lookup failed:", profileError);
  }

  if (profile?.organization_id) {
    return profile.organization_id;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("member_id", userId)
    .maybeSingle();

  if (membershipError) {
    console.error("[branding] membership lookup failed:", membershipError);
  }

  if (membership?.org_id) {
    return membership.org_id;
  }

  toast.error("Organization not found");
  return null;
}

async function uploadLogoToSupabase(
  file: File
): Promise<{ publicUrl: string; path: string } | null> {
  const orgId = await getCurrentOrgId();

  if (!orgId) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "png";

  const filePath = `${LOGO_FOLDER}/${orgId}/logo-${Date.now()}.${safeExt}`;

  console.log("[branding] uploading logo:", {
    bucket: STORAGE_BUCKET,
    path: filePath,
    type: file.type,
    size: file.size,
  });

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    console.error("[branding] storage upload failed:", uploadError);
    toast.error(uploadError.message || "Logo upload failed");
    return null;
  }

  console.log("[branding] upload success:", uploadData);

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  const publicUrl = data?.publicUrl ?? null;

  if (!publicUrl) {
    toast.error("Could not create logo URL");
    return null;
  }

  return {
    publicUrl,
    path: filePath,
  };
}

async function saveLogoToOrganization(params: {
  logoUrl: string | null;
  logoPath: string | null;
}): Promise<boolean> {
  const orgId = await getCurrentOrgId();

  if (!orgId) return false;

  const { error } = await supabase
    .from("organizations")
    .update({
      logo_url: params.logoUrl,
      logo_path: params.logoPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) {
    console.error("[branding] organization update failed:", error);
    toast.error(error.message || "Could not save logo to organization");
    return false;
  }

  return true;
}

async function loadSavedLogo(): Promise<string | null> {
  const orgId = await getCurrentOrgId();

  if (!orgId) return null;

  const { data, error } = await supabase
    .from("organizations")
    .select("logo_url")
    .eq("id", orgId)
    .maybeSingle();

  if (error) {
    console.error("[branding] load logo failed:", error);
    return null;
  }

  const savedLogoUrl = data?.logo_url ?? null;

  if (!isValidLogoUrl(savedLogoUrl)) {
    return null;
  }

  return savedLogoUrl;
}

function cacheLogoUrl(url: string | null) {
  try {
    if (isValidLogoUrl(url)) {
      localStorage.setItem(LOGO_KEY, url);
    } else {
      localStorage.removeItem(LOGO_KEY);
    }
  } catch {
    // ignore localStorage failures
  }

  window.dispatchEvent(new Event("org-updated"));
}

function BrandingSettings() {
  const org = useOrganization();

  const [accent, setAccent] = useState("#4F46E5");
  const [tagline, setTagline] = useState("Build smarter, finish faster.");
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(
    isValidLogoUrl(org.logoUrl) ? org.logoUrl : null
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const savedLogo = await loadSavedLogo();

      if (cancelled) return;

      if (savedLogo) {
        setLogoUrl(savedLogo);
        updateOrganization({ logoUrl: savedLogo });
        cacheLogoUrl(savedLogo);
        return;
      }

      if (!isValidLogoUrl(org.logoUrl)) {
        setLogoUrl(null);
        cacheLogoUrl(null);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setUploading(true);

    try {
      const uploaded = await uploadLogoToSupabase(file);

      if (!uploaded) return;

      const saved = await saveLogoToOrganization({
        logoUrl: uploaded.publicUrl,
        logoPath: uploaded.path,
      });

      if (!saved) return;

      setLogoUrl(uploaded.publicUrl);
      updateOrganization({ logoUrl: uploaded.publicUrl });
      cacheLogoUrl(uploaded.publicUrl);

      toast.success("Logo uploaded");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setRemoving(true);

    try {
      const saved = await saveLogoToOrganization({
        logoUrl: null,
        logoPath: null,
      });

      if (!saved) return;

      setLogoUrl(null);
      updateOrganization({ logoUrl: null });
      cacheLogoUrl(null);

      toast.success("Logo removed");
    } finally {
      setRemoving(false);
    }
  };

  const busy = uploading || removing;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-base font-semibold">Logo</h2>

        <p className="mt-0.5 text-xs text-muted-foreground">
          Used on estimates, invoices, and client portal
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-secondary/40">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-full w-full object-contain"
                onError={() => {
                  console.warn("[branding] logo preview failed:", logoUrl);
                  setLogoUrl(null);
                  cacheLogoUrl(null);
                }}
              />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          <label
            className={
              busy
                ? "pointer-events-none cursor-wait opacity-60"
                : "cursor-pointer"
            }
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={busy}
            />

            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-secondary">
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {logoUrl ? "Replace logo" : "Upload logo"}
            </span>
          </label>

          {logoUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleRemoveLogo}
              disabled={busy}
            >
              {removing ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Removing
                </span>
              ) : (
                "Remove"
              )}
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Accent color</h2>

        <p className="mt-0.5 text-xs text-muted-foreground">
          Applied to client-facing documents
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.hex}
              onClick={() => setAccent(p.hex)}
              className={
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition " +
                (accent === p.hex
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border hover:bg-secondary")
              }
            >
              <span
                className="h-4 w-4 rounded"
                style={{ backgroundColor: p.hex }}
              />

              {p.name}
            </button>
          ))}
        </div>

        <div className="mt-4 max-w-xs">
          <Label className="text-xs">Custom hex</Label>

          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="h-9 w-9 rounded-md border border-border"
              style={{ backgroundColor: accent }}
            />

            <Input
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-9 font-mono text-sm"
            />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold">Tagline</h2>

        <p className="mt-0.5 text-xs text-muted-foreground">
          Appears under your company name on documents
        </p>

        <Input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          className="mt-4 h-9 max-w-md"
        />
      </Card>

      <div className="flex justify-end">
        <Button
  size="sm"
  onClick={async () => {
    const savedLogo = await loadSavedLogo();

    if (savedLogo) {
      setLogoUrl(savedLogo);
      updateOrganization({ logoUrl: savedLogo });
      cacheLogoUrl(savedLogo);
    } else {
      setLogoUrl(null);
      updateOrganization({ logoUrl: null });
      cacheLogoUrl(null);
    }

    toast.success("Branding saved");
  }}
>
  Save changes
</Button>
      </div>
    </div>
  );
}