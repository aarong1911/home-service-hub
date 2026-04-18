// Shared estimate templates used by /financials/estimates "Start from template"
// flow and /settings/templates editor.

export type EstimateLine = { name: string; qty: number; unit: string; price: number };

export type SharedEstimateTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  projectType: string;
  markup: number; // percent
  lines: EstimateLine[];
  notes: string;
  uses: number;
  starred: boolean;
};

export const estimateTemplates: SharedEstimateTemplate[] = [
  {
    id: "e1", name: "Kitchen — Mid-range remodel", category: "Kitchen",
    description: "Standard 150 sqft kitchen with semi-custom cabinets and quartz.",
    projectType: "Kitchen", markup: 22,
    lines: [
      { name: "Demo & disposal", qty: 1, unit: "lot", price: 3800 },
      { name: "Semi-custom cabinetry", qty: 22, unit: "lf", price: 480 },
      { name: "Quartz countertops", qty: 48, unit: "sf", price: 95 },
      { name: "Tile backsplash + install", qty: 32, unit: "sf", price: 28 },
      { name: "Plumbing rough + finish", qty: 1, unit: "lot", price: 4200 },
      { name: "Electrical rough + finish", qty: 1, unit: "lot", price: 3600 },
      { name: "Appliance install", qty: 1, unit: "lot", price: 1200 },
      { name: "Painting (kitchen + adj. dining)", qty: 1, unit: "lot", price: 2400 },
      { name: "Project management", qty: 1, unit: "lot", price: 4800 },
    ],
    notes: "Excludes flooring, structural changes, and appliance cost. 50% deposit, 40% midpoint, 10% completion.",
    uses: 142, starred: true,
  },
  {
    id: "e2", name: "Primary bath — full gut", category: "Bath",
    description: "100 sqft primary bath with tile shower, freestanding tub, double vanity.",
    projectType: "Bath", markup: 25,
    lines: [
      { name: "Demo & disposal", qty: 1, unit: "lot", price: 2800 },
      { name: "Plumbing reroute + finish", qty: 1, unit: "lot", price: 5400 },
      { name: "Curbless shower assembly + waterproofing", qty: 1, unit: "lot", price: 4200 },
      { name: "Floor + wall tile install", qty: 220, unit: "sf", price: 18 },
      { name: "Double vanity install", qty: 1, unit: "ea", price: 1800 },
      { name: "Freestanding tub install", qty: 1, unit: "ea", price: 1400 },
      { name: "Heated floor mat + thermostat", qty: 1, unit: "lot", price: 1800 },
      { name: "Project management", qty: 1, unit: "lot", price: 3600 },
    ],
    notes: "Tile and fixtures supplied by owner. 14-week lead time on vanity.",
    uses: 88, starred: false,
  },
  {
    id: "e3", name: "Single-story addition — 400 sqft", category: "Addition",
    description: "400 sqft slab-on-grade addition, framed, dried-in, finished.",
    projectType: "Addition", markup: 20,
    lines: [
      { name: "Site prep + foundation", qty: 1, unit: "lot", price: 28000 },
      { name: "Framing + sheathing", qty: 400, unit: "sf", price: 38 },
      { name: "Roofing + flashing", qty: 1, unit: "lot", price: 9200 },
      { name: "Windows + exterior doors", qty: 1, unit: "lot", price: 7400 },
      { name: "MEP rough", qty: 1, unit: "lot", price: 14800 },
      { name: "Insulation + drywall", qty: 400, unit: "sf", price: 14 },
      { name: "Interior finish + paint", qty: 1, unit: "lot", price: 12400 },
      { name: "Permits + inspections", qty: 1, unit: "lot", price: 3800 },
      { name: "Project management", qty: 1, unit: "lot", price: 14000 },
    ],
    notes: "Excludes flooring and HVAC equipment. 12–14 week schedule from permit.",
    uses: 31, starred: false,
  },
];

export function estimateTemplateSubtotal(t: SharedEstimateTemplate): number {
  return t.lines.reduce((s, l) => s + l.qty * l.price, 0);
}

export function estimateTemplateTotal(t: SharedEstimateTemplate): number {
  return Math.round(estimateTemplateSubtotal(t) * (1 + t.markup / 100));
}
