import { Search, Bell, HelpCircle, ChevronDown, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function Topbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-4">
      {/* Org switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-secondary">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">
              R
            </div>
            <span>RenoMeta Builders</span>
            <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px] font-medium">Pro</Badge>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
          <DropdownMenuItem>RenoMeta Builders</DropdownMenuItem>
          <DropdownMenuItem>Coastal Construction Co.</DropdownMenuItem>
          <DropdownMenuItem>Heritage Renovations</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>+ Create workspace</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Global search */}
      <div className="mx-auto flex w-full max-w-xl items-center">
        <button
          className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-border-strong"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1">Search contacts, deals, projects…</span>
          <kbd className="flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
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
