import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/settings/team")({
  component: TeamSettings,
});

const team = [
  { name: "Alex Romero", email: "alex@renometa.com", role: "Owner", initials: "AR" },
  { name: "Priya Shah", email: "priya@renometa.com", role: "Admin", initials: "PS" },
  { name: "Jamal Burke", email: "jamal@renometa.com", role: "Project Manager", initials: "JB" },
  { name: "Mei Lin", email: "mei@renometa.com", role: "Sales", initials: "ML" },
  { name: "Sara Holt", email: "sara@renometa.com", role: "Bookkeeper", initials: "SH" },
];

function TeamSettings() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">Team & Roles</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{team.length} members in this workspace</p>
        </div>
        <Button size="sm" className="h-8"><Plus className="mr-1.5 h-3.5 w-3.5" /> Invite member</Button>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Member</th>
            <th className="px-4 py-2 text-left font-medium">Role</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {team.map((m) => (
            <tr key={m.email} className="h-12 border-b border-border last:border-b-0">
              <td className="px-4">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary-soft text-[10px] font-medium text-primary">{m.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4">
                <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">{m.role}</Badge>
              </td>
              <td className="px-4 text-right">
                <Button variant="ghost" size="sm" className="h-7 text-xs">Manage</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
