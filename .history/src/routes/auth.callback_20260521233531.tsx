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
  validateSearch: (s: Record<string, unknown>) => ({
    token: (s.token as string) ?? "",
  }),
  component: AuthCallback,
});

type Stage = "loading" | "setup" | "done" | "error";

type Invitation = {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  organization_id: string;
};

function AuthCallback() {
  const navigate = useNavigate();
  const { token } = Route.useSearch();
  const [stage, setStage]             = useState<Stage>("loading");
  const [errorMsg, setErrorMsg]       = useState("");
  const [invitation, setInvitation]   = useState<Invitation | null>(null);
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
    if (!token) {
      setErrorMsg("No invitation token found. Please use the link from your email.");
      setStage("error");
      return;
    }

    // Load invitation details from DB using the token
    const load = async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, first_name, last_name, organization_id, expires_at, status")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg("Invalid invitation link. Please ask to be re-invited.");
        setStage("error");
        return;
      }

      if (data.status !== "pending") {
        setErrorMsg("This invitation has already been used.");
        setStage("error");
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setErrorMsg("This invitation has expired. Please ask to be re-invited.");
        setStage("error");
        return;
      }

      setInvitation(data as Invitation);
      setFirstName(data.first_name ?? "");
      setLastName(data.last_name ?? "");
      setStage("setup");
    };

    load();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim())   { toast.error("First name is required"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (!invitation)         { toast.error("Invitation not loaded"); return; }

    setSaving(true);

    // Call accept-invite function — creates auth user, adds to org
    const res = await fetch("/.netlify/functions/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        password,
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        phone:     phone.trim() || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Failed to create account");
      setSaving(false);
      return;
    }

    // Sign in with the newly created credentials
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email:    invitation.email,
      password,
    });

    if (signInErr) {
      toast.error("Account created but sign-in failed: " + signInErr.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setStage("done");
    setTimeout(() => navigate({ to: "/" }), 2000);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (stage === "loading") {
    return (
      <AuthLayout title="" subtitle="">
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Verifying your invitation…</p>
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