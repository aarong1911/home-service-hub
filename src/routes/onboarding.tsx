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
          "linear-gradient(135deg, #0f1724 0%, #16202e 50%, #1a2332 100%)",
      }}
    >
      {/* Subtle dot-pattern texture overlay */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.08) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at top, rgba(59, 130, 246, 0.08) 0%, transparent 60%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-10 sm:py-14">
        <header className="mb-8 flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="RenoMeta Connect"
            className="mb-4 h-12 w-auto object-contain"
          />
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 backdrop-blur">
            <Sparkles className="h-3 w-3 text-blue-300" aria-hidden />
            Workspace setup
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Let's get your workspace ready
          </h1>
          <p className="mt-2 max-w-lg text-sm text-slate-300">
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
            className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8"
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
            className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/40 sm:p-8"
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
              className="text-slate-300 hover:bg-white/10 hover:text-white"
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