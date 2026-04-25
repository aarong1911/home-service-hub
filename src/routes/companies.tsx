import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Building2, Plus, Search, Globe, Phone, Mail, MapPin, Star, TrendingUp,
  Users, Wallet, Hammer, Pencil, ExternalLink, MoreHorizontal,
} from "lucide-react";
import { mockCompanies, type Company, type CompanyType, type CompanyStatus } from "@/lib/mock-data";
import { formatMoney, formatDateShort } from "@/lib/format";
import { toast } from "sonner";

type CompaniesSearch = { companyId?: string };

export const Route = createFileRoute("/companies")({
  validateSearch: (raw: Record<string, unknown>): CompaniesSearch => ({
    companyId: typeof raw.companyId === "string" ? raw.companyId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Companies — RenoMeta" },
      { name: "description", content: "Builders, architects, designers, vendors, and subcontractors you work with." },
    ],
  }),
  component: CompaniesPage,
});

const SEGMENTS: Array<{ key: "All" | CompanyType; label: string }> = [
  { key: "All", label: "All" },
  { key: "Builder/GC", label: "Builders / GCs" },
  { key: "Architect", label: "Architects" },
  { key: "Designer", label: "Designers" },
  { key: "Vendor", label: "Vendors" },
  { key: "Subcontractor", label: "Subcontractors" },
];

const TYPE_TONE: Record<CompanyType, string> = {
  "Builder/GC": "bg-primary/10 text-primary",
  Architect: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Designer: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  Vendor: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Subcontractor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

const STATUS_TONE: Record<CompanyStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  prospect: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  inactive: "bg-muted text-muted-foreground",
};

