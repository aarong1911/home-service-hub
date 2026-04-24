import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthLayout, GoogleIcon, AppleIcon } from "@/components/auth/auth-layout";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in — RenoMeta Connect" },
      {
        name: "description",
        content:
          "Sign in to RenoMeta Connect — the AI command center for renovation and home-service businesses.",
      },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Enter your email and password to continue.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Welcome back");
      navigate({ to: "/" });
    }, 600);
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Let's get you to your command center."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Mail className="size-3.5" />
            Email
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
              autoComplete="current-password"
              placeholder="••••••••••"
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

        <div className="flex items-center justify-between pt-1">
          <Link to="/signin" className="text-sm text-primary hover:underline">
            Forgot password?
          </Link>
          <Button type="submit" disabled={submitting} className="h-10 gap-1.5 bg-foreground text-background hover:bg-foreground/90">
            {submitting ? "Signing in…" : "Log in"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
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
          onClick={() => toast.info("Google sign-in not yet wired up")}
        >
          <GoogleIcon className="size-4" />
          Log in with Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-2.5 bg-card font-medium"
          onClick={() => toast.info("Apple sign-in not yet wired up")}
        >
          <AppleIcon className="size-4" />
          Log in with Apple
        </Button>
      </div>
    </AuthLayout>
  );
}