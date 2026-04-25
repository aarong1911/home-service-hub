import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrganizationForm } from "@/components/organization/organization-form";
import { TeamMembersManager } from "@/components/organization/team-members-manager";
import {
  type Organization,
  type TeamMember,
} from "@/lib/organization";
import logoUrl from "@/assets/renometa-connect-logo.png";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — RenoMeta Connect" },
      {
        name: "description",
        content:
          "Set up your RenoMeta Connect workspace: company details, branding, and team — all in one place.",
      },
      { property: "og:title", content: "Welcome — RenoMeta Connect" },
      {
        property: "og:description",
        content: "Set up your RenoMeta Connect workspace in minutes.",
      },
    ],
  }),
  component: OnboardingPage,
});

const EMPTY_ORG: Organization = {
  companyName: "",
  primaryPhone: "",
  website: "",
  industry: undefined,
  address: "",
  logoUrl: null,
  crmGoals: [],
  timezone: "America/Los_Angeles",
};

function OnboardingPage() {
  const navigate = useNavigate();
  const [org, setOrg] = useState<Organization>(EMPTY_ORG);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = (m: Omit<TeamMember, "id">) => {
    setTeam((t) => [...t, { ...m, id: `local-${Date.now()}` }]);
  };
  const handleUpdate = (id: string, patch: Partial<TeamMember>) => {
    setTeam((t) => t.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };
  const handleRemove = (id: string) => {
    setTeam((t) => t.filter((m) => m.id !== id));
  };

  const onFinish = () => {
    if (!org.companyName.trim()) {
      toast.error("Add your company name to continue.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Workspace ready");
      navigate({ to: "/" });
    }, 600);
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.97 0.025 250) 0%, oklch(0.94 0.045 240) 45%, oklch(0.92 0.06 225) 100%)",
      }}
    >
      {/* Ambient blobs (decorative) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-[oklch(0.65_0.22_262)]/35 blur-[110px]" />
        <div className="absolute -bottom-40 -right-40 h-[560px] w-[560px] rounded-full bg-[oklch(0.72_0.18_220)]/45 blur-[120px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-10 sm:py-14">
        <header className="mb-8 flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="RenoMeta Connect"
            className="mb-4 h-12 w-auto object-contain"
          />
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" aria-hidden />
            Workspace setup
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Let's get your workspace ready
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Tell us about your company and invite your team. You can change any
            of this later from Settings.
          </p>
        </header>

        <main className="space-y-6" aria-labelledby="onboarding-heading">
          <h2 id="onboarding-heading" className="sr-only">
            Onboarding form
          </h2>

          <section
            aria-labelledby="company-section"
            className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-elev-2 backdrop-blur-xl sm:p-8"
          >
            <header className="mb-5">
              <h3 id="company-section" className="text-base font-semibold">
                Company details
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Used across estimates, invoices, and customer communications.
              </p>
            </header>
            <OrganizationForm value={org} onChange={setOrg} hideActions />
          </section>

          <section
            aria-labelledby="team-section"
            className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-elev-2 backdrop-blur-xl sm:p-8"
          >
            <TeamMembersManager
              members={team}
              onAdd={handleAdd}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
              inviteMode
              title="Invite your team"
              subtitle="Send invites now or skip — you can add teammates anytime from Settings."
            />
          </section>

          <div className="flex items-center justify-between gap-3 pb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/" })}
            >
              Skip for now
            </Button>
            <Button onClick={onFinish} disabled={submitting} aria-busy={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <>
                  Finish setup
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}