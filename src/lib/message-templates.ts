// Shared message templates + merge tag resolver used by /inbox composer
// and /settings/templates editor.

export type MessageChannel = "email" | "sms";

export type SharedMessageTemplate = {
  id: string;
  name: string;
  channel: MessageChannel;
  category: string;
  description: string;
  subject?: string;
  body: string;
  uses: number;
  starred: boolean;
};

export const messageTemplates: SharedMessageTemplate[] = [
  {
    id: "m1", name: "New lead — welcome", channel: "email", category: "Welcome",
    description: "First touch within 5 minutes of an inbound lead.",
    subject: "Thanks for reaching out, {{first_name}}!",
    body: "Hi {{first_name}},\n\nThanks for considering {{company_name}} for your {{project_type}} project at {{project_address}}. I'd love to schedule a 15-min discovery call to learn more about your goals.\n\nWhat times work best this week?\n\n— {{owner_name}}",
    uses: 482, starred: true,
  },
  {
    id: "m2", name: "Estimate follow-up (3 day)", channel: "email", category: "Follow-up",
    description: "Sent 3 days after estimate delivery if no response.",
    subject: "Quick check on your {{project_type}} estimate",
    body: "Hi {{first_name}},\n\nJust circling back on the {{project_type}} estimate I sent ({{estimate_total}}). Happy to walk you through any line item or adjust scope.\n\nWould a quick call Thursday or Friday work?\n\n— {{owner_name}}",
    uses: 318, starred: true,
  },
  {
    id: "m3", name: "Deposit reminder", channel: "email", category: "Billing",
    description: "Friendly nudge for outstanding deposits.",
    subject: "Reserve your start date — deposit due {{deposit_due}}",
    body: "Hi {{first_name}},\n\nWe're holding {{start_date}} for your {{project_type}}. To lock it in, we need the {{deposit_amount}} deposit by {{deposit_due}}.\n\nPay securely here: [payment link]\n\n— {{owner_name}}",
    uses: 164, starred: false,
  },
  {
    id: "m4", name: "Project complete — review request", channel: "email", category: "Reputation",
    description: "Sent at substantial completion to invite a Google review.",
    subject: "It was a pleasure, {{first_name}} 🛠️",
    body: "Hi {{first_name}},\n\nWe loved working on your {{project_type}} at {{project_address}}. If you have 60 seconds, a quick Google review helps us keep doing what we love:\n\n[review link]\n\nThanks again!\n— {{owner_name}}",
    uses: 96, starred: false,
  },
  {
    id: "m5", name: "Speed-to-lead text", channel: "sms", category: "Welcome",
    description: "Auto-text within 60 seconds of new lead.",
    body: "Hey {{first_name}}, this is {{owner_name}} from {{company_name}}. Got your inquiry for {{project_type}} — got 5 min for a quick chat? Reply YES and I'll call.",
    uses: 612, starred: true,
  },
  {
    id: "m6", name: "Site visit reminder", channel: "sms", category: "Scheduling",
    description: "Day-before SMS reminder with arrival window.",
    body: "Reminder: {{owner_name}} from {{company_name}} will be at {{project_address}} tomorrow between 9–10am. Reply RESCHED to change.",
    uses: 287, starred: false,
  },
  {
    id: "m7", name: "Appointment confirmed", channel: "sms", category: "Scheduling",
    description: "Confirms a freshly booked site visit.",
    body: "Confirmed! {{owner_name}} will see you at {{project_address}} on {{start_date}}. Reply with any questions — talk soon, {{first_name}}.",
    uses: 201, starred: false,
  },
];

export type MergeContext = Partial<{
  first_name: string;
  last_name: string;
  project_address: string;
  project_type: string;
  owner_name: string;
  company_name: string;
  deposit_amount: string;
  start_date: string;
  estimate_total: string;
  deposit_due: string;
}>;

export function resolveMergeTags(text: string, ctx: MergeContext): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key: string) => {
    const v = (ctx as Record<string, string | undefined>)[key];
    return v ?? full;
  });
}

// Debug log entry produced by composers when a template is inserted.
// Tracks whether subject/body were replaced, appended, or left alone.
export type TemplateInsertLog = {
  ts: string;
  surface: "inbox" | "project-comms";
  templateId: string;
  templateName: string;
  channel: MessageChannel;
  mode: "replace" | "append";
  subjectAction: "replace" | "append" | "noop" | "n/a";
  bodyAction: "replace" | "append" | "noop";
};
