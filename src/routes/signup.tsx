import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthLayout, GoogleIcon, AppleIcon } from "@/components/auth/auth-layout";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — RenoMeta Connect" },
      {
        name: "description",
        content:
          "Start your free RenoMeta Connect workspace — CRM, projects, automation, and financials for renovation pros.",
      },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      toast.error("Fill in all fields to create your account.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Account created. Welcome to RenoMeta Connect!");
      navigate({ to: "/" });
    }, 700);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your workspace in less than a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/signin" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <User className="size-3.5" />
            Full name
          </Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Jordan Rivera"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 bg-primary-soft/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Mail className="size-3.5" />
            Work email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-primary-soft/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" />
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-primary-soft/50 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="mt-2 h-11 w-full gap-1.5 bg-foreground text-background hover:bg-foreground/90"
        >
          {submitting ? "Creating account…" : "Create account"}
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <div className="space-y-2.5">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-2.5 bg-card font-medium"
          onClick={() => toast.info("Google sign-up not yet wired up")}
        >
          <GoogleIcon className="size-4" />
          Sign up with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-2.5 bg-card font-medium"
          onClick={() => toast.info("Apple sign-up not yet wired up")}
        >
          <AppleIcon className="size-4" />
          Sign up with Apple
        </Button>
      </div>
    </AuthLayout>
  );
}