// src/routes/auth.callback.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Eye, EyeOff, Phone, User, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/auth-layout";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

type Stage = "loading" | "setup" | "done" | "error";

function AuthCallback() {
  const navigate = useNavigate();
  const [stage, setStage]             = useState<Stage>("loading");
  const [errorMsg, setErrorMsg]       = useState("");
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [phone, setPhone]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving]           = useState(false);

  function fmtPhone(raw: string) {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      // Sign out any existing session so the invite hash token takes over cleanly
      await supabase.auth.signOut();

      // Supabase processes the #access_token hash and fires SIGNED_IN
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
            const meta     = session.user.user_metadata ?? {};
            const invited  = ((meta.invited_name as string) ?? "").trim();
            const fn       = (meta.first_name as string) ?? "";
            const ln       = (meta.last_name  as string) ?? "";

            // Prefer first_name/last_name from metadata, fall back to invited_name
            if (fn || ln) {
              setFirstName(fn);
              setLastName(ln);
            } else if (invited) {
              const parts = invited.split(" ");
              setFirstName(parts[0] ?? "");
              setLastName(parts.slice(1).join(" ") ?? "");
            }

            setStage("setup");
            unsubscribe?.();
          }
        }
      );
      unsubscribe = () => subscription.unsubscribe();

      // Timeout: if no session after 6s, show error
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setErrorMsg("Invalid or expired invite link. Please ask to be re-invited.");
          setStage("error");
          unsubscribe?.();
        }
      }, 6000);
    };

    init();
    return () => unsubscribe?.();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim())   { toast.error("First name is required"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }

    setSaving(true);

    // 1. Set password + update metadata
    const { error: updateErr } = await supabase.auth.updateUser({
      password,
      data: {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        full_name:  `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone:      phone.trim() || null,
      },
    });

    if (updateErr) {
      toast.error("Failed to set password: " + updateErr.message);
      setSaving(false);
      return;
    }

    // 2. Get fresh session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const meta  = session.user.user_metadata ?? {};
      const orgId = meta.org_id as string | undefined;
      const role  = (meta.role  as string | undefined) ?? "viewer";
      const invId = meta.invitation_id as string | undefined;

      // 3. Upsert profile
      await supabase.from("profiles").upsert({
        id:         session.user.id,
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email:      session.user.email,
        phone:      phone.trim() || null,
        ...(orgId ? { organization_id: orgId } : {}),
      }, { onConflict: "id" });

      if (orgId) {
        // 4. Mark invitation accepted
        if (invId) {
          await supabase.from("invitations")
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("id", invId);
        } else {
          await supabase.from("invitations")
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("email", session.user.email ?? "")
            .eq("organization_id", orgId)
            .eq("status", "pending");
        }

        // 5. Add to org_memberships
        await supabase.from("org_memberships").upsert({
          member_id: session.user.id,
          org_id:    orgId,
          role,
        }, { onConflict: "member_id,org_id" });
      }

      // 6. Set phone on auth row via admin function
      if (phone.trim()) {
        fetch("/.netlify/functions/update-user", {
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
        }).catch(err => console.error("[callback] update-user failed:", err));
      }
    }

    setSaving(false);
    setStage("done");
    setTimeout(() => navigate({ to: "/" }), 2000);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <AuthLayout title="" subtitle="">
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Verifying your invite link…</p>
        </div>
      </AuthLayout>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <AuthLayout title="Link expired" subtitle="This invite link is no longer valid.">
        <div className="space-y-4">
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMsg}
          </div>
          <Button type="button"
            className="h-11 w-full bg-foreground text-background hover:bg-foreground/90"
            onClick={() => navigate({ to: "/signin" })}>
            Back to sign in
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <AuthLayout title="You're all set!" subtitle="Redirecting you to the dashboard…">
        <div className="flex justify-center py-8">
          <CheckCircle2 className="h-14 w-14 text-green-500" />
        </div>
      </AuthLayout>
    );
  }

  // ── Setup form ────────────────────────────────────────────────────────────
  return (
    <AuthLayout
      title="Set up your account"
      subtitle="Complete your profile to join your team on RenoMeta Connect."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="size-3.5" /> First name
            </Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="John" className="h-11 bg-primary-soft/50" required />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="size-3.5" /> Last name
            </Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Smith" className="h-11 bg-primary-soft/50" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Phone className="size-3.5" /> Phone number
          </Label>
          <Input value={phone} onChange={e => setPhone(fmtPhone(e.target.value))}
            placeholder="555-123-4567" inputMode="tel" className="h-11 bg-primary-soft/50" />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" /> Password
          </Label>
          <div className="relative">
            <Input type={showPw ? "text" : "password"} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters" className="h-11 bg-primary-soft/50 pr-10" required />
            <button type="button" onClick={() => setShowPw(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground">
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" /> Confirm password
          </Label>
          <div className="relative">
            <Input type={showConfirm ? "text" : "password"} value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password" className="h-11 bg-primary-soft/50 pr-10" required />
            <button type="button" onClick={() => setShowConfirm(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground">
              {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" disabled={saving}
          className="h-11 w-full bg-foreground text-background hover:bg-foreground/90">
          {saving
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</>
            : "Create account & join team"}
        </Button>
      </form>
    </AuthLayout>
  );
}