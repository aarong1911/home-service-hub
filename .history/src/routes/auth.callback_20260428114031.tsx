// src/routes/auth.callback.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getOrgProfile } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase handles the token exchange from the URL hash automatically
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (!session) {
          // Try to exchange the code/token from URL
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (exchangeError) {
            setError(exchangeError.message);
            return;
          }
        }

        // Check if this is a password recovery
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const type = params.get("type") || hashParams.get("type");

        if (type === "recovery") {
          // Redirect to a password update page or show password update form
          // For now, redirect to dashboard — user can change password in settings
          navigate({ to: "/" });
          return;
        }

        // Check onboarding status and redirect
        const orgProfile = await getOrgProfile();
        if (!orgProfile || !orgProfile.organizationId || !orgProfile.onboardingComplete) {
          navigate({ to: "/onboarding" });
        } else {
          navigate({ to: "/" });
        }
      } catch (err: any) {
        setError(err?.message || "Authentication failed");
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Authentication error
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate({ to: "/signin" })}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Completing sign in…
        </p>
      </div>
    </div>
  );
}