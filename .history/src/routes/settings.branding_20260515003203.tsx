import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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

const PRESETS = [
  { name: "Indigo", hex: "#4F46E5" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Sky", hex: "#0EA5E9" },
  { name: "Slate", hex: "#475569" },
];

async function uploadLogo(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) ?? null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function BrandingSettings() {
  const org = useOrganization();
  const [accent, setAccent] = useState("#4F46E5");
  const [tagline, setTagline] = useState("Build smarter, finish faster.");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    const url = await uploadLogo(file);
    setUploading(false);

    if (!url) {
      toast.error("Upload failed");
      return;
    }

    // 1. Update in-memory store + localStorage immediately so logo shows now
    updateOrganization({ logoUrl: url });

    // 2. Save directly to DB — don't rely on the background save in updateOrganization
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles").select("organization_id").eq("id", session.user.id).maybeSingle();
        const orgId = profile?.organization_id;
        if (orgId) {
          const { error } = await supabase
            .from("organizations").update({ logo_url: url }).eq("id", orgId);
          if (error) console.error("[branding] DB save failed:", error);
          // Realtime subscription in topbar will auto-update when DB changes — no manual dispatch needed
        }
      }
    } catch (err) {
      console.error("[branding] DB save error:", err);
    }

    toast.success("Logo updated");
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-base font-semibold">Logo</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used on estimates, invoices, and client portal
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-secondary/40">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <label className={uploading ? "pointer-events-none cursor-wait opacity-60" : "cursor-pointer"}>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-secondary">
              {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {org.logoUrl ? "Replace logo" : "Upload logo"}
            </span>
          </label>
          {org.logoUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                updateOrganization({ logoUrl: null });
                toast.success("Logo removed");
              }}
            >
              Remove
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
              <span className="h-4 w-4 rounded" style={{ backgroundColor: p.hex }} />
              {p.name}
            </button>
          ))}
        </div>
        <div className="mt-4 max-w-xs">
          <Label className="text-xs">Custom hex</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-9 w-9 rounded-md border border-border" style={{ backgroundColor: accent }} />
            <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 font-mono text-sm" />
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
        <Button size="sm" onClick={() => toast.success("Branding saved")}>
          Save changes
        </Button>
      </div>
    </div>
  );
}