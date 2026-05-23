import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { inviteMember, removeMemberFromOrg } from "@/lib/team";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Info, Loader2, Mail, Phone, Pencil, MapPin, Shield, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  ALL_ROLES, ROLE_LABELS, memberInitials,
  type Role, type TeamMember, type WorkerType,
} from "@/lib/organization";

export type TeamMembersManagerProps = {
  members: TeamMember[];
  onAdd: (member: Omit<TeamMember, "id">) => void;
  onUpdate: (id: string, patch: Partial<TeamMember>) => void;
  onRemove: (id: string) => void;
  inviteMode?: boolean;
  title?: string;
  subtitle?: string;
};

function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// ── Full profile type ─────────────────────────────────────────────────────────

type FullProfile = {
  id: string; email: string; first_name: string | null; last_name: string | null;
  phone: string | null; address_line1: string | null; address_line2: string | null;
  city: string | null; state: string | null; postal_code: string | null;
  ssn: string | null; ein: string | null; company_name: string | null;
  worker_type: string | null;
};

// ── Email compose modal ───────────────────────────────────────────────────────

function EmailModal({ to, onClose }: { to: string; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body,    setBody]    = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { toast.error("Subject and message are required"); return; }
    setSending(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not authenticated"); setSending(false); return; }
    const res = await fetch("/.netlify/functions/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ to, subject: subject.trim(), body: body.trim() }),
    });
    setSending(false);
    if (res.ok) { toast.success(`Email sent to ${to}`); onClose(); }
    else { const d = await res.json(); toast.error(d.error ?? "Failed to send"); }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Send email to {to}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Subject</Label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject…" className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Message</Label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" rows={6} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSend} disabled={sending}>
          {sending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</> : "Send"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ── Member info + edit modal ──────────────────────────────────────────────────

function MemberInfoModal({
  member, onUpdate, onClose,
}: { member: TeamMember; onUpdate: (id: string, patch: Partial<TeamMember>) => void; onClose: () => void }) {
  const [profile, setProfile]   = useState<FullProfile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);

  // Edit state
  const [name,        setName]        = useState(member.name && member.name !== member.email ? member.name : "");
  const [phone,       setPhone]       = useState(member.phone ?? "");
  const [role,        setRole]        = useState<Role>(member.role);
  const [workerType,  setWorkerType]  = useState<WorkerType>(member.workerType);
  const [addr1,       setAddr1]       = useState("");
  const [addr2,       setAddr2]       = useState("");
  const [city,        setCity]        = useState("");
  const [stateFld,    setStateFld]    = useState("");
  const [zip,         setZip]         = useState("");
  const [ssn,         setSsn]         = useState("");
  const [ein,         setEin]         = useState("");
  const [companyName, setCompanyName] = useState("");

  useState(() => {
    supabase.from("profiles").select("*").eq("id", member.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile(data as FullProfile);
          setAddr1(data.address_line1 ?? "");
          setAddr2(data.address_line2 ?? "");
          setCity(data.city ?? "");
          setStateFld(data.state ?? "");
          setZip(data.postal_code ?? "");
          setSsn(data.ssn ?? "");
          setEin(data.ein ?? "");
          setCompanyName(data.company_name ?? "");
        }
        setLoading(false);
      });
  });

  const isSub = (profile?.worker_type ?? member.workerType) === "subcontractor";

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not authenticated"); setSaving(false); return; }

    const parts = name.trim().split(" ");
    const res = await fetch("/.netlify/functions/update-user-by-id", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        targetUserId: member.id,
        firstName:    parts[0] ?? "",
        lastName:     parts.slice(1).join(" ") ?? "",
        phone:        phone || "",
        role,
        workerType,
        addressLine1: addr1       || "",
        addressLine2: addr2       || "",
        city:         city        || "",
        state:        stateFld    || "",
        postalCode:   zip         || "",
        ssn:          !isSub ? ssn         : "",
        ein:          isSub  ? ein         : "",
        companyName:  isSub  ? companyName : "",
      }),
    });

    setSaving(false);
    if (!res.ok) { toast.error("Failed to save"); return; }

    onUpdate(member.id, {
      name:       name.trim() || member.name,
      phone:      phone || undefined,
      role,
      workerType,
    });

    toast.success("Member updated");
    setEditing(false);
    // Refresh profile data
    const { data } = await supabase.from("profiles").select("*").eq("id", member.id).maybeSingle();
    if (data) setProfile(data as FullProfile);
  };

  const displayName = member.name && member.name !== member.email ? member.name : "—";

  return (
    <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">
              {memberInitials(member.name && member.name !== member.email ? member.name : member.email)}
            </AvatarFallback>
          </Avatar>
          <div>
            <DialogTitle className="text-base">{displayName}</DialogTitle>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
          <Badge variant="secondary"
            className={"ml-auto h-5 rounded px-1.5 text-[10px] " +
              (member.status === "invited" ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>
            {member.status === "invited" ? "Invited" : "Active"}
          </Badge>
        </div>
      </DialogHeader>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !editing ? (
        // ── View mode ──
        <div className="space-y-4 text-sm">
          {/* Contact */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
            <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-xs hover:text-primary">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />{member.email}
            </a>
            {member.phone && (
              <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-xs hover:text-primary">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />{member.phone}
              </a>
            )}
          </div>

          <Separator />

          {/* Role & type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Role</p>
              <p className="mt-0.5 text-xs">{ROLE_LABELS[member.role]}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
              <p className="mt-0.5 text-xs capitalize">{member.workerType === "subcontractor" ? "Sub-contractor" : "Employee"}</p>
            </div>
          </div>

          {/* Address */}
          {(profile?.address_line1 || profile?.city) && (
            <>
              <Separator />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Address</p>
                <a href={`https://maps.google.com/?q=${encodeURIComponent([profile.address_line1, profile.city, profile.state, profile.postal_code].filter(Boolean).join(", "))}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{[profile.address_line1, profile.address_line2, profile.city, profile.state, profile.postal_code].filter(Boolean).join(", ")}</span>
                </a>
              </div>
            </>
          )}

          {/* Payroll */}
          {(profile?.ssn || profile?.ein || profile?.company_name) && (
            <>
              <Separator />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" /> {isSub ? "Business Info" : "Payroll Info"}
                </p>
                {profile.company_name && <p className="mt-1 flex items-center gap-1.5 text-xs"><Building2 className="h-3.5 w-3.5 text-muted-foreground" />{profile.company_name}</p>}
                {profile.ein && <p className="mt-0.5 text-xs text-muted-foreground">EIN: {profile.ein}</p>}
                {profile.ssn && <p className="mt-0.5 text-xs text-muted-foreground">SSN: ••••••{profile.ssn.slice(-4)}</p>}
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
            </Button>
            <Button size="sm" variant="outline" className="flex-1" asChild>
              <a href={`mailto:${member.email}`}><Mail className="mr-1.5 h-3.5 w-3.5" />Email</a>
            </Button>
            {member.phone && (
              <Button size="sm" variant="outline" className="flex-1" asChild>
                <a href={`tel:${member.phone}`}><Phone className="mr-1.5 h-3.5 w-3.5" />Call</a>
              </Button>
            )}
          </div>
        </div>
      ) : (
        // ── Edit mode ──
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input className="h-9" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input className="h-9" value={phone} onChange={e => setPhone(fmtPhone(e.target.value))} placeholder="555-123-4567" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={v => setRole(v as Role)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Employment type</Label>
              <Select value={workerType} onValueChange={v => setWorkerType(v as WorkerType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="subcontractor">Sub-contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3 w-3" /> Address
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Street</Label>
              <Input className="h-9" value={addr1} onChange={e => setAddr1(e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Apt / Suite</Label>
              <Input className="h-9" value={addr2} onChange={e => setAddr2(e.target.value)} placeholder="Apt 4B" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">City</Label>
              <Input className="h-9" value={city} onChange={e => setCity(e.target.value)} placeholder="Miami" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">State</Label>
              <Input className="h-9" value={stateFld} onChange={e => setStateFld(e.target.value)} placeholder="FL" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">ZIP</Label>
              <Input className="h-9" value={zip} onChange={e => setZip(e.target.value)} placeholder="33101" />
            </div>
          </div>

          <Separator />
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Shield className="h-3 w-3" /> {isSub ? "Business Info" : "Payroll Info"}
          </p>
          {isSub ? (
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Company name</Label>
                <Input className="h-9" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Acme LLC" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">EIN</Label>
                <Input className="h-9" value={ein} onChange={e => setEin(e.target.value)} placeholder="XX-XXXXXXX" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">SSN</Label>
              <Input className="h-9" type="password" value={ssn} onChange={e => setSsn(e.target.value)} placeholder="XXX-XX-XXXX" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save changes"}
            </Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeamMembersManager({
  members, onAdd, onUpdate, onRemove, inviteMode,
  title = "Team & Roles", subtitle,
}: TeamMembersManagerProps) {
  const [confirmId,    setConfirmId]    = useState<string | null>(null);
  const [emailTarget,  setEmailTarget]  = useState<string | null>(null);
  const [infoMember,   setInfoMember]   = useState<TeamMember | null>(null);
  const confirmMember = members.find(m => m.id === confirmId);

  const handleConfirmRemove = async () => {
    if (!confirmId) return;
    const m = confirmMember;
    setConfirmId(null);
    onRemove(confirmId);
    const result = await removeMemberFromOrg(
      m?.status === "invited" ? { invitationId: confirmId } : { memberId: confirmId }
    );
    if (!result.success) toast.error(result.error);
  };

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subtitle ?? `${members.length} member${members.length === 1 ? "" : "s"} in this workspace`}
          </p>
        </div>
        <MemberDialog mode="add" inviteDefault={!!inviteMode} onSave={onAdd}
          trigger={
            <Button size="sm" className="h-8">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {inviteMode ? "Invite member" : "Add member"}
            </Button>
          }
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Member</th>
              <th className="px-4 py-2 text-left font-medium">Email</th>
              <th className="px-4 py-2 text-left font-medium">Phone</th>
              <th className="px-4 py-2 text-left font-medium">Role</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="w-24 px-4" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-secondary/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-primary-soft text-[10px] font-medium text-primary">
                        {memberInitials(m.name && m.name !== m.email ? m.name : m.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{m.name && m.name !== m.email ? m.name : "—"}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setEmailTarget(m.email)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="max-w-[180px] truncate">{m.email}</span>
                  </button>
                </td>
                <td className="px-4 py-3">
                  {m.phone
                    ? <a href={`tel:${m.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                        <Phone className="h-3 w-3 shrink-0" />{m.phone}
                      </a>
                    : <span className="text-xs text-muted-foreground/40">—</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">{ROLE_LABELS[m.role]}</Badge>
                </td>
                <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                  {m.workerType === "subcontractor" ? "Sub-contractor" : "Employee"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary"
                    className={"h-5 rounded px-1.5 text-[10px] " +
                      (m.status === "invited" ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>
                    {m.status === "invited" ? "Invited" : "Active"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => setInfoMember(m)} title="View info">
                      <Info className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmId(m.id)}
                      disabled={m.role === "owner"}
                      title={m.role === "owner" ? "Owner cannot be removed" : "Remove member"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No team members yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info / Edit modal */}
      <Dialog open={!!infoMember} onOpenChange={o => !o && setInfoMember(null)}>
        {infoMember && <MemberInfoModal member={infoMember} onUpdate={onUpdate} onClose={() => setInfoMember(null)} />}
      </Dialog>

      {/* Email compose modal */}
      <Dialog open={!!emailTarget} onOpenChange={o => !o && setEmailTarget(null)}>
        {emailTarget && <EmailModal to={emailTarget} onClose={() => setEmailTarget(null)} />}
      </Dialog>

      {/* Confirm remove */}
      <AlertDialog open={!!confirmId} onOpenChange={o => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMember
                ? `This will remove ${confirmMember.name && confirmMember.name !== confirmMember.email ? confirmMember.name : confirmMember.email} from the workspace and delete their account. This cannot be undone.`
                : "This will remove the member from the workspace. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleConfirmRemove}>
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Add/Invite dialog ─────────────────────────────────────────────────────────

function MemberDialog({
  mode, initial, inviteDefault, onSave, trigger,
}: {
  mode: "add" | "edit"; initial?: TeamMember; inviteDefault?: boolean;
  onSave: (m: Omit<TeamMember, "id">) => void; trigger: React.ReactNode;
}) {
  const [open,       setOpen]       = useState(false);
  const [name,       setName]       = useState(initial?.name && initial.name !== initial.email ? initial.name : "");
  const [email,      setEmail]      = useState(initial?.email ?? "");
  const [phone,      setPhone]      = useState(initial?.phone ?? "");
  const [role,       setRole]       = useState<Role>(initial?.role ?? "viewer");
  const [workerType, setWorkerType] = useState<WorkerType>(initial?.workerType ?? "employee");
  const [sendNow,    setSendNow]    = useState(true);
  const [sending,    setSending]    = useState(false);

  function reset() {
    setName(initial?.name && initial.name !== initial.email ? initial.name : "");
    setEmail(initial?.email ?? ""); setPhone(initial?.phone ?? "");
    setRole(initial?.role ?? "viewer"); setWorkerType(initial?.workerType ?? "employee");
    setSendNow(true); setSending(false);
  }

  async function handleSubmit() {
    if (!email.trim()) return;
    const shouldInvite = mode === "add" && (inviteDefault || sendNow);
    const status: TeamMember["status"] = shouldInvite ? "invited" : initial?.status ?? "active";

    onSave({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || undefined,
      role, workerType, status, invitedAt: status === "invited" ? new Date().toISOString() : initial?.invitedAt });

    setOpen(false);
    if (mode === "add") reset();

    if (shouldInvite) {
      setSending(true);
      const result = await inviteMember({
        email: email.trim().toLowerCase(), role,
        name: name.trim() || undefined, phone: phone.trim() || undefined,
        workerType,
      });
      setSending(false);
      if (result.success) toast.success(`Invitation sent to ${email.trim()}`);
      else toast.error(`Member added but email failed: ${result.error}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? (inviteDefault ? "Invite member" : "Add member") : "Edit member"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input className="h-9" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input className="h-9" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input className="h-9" value={phone} onChange={e => setPhone(fmtPhone(e.target.value))} placeholder="555-123-4567" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={v => setRole(v as Role)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Employment type</Label>
              <Select value={workerType} onValueChange={v => setWorkerType(v as WorkerType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="subcontractor">Sub-contractor (1099)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {mode === "add" && !inviteDefault && (
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} className="h-3.5 w-3.5" />
              Send invitation email now
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!email.trim() || sending}>
            {sending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</> : mode === "add" ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}