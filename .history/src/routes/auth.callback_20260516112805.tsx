// src/routes/auth.callback.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

type Stage = "loading" | "setup" | "done" | "error";

function AuthCallback() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [error, setError] = useState("");

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    // Supabase JS automatically exchanges the hash tokens on load.
    // Wait briefly for it to establish the session then check.
    const timer = setTimeout(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setError("Invalid or expired invite link. Please ask to be re-invited.");
        setStage("error");
        return;
      }

      // Pre-fill name from metadata if the inviter passed it
      const meta = session.user.user_metadata ?? {};
      if (meta.invited_name) {
        const parts = (meta.invited_name as string).trim().split(" ");
        setFirstName(parts[0] ?? "");
        setLastName(parts.slice(1).join(" ") ?? "");
      }

      setStage("setup");
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit() {
    if (!firstName.trim()) { toast.error("First name is required"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }

    setSaving(true);

    // 1. Set password + user metadata (display name, phone)
    const { error: updateErr } = await supabase.auth.updateUser({
      password,
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phone.trim() || null,
      },
    });

    if (updateErr) {
      toast.error("Failed to set password: " + updateErr.message);
      setSaving(false);
      return;
    }

    // 2. Update profiles table
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from("profiles").upsert({
        id: session.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: session.user.email,
        phone: phone.trim() || null,
      }, { onConflict: "id" });

      // 3. Mark invitation as accepted
      const orgId = session.user.user_metadata?.org_id;
      if (orgId) {
        await supabase
          .from("invitations")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("email", session.user.email ?? "")
          .eq("organization_id", orgId)
          .eq("status", "pending");

        // 4. Ensure org_memberships row exists
        const role = session.user.user_metadata?.role ?? "viewer";
        await supabase.from("org_memberships").upsert({
          member_id: session.user.id,
          org_id: orgId,
          role,
        }, { onConflict: "member_id,org_id" });

        // 5. Set organization_id on profile
        await supabase.from("profiles")
          .update({ organization_id: orgId })
          .eq("id", session.user.id);
      }
    }

    setSaving(false);
    setStage("done");

    setTimeout(() => navigate({ to: "/" }), 2000);
  }

  if (stage === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/signin" })}>
            Back to login
          </Button>
        </Card>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-lg font-semibold">You're all set!</h2>
          <p className="mt-1 text-sm text-muted-foreground">Redirecting you to the dashboard…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">Set up your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your profile to join your team on RenoMeta Connect
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First name *</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last name</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Phone number</Label>
            <Input
              value={phone}
              onChange={e => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                setPhone(d.length <= 3 ? d : d.length <= 6 ? `${d.slice(0,3)}-${d.slice(3)}` : `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`);
              }}
              placeholder="555-123-4567"
              inputMode="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Password *</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Confirm password *</Label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</>
              : "Create account & join team"}
          </Button>
        </div>
      </Card>
    </div>
  );
}