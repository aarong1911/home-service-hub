import { Search, Bell, HelpCircle, ChevronDown, Command as CommandIcon, Briefcase, FolderKanban, Building2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandItem, CommandList,
} from "@/components/ui/command";
import { useOrganization, memberInitials } from "@/lib/organization";
import { mockContacts, mockDeals, mockProjects, mockCompanies } from "@/lib/mock-data";

export function Topbar() {
  const org = useOrganization();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+K shortcut — focus the inline search input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const limit = (arr: unknown[]) => arr.slice(0, 5);
    const contacts = limit(
      mockContacts.filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q)),
    ) as typeof mockContacts;
    const deals = limit(
      mockDeals.filter((d) => !q || d.name.toLowerCase().includes(q) || d.contactName.toLowerCase().includes(q)),
    ) as typeof mockDeals;
    const projects = limit(
      mockProjects.filter((p) => !q || p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)),
    ) as typeof mockProjects;
    const companies = limit(
      mockCompanies.filter((c) => !q || c.name.toLowerCase().includes(q)),
    ) as typeof mockCompanies;
    return { contacts, deals, projects, companies };
  }, [query]);

  const orgInitial = (org.companyName?.trim()?.[0] ?? "R").toUpperCase();

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      {/* Org switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-secondary">
            {org.logoUrl ? (
              <img
                src={org.logoUrl}
                alt={`${org.companyName} logo`}
                className="h-6 w-6 rounded object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">
                {orgInitial}
              </div>
            )}
            <span className="max-w-[180px] truncate">{org.companyName || "Workspace"}</span>
            <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px] font-medium">Pro</Badge>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
          <DropdownMenuItem>{org.companyName || "RenoMeta Builders"}</DropdownMenuItem>
          <DropdownMenuItem>Coastal Construction Co.</DropdownMenuItem>
          <DropdownMenuItem>Heritage Renovations</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>+ Create workspace</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Global search with autocomplete */}
      <div className="mx-auto flex w-full max-w-xl items-center">
        <Popover open={open && query.trim().length > 0} onOpenChange={(o) => { if (!o) setOpen(false); }}>
          <PopoverTrigger asChild>
            <div
              ref={triggerRef}
              className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors focus-within:border-border-strong hover:border-border-strong"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => { if (query.trim()) setOpen(true); }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); }
                }}
                placeholder="Search contacts, deals, projects…"
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
                aria-label="Search"
              />
              <kbd className="flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                <CommandIcon className="h-3 w-3" />K
              </kbd>
            </div>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            sideOffset={6}
            className="w-[--radix-popover-trigger-width] p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                {results.contacts.length > 0 && (
                  <CommandGroup heading="Contacts">
                    {results.contacts.map((c) => (
                      <CommandItem
                        key={`c-${c.id}`}
                        value={`contact-${c.id}-${c.name}`}
                        onSelect={() => {
                          setOpen(false);
                          setQuery("");
                          navigate({ to: "/contacts", search: { contactId: c.id } });
                        }}
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="bg-secondary text-[9px]">
                            {memberInitials(c.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{c.name}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">{c.company}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.deals.length > 0 && (
                  <CommandGroup heading="Deals">
                    {results.deals.map((d) => (
                      <CommandItem
                        key={`d-${d.id}`}
                        value={`deal-${d.id}-${d.name}`}
                        onSelect={() => {
                          setOpen(false);
                          navigate({ to: "/sales/pipeline" });
                        }}
                      >
                        <Briefcase className="text-muted-foreground" />
                        <span className="truncate">{d.name}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">{d.contactName}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.projects.length > 0 && (
                  <CommandGroup heading="Projects">
                    {results.projects.map((p) => (
                      <CommandItem
                        key={`p-${p.id}`}
                        value={`project-${p.id}-${p.name}`}
                        onSelect={() => {
                          setOpen(false);
                          navigate({ to: "/projects/$clientSlug", params: { clientSlug: p.slug } });
                        }}
                      >
                        <FolderKanban className="text-muted-foreground" />
                        <span className="truncate">{p.name}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">{p.client}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {results.companies.length > 0 && (
                  <CommandGroup heading="Companies">
                    {results.companies.map((c) => (
                      <CommandItem
                        key={`co-${c.id}`}
                        value={`company-${c.id}-${c.name}`}
                        onSelect={() => {
                          setOpen(false);
                          navigate({ to: "/companies" });
                        }}
                      >
                        <Building2 className="text-muted-foreground" />
                        <span className="truncate">{c.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" aria-label="Help" className="h-8 w-8">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-secondary">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-[11px] text-primary-foreground">AR</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="text-sm">Alex Romero</div>
              <div className="text-xs font-normal text-muted-foreground">alex@renometa.com</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Preferences</DropdownMenuItem>
            <DropdownMenuItem>Keyboard shortcuts</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
