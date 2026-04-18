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
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date.toISOString();
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
