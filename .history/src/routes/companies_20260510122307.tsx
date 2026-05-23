// src/routes/companies.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, Building2, Globe, Phone, Mail, MapPin, MoreHorizontal, Loader2, Edit, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/companies")({ component: CompaniesPage });

type Company = {
  id: string;
  org_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (p?.organization_id) return p.organization_id;
  const { data: m } = await supabase.from("org_memberships").select("org_id").eq("member_id", user.id).maybeSingle();
  return m?.org_id ?? null;
}

function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    const orgId = await getOrgId();
    if (!orgId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("companies").select("*").eq("org_id", orgId).order("name");
    if (error) { console.error("[companies]", error); setLoading(false); return; }
    setCompanies(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return companies;
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.industry ?? "").toLowerCase().includes(q) ||
      (c.city ?? "").toLowerCase().includes(q)
    );
  }, [companies, search]);

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success(`${name} deleted`);
    setSelected(null);
    load();
  };

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Manage contractor accounts and client organizations."
        breadcrumb={["CRM", "Companies"]}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Company
          </Button>
        }
      />

      {/* Stats */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total companies" value={companies.length} />
        <StatCard label="With website" value={companies.filter(c => c.website).length} />
        <StatCard label="With email" value={companies.filter(c => c.email).length} />
        <StatCard label="With phone" value={companies.filter(c => c.phone).length} />
      </div>

      {/* Search */}
      <Card className="mb-3 p-2.5">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search companies…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-sm" />
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2.5 pl-4 pr-3 text-left">Company</th>
              <th className="py-2.5 pr-4 text-left">Industry</th>
              <th className="py-2.5 pr-4 text-left">Location</th>
              <th className="py-2.5 pr-4 text-left">Contact</th>
              <th className="py-2.5 pr-4 text-left">Added</th>
              <th className="w-10 py-2.5 pr-3" />
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="py-3 pr-4"><Skeleton className="h-4 w-28" /></td>
                ))}
                <td />
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                {search ? "No companies match your search." : "No companies yet — add one to get started."}
              </td></tr>
            )}
            {!loading && filtered.map(c => (
              <tr key={c.id} onClick={() => setSelected(c)} className="cursor-pointer border-b border-border hover:bg-secondary/30">
                <td className="py-2.5 pl-4 pr-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary-soft text-[11px] font-semibold text-primary">
                        {c.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">{c.industry || "—"}</td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2">
                    {c.email && <a href={`mailto:${c.email}`} className="text-muted-foreground hover:text-foreground" onClick={e => e.stopPropagation()}><Mail className="h-3.5 w-3.5" /></a>}
                    {c.phone && <a href={`tel:${c.phone}`} className="text-muted-foreground hover:text-foreground" onClick={e => e.stopPropagation()}><Phone className="h-3.5 w-3.5" /></a>}
                    {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" onClick={e => e.stopPropagation()}><Globe className="h-3.5 w-3.5" /></a>}
                    {!c.email && !c.phone && !c.website && <span className="text-[11px] text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="py-2.5 pr-4 text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </td>
                <td className="py-2.5 pr-3" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelected(c)}><Edit className="mr-2 h-3.5 w-3.5" />View</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(c.id, c.name)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">{selected.name.slice(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-base">{selected.name}</SheetTitle>
                    <SheetDescription className="text-xs">{selected.industry || "No industry set"}</SheetDescription>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  {selected.email && <a href={`mailto:${selected.email}`} className="flex-1"><Button size="sm" variant="outline" className="w-full h-8"><Mail className="h-3.5 w-3.5 mr-1.5" />Email</Button></a>}
                  {selected.phone && <a href={`tel:${selected.phone}`} className="flex-1"><Button size="sm" variant="outline" className="w-full h-8"><Phone className="h-3.5 w-3.5 mr-1.5" />Call</Button></a>}
                </div>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                {selected.website && (
                  <div><div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Website</div>
                    <a href={selected.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline"><Globe className="h-3.5 w-3.5" />{selected.website}</a>
                  </div>
                )}
                {(selected.address || selected.city) && (
                  <div><div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Address</div>
                    <a href={`https://maps.google.com/?q=${encodeURIComponent([selected.address, selected.city, selected.state, selected.zip].filter(Boolean).join(", "))}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-muted-foreground hover:text-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{[selected.address, selected.city, selected.state, selected.zip].filter(Boolean).join(", ")}</span>
                    </a>
                  </div>
                )}
                {selected.notes && (
                  <div><div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Notes</div>
                    <p className="text-muted-foreground">{selected.notes}</p>
                  </div>
                )}
                <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                  Added {formatDistanceToNow(new Date(selected.created_at), { addSuffix: true })} · Updated {formatDistanceToNow(new Date(selected.updated_at), { addSuffix: true })}
                </div>
                <Button variant="destructive" size="sm" className="w-full" onClick={() => handleDelete(selected.id, selected.name)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete Company
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AddCompanyDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} />
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function AddCompanyDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", website: "", phone: "", email: "", address: "", city: "", state: "", notes: "" });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Company name is required"); return; }
    setSaving(true);
    const orgId = await getOrgId();
    if (!orgId) { toast.error("Could not determine organization"); setSaving(false); return; }
    const { error } = await supabase.from("companies").insert({
      org_id: orgId,
      name: form.name.trim(),
      industry: form.industry || null,
      website: form.website || null,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) { toast.error("Failed to save: " + error.message); return; }
    toast.success("Company added");
    setForm({ name: "", industry: "", website: "", phone: "", email: "", address: "", city: "", state: "", notes: "" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Company</DialogTitle><DialogDescription>Add a contractor or client company.</DialogDescription></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1"><Label className="text-xs">Company name *</Label><Input value={form.name} onChange={set("name")} placeholder="Acme Contractors" /></div>
            <div className="space-y-1"><Label className="text-xs">Industry</Label><Input value={form.industry} onChange={set("industry")} placeholder="General Contracting" /></div>
            <div className="space-y-1"><Label className="text-xs">Website</Label><Input value={form.website} onChange={set("website")} placeholder="https://acme.com" /></div>
            <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={set("phone")} placeholder="555-123-4567" /></div>
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={form.email} onChange={set("email")} placeholder="info@acme.com" /></div>
            <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={form.address} onChange={set("address")} placeholder="123 Main St" /></div>
            <div className="space-y-1"><Label className="text-xs">City</Label><Input value={form.city} onChange={set("city")} placeholder="Miami" /></div>
            <div className="col-span-2 space-y-1"><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Internal notes…" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Company"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}