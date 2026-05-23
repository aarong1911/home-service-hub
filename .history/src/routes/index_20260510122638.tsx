// src/routes/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Target, Briefcase, Phone, Calendar, ArrowUpRight,
  Plus, TrendingUp, Clock, CheckCircle2, Mic,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/lib/organization";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/")({ component: DashboardPage });

type KpiData = {
  contacts: number;
  openDeals: number;
  dealValue: number;
  activeProjects: number;
  upcomingAppointments: number;
  callsToday: number;
};

type ActivityItem = {
  id: string;
  type: "call" | "lead" | "deal" | "appointment";
  title: string;
  subtitle: string;
  at: string;
};

type UpcomingAppt = {
  id: string;
  contact_name: string;
  service: string;
  scheduled_at: string;
  address: string | null;
};

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (p?.organization_id) return p.organization_id;
  const { data: m } = await supabase.from("org_memberships").select("org_id").eq("member_id", user.id).maybeSingle();
  return m?.org_id ?? null;
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function DashboardPage() {
  const org = useOrganization();
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingAppt[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");

  useEffect(() => {
    (async () => {
      const orgId = await getOrgId();
      if (!orgId) { setLoading(false); return; }

      // Fetch user name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
        if (profile?.first_name) setUserName(profile.first_name);
      }

      const now = new Date().toISOString();
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);

      const [
        { count: contactsCount },
        { data: dealsData },
        { count: projectsCount },
        { count: apptCount },
        { count: callsCount },
      ] = await Promise.all([
        supabase.from("contacts").select("*", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("deals").select("value").eq("org_id", orgId).eq("status", "open"),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("org_id", orgId).gte("scheduled_at", now).neq("status", "cancelled"),
        supabase.from("voice_calls").select("*", { count: "exact", head: true }).eq("tenant_id", orgId).gte("started_at", todayStart.toISOString()),
      ]);

      const dealValue = (dealsData ?? []).reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);

      setKpis({
        contacts: contactsCount ?? 0,
        openDeals: dealsData?.length ?? 0,
        dealValue,
        activeProjects: projectsCount ?? 0,
        upcomingAppointments: apptCount ?? 0,
        callsToday: callsCount ?? 0,
      });

      // Recent activity
      const [
        { data: recentCalls },
        { data: recentLeads },
        { data: recentAppts },
      ] = await Promise.all([
        supabase.from("voice_calls").select("id, started_at, caller_number, summary, direction").eq("tenant_id", orgId).order("started_at", { ascending: false }).limit(4),
        supabase.from("leads").select("id, created_at, source, custom_fields, contacts!contact_id(full_name)").eq("org_id", orgId).order("created_at", { ascending: false }).limit(3),
        supabase.from("appointments").select("id, scheduled_at, service, contact_name").eq("org_id", orgId).gte("scheduled_at", now).order("scheduled_at", { ascending: true }).limit(4),
      ]);

      const items: ActivityItem[] = [];

      for (const c of recentCalls ?? []) {
        items.push({
          id: `call-${c.id}`,
          type: "call",
          title: `${c.direction === "outbound" ? "Outbound" : "Inbound"} call`,
          subtitle: c.summary ?? c.caller_number ?? "Voice call",
          at: c.started_at,
        });
      }

      for (const l of recentLeads ?? []) {
        const name = (l as any).contacts?.full_name ?? "New lead";
        items.push({
          id: `lead-${l.id}`,
          type: "lead",
          title: `Lead captured — ${name}`,
          subtitle: `Source: ${l.source ?? "—"} · ${(l as any).custom_fields?.service ?? ""}`,
          at: l.created_at,
        });
      }

      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setActivity(items.slice(0, 6));

      setUpcoming((recentAppts ?? []).map((a: any) => ({
        id: a.id,
        contact_name: a.contact_name,
        service: a.service,
        scheduled_at: a.scheduled_at,
        address: null,
      })));

      setLoading(false);
    })();
  }, []);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <PageHeader
        title={`Welcome back, ${userName}`}
        subtitle={`${today} — here's what's happening at ${org.name}.`}
        actions={
          <>
            <Link to={ROUTES.LEADS}><Button variant="outline" size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> New Lead</Button></Link>
            <Link to={ROUTES.PIPELINE}><Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> New Deal</Button></Link>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {loading ? Array.from({length:6}).map((_,i) => (
          <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
        )) : kpis && [
          { label: "Contacts", value: kpis.contacts, icon: Users, href: ROUTES.CONTACTS, color: "text-sky-600 bg-sky-500/10" },
          { label: "Open Deals", value: kpis.openDeals, sub: formatMoney(kpis.dealValue), icon: Target, href: ROUTES.PIPELINE, color: "text-violet-600 bg-violet-500/10" },
          { label: "Active Projects", value: kpis.activeProjects, icon: Briefcase, href: ROUTES.PROJECTS, color: "text-amber-600 bg-amber-500/10" },
          { label: "Upcoming Appts", value: kpis.upcomingAppointments, icon: Calendar, href: ROUTES.CALENDAR, color: "text-success bg-success/10" },
          { label: "Calls Today", value: kpis.callsToday, icon: Phone, href: ROUTES.CALL_LOGS, color: "text-primary bg-primary/10" },
          { label: "Pipeline Value", value: formatMoney(kpis.dealValue), icon: TrendingUp, href: ROUTES.PIPELINE, color: "text-emerald-600 bg-emerald-500/10" },
        ].map(k => (
          <Link key={k.label} to={k.href} className="group">
            <Card className="p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${k.color}`}>
                  <k.icon className="h-4 w-4" />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-3 text-xl font-semibold tabular-nums">{k.value}</div>
              {k.sub && <div className="text-xs text-muted-foreground">{k.sub}</div>}
              <div className="mt-0.5 text-xs text-muted-foreground">{k.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Recent activity */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold">Recent Activity</div>
              <Link to={ROUTES.CALL_LOGS}><Button variant="ghost" size="sm" className="h-7 text-xs">View all</Button></Link>
            </div>
            {loading ? (
              <div className="space-y-3">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : activity.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No recent activity yet.</div>
            ) : (
              <div className="space-y-0">
                {activity.map((item, i) => {
                  const isLast = i === activity.length - 1;
                  const Icon = item.type === "call" ? Phone : item.type === "lead" ? Users : item.type === "appointment" ? Calendar : TrendingUp;
                  const tone = item.type === "call" ? "bg-primary/10 text-primary" : item.type === "lead" ? "bg-success/10 text-success" : item.type === "appointment" ? "bg-amber-500/10 text-amber-600" : "bg-violet-500/10 text-violet-600";
                  return (
                    <div key={item.id} className="relative flex gap-3 pb-4">
                      {!isLast && <div className="absolute left-[15px] top-8 h-full w-px bg-border" />}
                      <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-background ${tone}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="truncate text-sm font-medium">{item.title}</div>
                          <div className="shrink-0 text-[11px] text-muted-foreground">{formatDistanceToNow(new Date(item.at), { addSuffix: true })}</div>
                        </div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.subtitle}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming appointments */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold">Upcoming</div>
              <Link to={ROUTES.CALENDAR}><Button variant="ghost" size="sm" className="h-7 text-xs">Calendar</Button></Link>
            </div>
            {loading ? (
              <div className="space-y-3">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : upcoming.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No upcoming appointments.</div>
            ) : (
              <div className="space-y-2">
                {upcoming.map(appt => {
                  const dt = new Date(appt.scheduled_at);
                  const dateLabel = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  const timeLabel = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                  return (
                    <div key={appt.id} className="rounded-md border border-border bg-secondary/30 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold">{appt.contact_name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{appt.service}</div>
                        </div>
                        <Badge variant="secondary" className="h-5 shrink-0 rounded px-1.5 text-[10px]">
                          <Clock className="mr-0.5 h-2.5 w-2.5" />{timeLabel}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{dateLabel}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Quick actions</div>
              <div className="grid grid-cols-2 gap-2">
                <Link to={ROUTES.AI_CENTER}><Button variant="outline" size="sm" className="h-8 w-full text-xs"><Mic className="h-3.5 w-3.5 mr-1" />Voice AI</Button></Link>
                <Link to={ROUTES.LEADS}><Button variant="outline" size="sm" className="h-8 w-full text-xs"><Plus className="h-3.5 w-3.5 mr-1" />New Lead</Button></Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}