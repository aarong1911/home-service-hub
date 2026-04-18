// Mock renovation-industry data shared across features.
export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  tags: string[];
  owner: string;
  lastActivity: string; // ISO
  createdAt: string;
};

export type Deal = {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  value: number;
  stage: string;
  expectedClose: string;
  owner: string;
  ownerInitials: string;
  ageDays: number;
};

export type Project = {
  id: string;
  name: string;
  client: string;
  status: "Planning" | "In Progress" | "On Hold" | "Completed";
  progress: number;
  budget: number;
  spent: number;
  nextMilestone: string;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  assignee: string;
  assigneeInitials: string;
  due: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "med" | "high";
};

export type Conversation = {
  id: string;
  contactId: string;
  contactName: string;
  channel: "email" | "sms" | "voice";
  preview: string;
  unread: boolean;
  lastAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  channel: "email" | "sms" | "voice";
  direction: "in" | "out";
  body: string;
  at: string;
};

export type Workflow = {
  id: string;
  name: string;
  status: "active" | "paused" | "draft";
  trigger: string;
  lastRun: string;
  successRate: number;
  runs: number;
};

export type Estimate = {
  id: string;
  number: string;
  client: string;
  amount: number;
  status: "Draft" | "Sent" | "Viewed" | "Accepted" | "Declined";
  issued: string;
};

export type Invoice = {
  id: string;
  number: string;
  client: string;
  amount: number;
  status: "Draft" | "Sent" | "Viewed" | "Paid" | "Overdue";
  due: string;
};

export type Payment = {
  id: string;
  invoice: string;
  client: string;
  amount: number;
  method: "ACH" | "Card" | "Check" | "Wire";
  receivedAt: string;
};

const owners = ["Alex Romero", "Priya Shah", "Jamal Burke", "Mei Lin", "Sara Holt"];
const ownerInitials = ["AR", "PS", "JB", "ML", "SH"];

