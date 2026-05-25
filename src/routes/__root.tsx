// src/routes/__root.tsx
import { Outlet, Link, createRootRouteWithContext, useRouterState, useNavigate } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/layout/app-shell";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

interface RouterContext {
  queryClient: QueryClient;
}

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/signin", "/signup", "/forgot-password", "/auth/callback"];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-semibold tracking-tight">404</h1>
        <h2 className="mt-3 text-lg font-medium">Page not found</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading
  const [checked, setChecked] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  // Listen for auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setChecked(true);
    });

    // Subscribe to changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auth guard: redirect logic
  useEffect(() => {
    if (!checked) return; // still loading

    if (!session && !isPublicRoute) {
      // Not logged in, trying to access protected route → go to signin
      navigate({ to: "/signin" });
    } else if (session && pathname === "/signin") {
      // Already logged in, trying to access auth pages → go to dashboard
      navigate({ to: "/" });
    }
  }, [checked, session, pathname, isPublicRoute, navigate]);

  // Show loading spinner while checking auth
  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in on a protected route — don't render anything (redirect is happening)
  if (!session && !isPublicRoute) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={150}>
        <AppShell>
          <Outlet />
        </AppShell>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
