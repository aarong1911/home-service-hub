import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Eye, EyeOff, Phone, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

type Stage = "loading" | "setup" | "done" | "error";

function AuthCallback() {
  const navigate = useNavigate();
  const [stage, setStage]         = useState<Stage>("loading");
  const [errorMsg, setErrorMsg]   = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]       = useState(false);

  function fmtPhone(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }

  useEffect(() => {
    // Supabase JS auto-exchanges hash tokens; wait briefly then check session
    const timer = setTimeout(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setErrorMsg("Invalid or expired invite link. Please ask to be re-invited.");
        setStage("error");
        return;
      }
      // Pre-fill name from invite metadata if provided
      const meta = session.user.user_metadata ?? {};
      const invited = ((meta.invited_name as string) ?? "").trim();
      if (invited) {
        const parts = invited.split(" ");
        setFirstName(parts[0] ?? "");
        setLastName(parts.slice(1).join(" ") ?? "");
      }
      setStage("setup");
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) { toast.error("First name is required"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm)  { toast.error("Passwords don't match"); return; }

    setSaving(true);

    // 1. Set password + user metadata
    const { error: updateErr } = await supabase.auth.updateUser({
      password,
      data: {
        first_name:  firstName.trim(),
        last_name:   lastName.trim(),
        full_name:   `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone:       phone.trim() || null,
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
        id:         session.user.id,
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      session.user.email,
        phone:      phone.trim() || null,
      }, { onConflict: "id" });

      const orgId = session.user.user_metadata?.org_id;
      if (orgId) {
        // 3. Mark invitation accepted
        await supabase
          .from("invitations")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("email", session.user.email ?? "")
          .eq("organization_id", orgId)
          .eq("status", "pending");

        // 4. Ensure org_memberships row
        const role = session.user.user_metadata?.role ?? "viewer";
        await supabase.from("org_memberships").upsert({
          member_id: session.user.id,
          org_id:    orgId,
          role,
        }, { onConflict: "member_id,org_id" });

        // 5. Set organization_id on profile
        await supabase.from("profiles")
          .update({ organization_id: orgId })
          .eq("id", session.user.id);
      }

      // 6. Use admin function to set phone on auth.users row
      if (phone.trim()) {
        await fetch("/.netlify/functions/update-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            phone:     phone.trim(),
            firstName: firstName.trim(),
            lastName:  lastName.trim(),
          }),
        });
      }
    }

    setSaving(false);
    setStage("done");
    setTimeout(() => navigate({ to: "/" }), 2000);
  }

  // ── Loading ──
  if (stage === "loading") {
    return (
      <AuthLayout title="" subtitle="">
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    );
  }

  // ── Error ──
  if (stage === "error") {
    return (
      <AuthLayout title="Link expired" subtitle="This invite link is no longer valid.">
        <div className="space-y-4">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMsg}
          </div>
          <Button
            type="button"
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
            onClick={() => navigate({ to: "/signin" })}
          >
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // ── Done ──
  if (stage === "done") {
    return (
      <AuthLayout title="You're all set!" subtitle="Redirecting you to the dashboard…">
        <div className="flex justify-center py-8">
          <CheckCircle2 className="h-14 w-14 text-green-500" />
        </div>
      </AuthLayout>
    );
  }

  // ── Setup form ──
  return (
    <AuthLayout
      title="Set up your account"
      subtitle="Complete your profile to join your team on RenoMeta Connect."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="size-3.5" /> First name
            </Label>
            <Input
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="John"
              className="h-11 bg-primary-soft/50"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="size-3.5" /> Last name
            </Label>
            <Input
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Smith"
              className="h-11 bg-primary-soft/50"
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Phone className="size-3.5" /> Phone number
          </Label>
          <Input
            value={phone}
            onChange={e => setPhone(fmtPhone(e.target.value))}
            placeholder="555-123-4567"
            inputMode="tel"
            className="h-11 bg-primary-soft/50"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" /> Password
          </Label>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="h-11 bg-primary-soft/50 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" /> Confirm password
          </Label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="h-11 bg-primary-soft/50 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="h-11 w-full bg-foreground text-background hover:bg-foreground/90"
        >
          {saving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</>
            : "Create account & join team"}
        </Button>
      </form>
    </AuthLayout>
  );
}