const firstNames = [
  "Sarah", "Mark", "Emily", "James", "Laura", "Michael", "Jessica", "David",
  "Rachel", "Tom", "Olivia", "Daniel", "Sophie", "Ethan", "Mia", "Lucas",
  "Ava", "Noah", "Isabella", "Liam", "Charlotte", "Mason", "Amelia", "Logan", "Harper",
];
const lastNames = [
  "Jenkins", "Thompson", "Carter", "Smith", "Curtis", "Peterson", "Nguyen", "O'Brien",
  "Davies", "Rivera", "Washington", "Becker", "Holloway", "Tanaka", "Klein",
  "Morales", "Reyes", "Singh", "Park", "Andersen", "Hayes", "Lowe", "Cohen", "Walsh", "Cross",
];
const companies = [
  "Maplewood Estates", "Riverbend Homes", "Cedar & Co. Builders", "BlueStone Living",
  "Northwind Properties", "Heritage Renovations", "Summit Residential", "Iron Oak Group",
];
const tagsPool = ["VIP", "Referral", "Repeat", "Web Lead", "Cold", "Past Due", "High Value"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function isoDaysAgo(d: number): string {
  // Use a stable epoch-rounded base to avoid SSR/CSR drift
  const base = Date.UTC(2026, 3, 18); // April 18, 2026 (matches current date)
  return new Date(base - d * 86_400_000).toISOString();
}

export const mockContacts: Contact[] = Array.from({ length: 25 }, (_, i) => ({
  id: `c_${i + 1}`,
  name: `${pick(firstNames, i)} ${pick(lastNames, i + 3)}`,
  email: `${pick(firstNames, i).toLowerCase()}.${pick(lastNames, i + 3).toLowerCase().replace("'", "")}@example.com`,
  phone: `(${200 + (i % 700)}) ${100 + (i * 7) % 900}-${1000 + (i * 13) % 9000}`,
  company: pick(companies, i),
  tags: [pick(tagsPool, i), pick(tagsPool, i + 2)].filter((v, idx, a) => a.indexOf(v) === idx),
  owner: pick(owners, i),
  lastActivity: isoDaysAgo(i % 30),
  createdAt: isoDaysAgo(30 + (i * 5) % 200),
}));

export const pipelineStages = [
  { id: "new", name: "New" },
  { id: "qualified", name: "Qualified" },
  { id: "site-visit", name: "Site Visit" },
  { id: "proposal", name: "Proposal" },
  { id: "negotiation", name: "Negotiation" },
  { id: "won", name: "Won" },
] as const;

const dealTypes = [
  "Kitchen Remodel", "Master Bath Remodel", "Whole-Home Renovation", "Basement Finish",
  "Deck & Patio", "Roof Replacement", "Addition", "Garage Conversion",
  "Window Replacement", "Exterior Refresh",
];

export const mockDeals: Deal[] = Array.from({ length: 40 }, (_, i) => {
  const contact = mockContacts[i % mockContacts.length];
  const ownerIdx = i % owners.length;
  return {
    id: `d_${i + 1}`,
    name: `${pick(dealTypes, i)} — ${contact.name.split(" ")[1]}`,
    contactId: contact.id,
    contactName: contact.name,
    value: 4500 + ((i * 1873) % 95000),
    stage: pipelineStages[i % pipelineStages.length].id,
    expectedClose: isoDaysAgo(-((i % 45) + 5)),
    owner: owners[ownerIdx],
    ownerInitials: ownerInitials[ownerIdx],
    ageDays: (i * 3) % 28,
  };
});

export const mockProjects: Project[] = Array.from({ length: 12 }, (_, i) => ({
  id: `p_${i + 1}`,
  name: pick(dealTypes, i) + ` — ${pick(lastNames, i)} Residence`,
  client: `${pick(firstNames, i)} ${pick(lastNames, i)}`,
  status: (["Planning", "In Progress", "In Progress", "On Hold", "Completed"] as const)[i % 5],
  progress: (i * 17) % 100,
  budget: 18000 + ((i * 4321) % 80000),
  spent: 6000 + ((i * 2113) % 60000),
  nextMilestone: ["Demo complete", "Cabinet install", "Final inspection", "Punch list", "Client walkthrough"][i % 5],
}));

const taskTitles = [
  "Demo existing cabinets", "Order quartz countertops", "Schedule electrical rough-in",
  "Drywall + skim coat", "Tile backsplash install", "Paint walls + trim",
  "Final plumbing connections", "Punch list walkthrough", "Permit submission",
  "Cabinet delivery coordination", "Subfloor inspection", "Lighting fixture selection",
];

export const mockTasks: Task[] = Array.from({ length: 30 }, (_, i) => {
  const ownerIdx = i % owners.length;
  return {
    id: `t_${i + 1}`,
    projectId: mockProjects[i % mockProjects.length].id,
    title: pick(taskTitles, i),
    assignee: owners[ownerIdx],
    assigneeInitials: ownerInitials[ownerIdx],
    due: isoDaysAgo(-((i * 2) % 21) - 1),
    status: (["todo", "in_progress", "review", "done"] as const)[i % 4],
    priority: (["low", "med", "high"] as const)[i % 3],
  };
});

export const mockConversations: Conversation[] = Array.from({ length: 14 }, (_, i) => {
  const contact = mockContacts[i];
  const channels: Conversation["channel"][] = ["email", "sms", "voice"];
  const previews = [
    "Thanks — looking forward to the site visit on Thursday.",
    "Could we push the kitchen demo back one day?",
    "Approved the cabinet selections, please proceed.",
    "Quick question about the tile sample you sent.",
    "Sounds good. I'll wire the deposit today.",
    "Voicemail: 1m 12s — call me back when you can.",
  ];
  return {
    id: `cv_${i + 1}`,
    contactId: contact.id,
    contactName: contact.name,
    channel: channels[i % 3],
    preview: pick(previews, i),
    unread: i < 4,
    lastAt: isoDaysAgo(i % 7),
  };
});

export const mockMessages: Message[] = mockConversations.flatMap((cv, ci) => {
  const channels: Message["channel"][] = ["email", "sms", "voice"];
  return Array.from({ length: 5 }, (_, mi) => ({
    id: `m_${ci}_${mi}`,
    conversationId: cv.id,
    channel: channels[(ci + mi) % 3],
    direction: mi % 2 === 0 ? "in" : "out",
    body: [
      "Hi — wanted to confirm next steps on the kitchen scope.",
      "Sure, I can have the updated estimate over by EOD.",
      "Perfect. Also, can we add the pantry build-out?",
      "Yes — adds about $4,200. I'll revise and resend.",
      "Approved. Let's lock in the start date.",
    ][mi],
    at: isoDaysAgo(7 - mi),
  }));
});

export const mockWorkflows: Workflow[] = [
  { id: "w_1", name: "New lead → Welcome SMS + Email", status: "active", trigger: "Lead created", lastRun: isoDaysAgo(0), successRate: 98, runs: 1247 },
  { id: "w_2", name: "Estimate sent → Follow-up in 3 days", status: "active", trigger: "Estimate sent", lastRun: isoDaysAgo(0), successRate: 94, runs: 612 },
  { id: "w_3", name: "Project won → Create project + kickoff tasks", status: "active", trigger: "Deal moved to Won", lastRun: isoDaysAgo(1), successRate: 100, runs: 89 },
  { id: "w_4", name: "Invoice overdue → Reminder + late fee", status: "active", trigger: "Invoice 7d overdue", lastRun: isoDaysAgo(0), successRate: 88, runs: 142 },
  { id: "w_5", name: "Project complete → Review request", status: "paused", trigger: "Project status: Completed", lastRun: isoDaysAgo(4), successRate: 76, runs: 64 },
  { id: "w_6", name: "Cold lead → Re-engagement drip", status: "draft", trigger: "Lead inactive 30d", lastRun: "—", successRate: 0, runs: 0 },
];

export const mockEstimates: Estimate[] = Array.from({ length: 14 }, (_, i) => ({
  id: `e_${i + 1}`,
  number: `EST-${4200 + i}`,
  client: mockContacts[i].name,
  amount: 8400 + ((i * 3217) % 70000),
  status: (["Draft", "Sent", "Viewed", "Accepted", "Declined"] as const)[i % 5],
  issued: isoDaysAgo((i * 2) % 30),
}));

export const mockInvoices: Invoice[] = Array.from({ length: 16 }, (_, i) => ({
  id: `i_${i + 1}`,
  number: `INV-${7800 + i}`,
  client: mockContacts[i].name,
  amount: 5200 + ((i * 2891) % 60000),
  status: (["Draft", "Sent", "Viewed", "Paid", "Paid", "Overdue"] as const)[i % 6],
  due: isoDaysAgo(-((i * 3) % 30) + 5),
}));

export const mockPayments: Payment[] = Array.from({ length: 12 }, (_, i) => ({
  id: `pay_${i + 1}`,
  invoice: `INV-${7800 + i}`,
  client: mockContacts[i].name,
  amount: 4200 + ((i * 1987) % 30000),
  method: (["ACH", "Card", "Check", "Wire"] as const)[i % 4],
  receivedAt: isoDaysAgo(i % 20),
}));

export const pipelineVelocityData = Array.from({ length: 12 }, (_, i) => ({
  week: `W${i + 1}`,
  value: 28000 + Math.round(Math.sin(i / 1.5) * 12000) + i * 1800,
  deals: 4 + Math.round(Math.abs(Math.sin(i)) * 6),
}));

export const recentActivity = [
  { id: 1, who: "Sarah Jenkins", what: "signed proposal for Kitchen Remodel", when: "12 min ago", type: "deal" },
  { id: 2, who: "Mark Thompson", what: "submitted a new lead via website", when: "48 min ago", type: "lead" },
  { id: 3, who: "Emily Carter", what: "paid invoice INV-7834 ($12,400)", when: "2 hr ago", type: "payment" },
  { id: 4, who: "James Smith", what: "replied to your email", when: "3 hr ago", type: "email" },
  { id: 5, who: "Laura Curtis", what: "marked job #JD-7890 complete", when: "Yesterday", type: "project" },
  { id: 6, who: "Workflow", what: "sent 12 follow-up SMS messages", when: "Yesterday", type: "automation" },
];

export const upcomingTasks = [
  { id: 1, title: "Site visit: 14 Elm St.", time: "Today · 10:00 AM", priority: "high" },
  { id: 2, title: "Send proposal to Thorne Residence", time: "Today · 2:30 PM", priority: "med" },
  { id: 3, title: "Follow up: Becker bath remodel", time: "Tomorrow · 9:00 AM", priority: "med" },
  { id: 4, title: "Order cabinets for Miller kitchen", time: "Wed · 11:00 AM", priority: "low" },
  { id: 5, title: "Review Q4 forecast", time: "Fri · 4:00 PM", priority: "low" },
];
