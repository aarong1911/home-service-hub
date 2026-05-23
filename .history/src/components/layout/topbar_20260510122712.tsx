// src/components/layout/topbar.tsx
import {
  Search, Bell, HelpCircle, Command as CommandIcon,
  Briefcase, FolderKanban, Users, Target,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command, CommandEmpty, CommandGroup, CommandItem, CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useOrganization, memberInitials } from "@/lib/organization";
import { signOut } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  label: string;
  sub: string;
  group: "contacts" | "deals" | "projects";
  href: string;
};

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (p?.organization_id) return p.organization_id;
  const { data: m } = await supabase.from("org_memberships").select("org_id").eq("member_id", user.id).maybeSingle();
  return m?.org_id ?? null;
}

async function globalSearch(query: string): Promise<SearchResult[]> {
  const orgId = await getOrgId();
  if (!orgId || !query.trim()) return [];

  const q = query.trim();

  const [{ data: contacts }, { data: deals }, { data: projects }] = await Promise.all([
    supabase.from("contacts").select("id, full_name, email, phone").eq("org_id", orgId)
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`).limit(5),
    supabase.from("deals").select("id, title, value, status").eq("org_id", orgId)
      .ilike("title", `%${q}%`).limit(5),
    supabase.from("projects").select("id, name, status, address").eq("org_id", orgId)
      .ilike("name", `%${q}%`).limit(5),
  ]);

  const results: SearchResult[] = [];

  for (const c of contacts ?? []) {
    results.push({ id: c.id, label: c.full_name, sub: c.email ?? c.phone ?? "", group: "contacts", href: `${ROUTES.CONTACTS}?contactId=${c.id}` });
  }
  for (const d of deals ?? []) {
    const val = d.value ? `$${Number(d.value).toLocaleString()}` : "";
    results.push({ id: d.id, label: d.title, sub: [d.status, val].filter(Boolean).join(" · "), group: "deals", href: ROUTES.PIPELINE });
  }
  for (const p of projects ?? []) {
    results.push({ id: p.id, label: p.name, sub: [p.status, p.address].filter(Boolean).join(" · "), group: "projects", href: ROUTES.PROJECTS });
  }

  return results;
}

const GROUP_ICONS = {
  contacts: Users,
  deals: Target,
  projects: Briefcase,
};

const GROUP_LABELS = {
  contacts: "Contacts",
  deals: "Deals",
  projects: "Projects",
};

export function Topbar() {
  const org = useOrganization();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [user, setUser] = useState<{ email: string; firstName: string; lastName: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const meta = authUser.user_metadata || {};
        setUser({ email: authUser.email || "", firstName: meta.first_name || meta.firstName || "", lastName: meta.last_name || meta.lastName || "" });
      }
    })();
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await globalSearch(q);
      setResults(res);
      setSearching(false);
    }, 250);
  }, []);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate({ to: result.href });
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.group] = acc[r.group] ?? []).push(r);
    return acc;
  }, {});

  const initials = user ? memberInitials(`${user.firstName} ${user.lastName}`.trim() || user.email) : "?";

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
      {/* Search trigger */}
      <div className="flex flex-1 items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="flex h-8 flex-1 max-w-xs items-center gap-2 rounded-md border border-input bg-secondary/60 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="hidden rounded bg-background px-1.5 py-0.5 text-[10px] font-medium shadow-sm border border-border sm:inline-flex items-center gap-0.5">
            <CommandIcon className="h-2.5 w-2.5" />K
          </kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShortcutsOpen(true)}>
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary-soft text-[10px] font-semibold text-primary">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">{user?.firstName || user?.email?.split("@")[0] || "Account"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium">{[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "My Account"}</div>
              <div className="text-xs font-normal text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: ROUTES.SETTINGS })}>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={signOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setQuery(""); setResults([]); } }}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="sr-only"><DialogTitle>Search</DialogTitle></DialogHeader>
          <Command shouldFilter={false}>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search contacts, deals, projects…"
                className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
              {searching && <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />}
            </div>
            <CommandList className="max-h-80 p-1">
              {!query && (
                <div className="py-6 text-center text-sm text-muted-foreground">Start typing to search…</div>
              )}
              {query && !searching && results.length === 0 && (
                <CommandEmpty>No results for "{query}"</CommandEmpty>
              )}
              {(["contacts","deals","projects"] as const).map(group => {
                const items = grouped[group];
                if (!items?.length) return null;
                const Icon = GROUP_ICONS[group];
                return (
                  <CommandGroup key={group} heading={GROUP_LABELS[group]}>
                    {items.map(r => (
                      <CommandItem key={r.id} onSelect={() => handleSelect(r)} className="flex items-center gap-2.5 py-2 cursor-pointer">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{r.label}</div>
                          {r.sub && <div className="truncate text-[11px] text-muted-foreground">{r.sub}</div>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Keyboard shortcuts */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Keyboard shortcuts</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            {[
              ["⌘K", "Global search"],
              ["⌘/", "Focus sidebar"],
              ["Esc", "Close dialog"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
                <span className="text-muted-foreground">{label}</span>
                <kbd className="rounded border border-border bg-background px-2 py-0.5 text-[11px] font-medium">{key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}