function CompaniesPage() {
  const { companyId } = useSearch({ from: "/companies" });
  const navigate = useNavigate({ from: "/companies" });
  const [companies, setCompanies] = useState<Company[]>(mockCompanies);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"All" | CompanyType>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | CompanyStatus>("All");
  const [selected, setSelected] = useState<Company | null>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);

  // Deep-link: open the matching company drawer when ?companyId=... is present.
  useEffect(() => {
    if (companyId) {
      const found = companies.find((c) => c.id === companyId);
      if (found && found.id !== selected?.id) setSelected(found);
    } else if (selected) {
      setSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, companies]);

  const stats = useMemo(() => {
    const active = companies.filter((c) => c.status === "active");
    return {
      total: companies.length,
      active: active.length,
      pipeline: companies.reduce((s, c) => s + c.pipelineValue, 0),
      ytd: companies.reduce((s, c) => s + c.ytdRevenue, 0),
      contacts: companies.reduce((s, c) => s + c.contactsCount, 0),
    };
  }, [companies]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return companies.filter((c) => {
      if (segment !== "All" && c.type !== segment) return false;
      if (statusFilter !== "All" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [companies, search, segment, statusFilter]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { All: companies.length };
    SEGMENTS.forEach((s) => {
      if (s.key !== "All") counts[s.key] = companies.filter((c) => c.type === s.key).length;
    });
    return counts;
  }, [companies]);

  const handleSave = (next: Company, isNew: boolean) => {
    if (isNew) {
      setCompanies((prev) => [next, ...prev]);
      toast.success(`${next.name} added`);
    } else {
      setCompanies((prev) => prev.map((c) => (c.id === next.id ? next : c)));
      toast.success(`${next.name} updated`);
      if (selected?.id === next.id) setSelected(next);
    }
    setEditing(null);
    setCreating(false);
  };

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Builders, architects, designers, and trade partners"
        actions={
          <>
            <Button variant="outline" size="sm">
              Import
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New company
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard icon={Building2} label="Total companies" value={String(stats.total)} />
        <KpiCard icon={TrendingUp} label="Active accounts" value={String(stats.active)} tone="up" />
        <KpiCard icon={Wallet} label="Pipeline value" value={formatMoney(stats.pipeline)} />
        <KpiCard icon={Hammer} label="YTD revenue" value={formatMoney(stats.ytd)} />
        <KpiCard icon={Users} label="Linked contacts" value={String(stats.contacts)} />
      </div>

      {/* Segment chips */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
              (segment === s.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-secondary")
            }
          >
            {s.label}
            <span className={"rounded-full px-1.5 text-[10px] " + (segment === s.key ? "bg-primary-foreground/20" : "bg-muted")}>
              {segmentCounts[s.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="mb-3 p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies, cities, tags…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "All" | CompanyStatus)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {companies.length}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Company</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Open deals</TableHead>
              <TableHead className="text-right">Pipeline</TableHead>
              <TableHead className="text-right">YTD revenue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[1%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                onClick={() => navigate({ search: { companyId: c.id }, replace: true })}
              >
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-[11px] font-semibold">
                        {initials(c.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {c.rating.toFixed(1)} · {c.contactsCount} contacts
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={"font-normal " + TYPE_TONE[c.type]}>
                    {c.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.city}, {c.state}
                </TableCell>
                <TableCell className="text-sm">{c.owner}</TableCell>
                <TableCell className="text-right tabular-nums">{c.openDeals}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(c.pipelineValue)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(c.ytdRevenue)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={"font-normal capitalize " + STATUS_TONE[c.status]}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                  No companies match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <CompanyDetailSheet
        company={selected}
        onOpenChange={(o) => { if (!o) navigate({ search: { companyId: undefined }, replace: true }); }}
        onEdit={(c) => setEditing(c)}
      />

      <CompanyEditSheet
        open={creating || editing !== null}
        company={editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        onSave={handleSave}
      />
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
          {tone && (
            <div className={"mt-0.5 text-[11px] font-medium " + (tone === "up" ? "text-emerald-600" : "text-destructive")}>
              vs last quarter
            </div>
          )}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function CompanyDetailSheet({
  company,
  onOpenChange,
  onEdit,
}: {
  company: Company | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (c: Company) => void;
}) {
  return (
    <Sheet open={!!company} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {company && (
          <>
            <SheetHeader className="space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-secondary text-sm font-semibold">{initials(company.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg">{company.name}</SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="secondary" className={"font-normal " + TYPE_TONE[company.type]}>
                      {company.type}
                    </Badge>
                    <Badge variant="secondary" className={"font-normal capitalize " + STATUS_TONE[company.status]}>
                      {company.status}
                    </Badge>
                    <span className="text-xs">Founded {company.yearFounded} · {company.employees} employees</span>
                  </SheetDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => onEdit(company)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Contact strip */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border p-2 hover:bg-secondary">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{company.website.replace(/^https?:\/\//, "")}</span>
                  <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                </a>
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{company.city}, {company.state}</span>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{company.phone}</span>
                </div>
                <div className="flex items-center gap-2 rounded-md border p-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{company.email}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatBlock label="Open deals" value={String(company.openDeals)} />
                <StatBlock label="Pipeline" value={formatMoney(company.pipelineValue)} />
                <StatBlock label="Lifetime" value={formatMoney(company.lifetimeRevenue)} />
              </div>

              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts</TabsTrigger>
                  <TabsTrigger value="deals">Deals</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4 pt-3">
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</div>
                    <div className="flex flex-wrap gap-1.5">
                      {company.tags.map((t) => (
                        <Badge key={t} variant="outline" className="font-normal">{t}</Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</div>
                    <p className="text-sm leading-relaxed text-foreground/80">{company.notes}</p>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Field label="Owner" value={company.owner} />
                    <Field label="Rating" value={`${company.rating.toFixed(1)} ★`} />
                    <Field label="Created" value={formatDateShort(company.createdAt)} />
                    <Field label="Last activity" value={formatDateShort(company.lastActivity)} />
                  </div>
                </TabsContent>

                <TabsContent value="contacts" className="pt-3">
                  <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                    {company.contactsCount} linked contacts.{" "}
                    <Link to="/contacts" className="text-primary hover:underline">Open Contacts →</Link>
                  </div>
                </TabsContent>

                <TabsContent value="deals" className="pt-3">
                  <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                    {company.openDeals} open deals worth {formatMoney(company.pipelineValue)}.{" "}
                    <Link to="/sales/pipeline" className="text-primary hover:underline">Open Pipeline →</Link>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="pt-3">
                  <div className="space-y-2">
                    {[
                      { t: "Estimate sent", d: 2 },
                      { t: "Site visit logged", d: 7 },
                      { t: "New contact added", d: 14 },
                      { t: "Account created", d: 90 },
                    ].map((a, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
                        <span>{a.t}</span>
                        <span className="text-xs text-muted-foreground">{a.d}d ago</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function CompanyEditSheet({
  open,
  company,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  company: Company | null;
  onOpenChange: (open: boolean) => void;
  onSave: (c: Company, isNew: boolean) => void;
}) {
  const isNew = !company;
  const [draft, setDraft] = useState<Partial<Company>>({});

  // Reset draft when sheet opens
  const baseline = company ?? {
    name: "",
    type: "Builder/GC" as CompanyType,
    status: "prospect" as CompanyStatus,
    owner: "Maria Chen",
    city: "",
    state: "",
    website: "",
    phone: "",
    email: "",
    notes: "",
  };

  const v = { ...baseline, ...draft } as Company;

  const set = <K extends keyof Company>(k: K, val: Company[K]) =>
    setDraft((d) => ({ ...d, [k]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.name?.trim()) {
      toast.error("Company name is required");
      return;
    }
    const slug = (v.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const next: Company = {
      id: company?.id ?? `comp-${Date.now()}`,
      slug,
      name: v.name,
      type: v.type,
      status: v.status,
      owner: v.owner,
      city: v.city ?? "",
      state: v.state ?? "",
      website: v.website ?? "",
      phone: v.phone ?? "",
      email: v.email ?? "",
      employees: company?.employees ?? 1,
      yearFounded: company?.yearFounded ?? new Date().getFullYear(),
      rating: company?.rating ?? 0,
      tags: company?.tags ?? [],
      contactsCount: company?.contactsCount ?? 0,
      openDeals: company?.openDeals ?? 0,
      pipelineValue: company?.pipelineValue ?? 0,
      ytdRevenue: company?.ytdRevenue ?? 0,
      lifetimeRevenue: company?.lifetimeRevenue ?? 0,
      lastActivity: company?.lastActivity ?? new Date().toISOString(),
      createdAt: company?.createdAt ?? new Date().toISOString(),
      notes: v.notes ?? "",
      trades: company?.trades,
    };
    setDraft({});
    onSave(next, isNew);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setDraft({});
        onOpenChange(o);
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isNew ? "New company" : `Edit ${company?.name}`}</SheetTitle>
          <SheetDescription>
            {isNew ? "Add a builder, architect, designer, vendor, or sub." : "Update company details."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" value={v.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Acme Builders" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={v.type} onValueChange={(val) => set("type", val as CompanyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Builder/GC">Builder / GC</SelectItem>
                  <SelectItem value="Architect">Architect</SelectItem>
                  <SelectItem value="Designer">Designer</SelectItem>
                  <SelectItem value="Vendor">Vendor</SelectItem>
                  <SelectItem value="Subcontractor">Subcontractor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={v.status} onValueChange={(val) => set("status", val as CompanyStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={v.city ?? ""} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={v.state ?? ""} onChange={(e) => set("state", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={v.website ?? ""} onChange={(e) => set("website", e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={v.phone ?? ""} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(555) 123-4567" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={v.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Owner</Label>
            <Select value={v.owner} onValueChange={(val) => set("owner", val)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Maria Chen", "James Park", "Priya Shah", "David Liu"].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{isNew ? "Create company" : "Save changes"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
