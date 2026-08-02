export const health = {
  score: 78,
  level: "Good",
  insight: "You're spending 12% under your monthly budget. Keep it up.",
};

export const wallet = {
  balance: 48210,
  credits: 12,
  monthlySpend: 31250,
  monthlyBudget: 40000,
};

export const alerts: { id: string; title: string; time: string; severity: "high" | "medium" | "low" }[] = [
  { id: "a1", title: "Big purchase flagged: ₹23,999 phone (72% of monthly budget)", time: "2h ago", severity: "high" },
  { id: "a2", title: "Grocery spending 18% above last month", time: "Yesterday", severity: "medium" },
  { id: "a3", title: "Monthly budget on track — ₹8,750 left", time: "2 days ago", severity: "low" },
];

export type Verdict = "buy" | "wait" | "skip";

export const analyses: { id: string; product: string; price: number; verdict: Verdict; date: string; summary: string }[] = [
  { id: "an1", product: "Samsung Galaxy M35 5G", price: 23999, verdict: "wait", date: "12 Jun", summary: "Nice phone, but 72% of your monthly budget. Wait 2 months or buy on EMI-free offer." },
  { id: "an2", product: "Noise ColorFit Pro 5", price: 3499, verdict: "buy", date: "09 Jun", summary: "Well within budget. Your old band is 3 years old — this is a sensible upgrade." },
  { id: "an3", product: "Nike Air Zoom Pegasus 41", price: 9995, verdict: "skip", date: "05 Jun", summary: "You bought running shoes 4 months ago. This is impulse-driven — skip." },
  { id: "an4", product: "Kindle Paperwhite", price: 10999, verdict: "wait", date: "28 May", summary: "Only 4 purchases a year justify it. Try the library first." },
  { id: "an5", product: "Philips OneBlade 360", price: 3999, verdict: "buy", date: "20 May", summary: "Replaces a 5-year-old trimmer. 8% of budget, easy buy." },
  { id: "an6", product: "Boat Airdopes 141", price: 1299, verdict: "skip", date: "15 May", summary: "Your current earbuds work fine — no failure signal detected." },
];

export const spending30d = [
  { day: "01", spend: 900, budget: 1333 },
  { day: "04", spend: 2100, budget: 1333 },
  { day: "07", spend: 1400, budget: 1333 },
  { day: "10", spend: 3400, budget: 1333 },
  { day: "13", spend: 1200, budget: 1333 },
  { day: "16", spend: 1850, budget: 1333 },
  { day: "19", spend: 2600, budget: 1333 },
  { day: "22", spend: 950, budget: 1333 },
  { day: "25", spend: 2900, budget: 1333 },
  { day: "28", spend: 1600, budget: 1333 },
];

export const categories = [
  { name: "Groceries", spent: 9800, color: "#10b981" },
  { name: "Dining & snacks", spent: 6400, color: "#34d399" },
  { name: "Transport", spent: 4200, color: "#6ee7b7" },
  { name: "Shopping", spent: 5200, color: "#059669" },
  { name: "Recharge & bills", spent: 3450, color: "#047857" },
  { name: "Other", spent: 2200, color: "#2a2a2a" },
];

export const purchases = [
  { id: "p1", product: "Noise ColorFit Pro 5", price: 3499, date: "09 Jun", verdict: "buy" as Verdict, saved: 0 },
  { id: "p2", product: "Samsung Galaxy M35 5G", price: 23999, date: "12 Jun", verdict: "wait" as Verdict, saved: 23999 },
  { id: "p3", product: "Nike Air Zoom Pegasus 41", price: 9995, date: "05 Jun", verdict: "skip" as Verdict, saved: 9995 },
  { id: "p4", product: "Philips OneBlade 360", price: 3999, date: "20 May", verdict: "buy" as Verdict, saved: 0 },
  { id: "p5", product: "Kindle Paperwhite", price: 10999, date: "28 May", verdict: "wait" as Verdict, saved: 10999 },
];

export const bankAccount = {
  bank: "State Bank of India",
  last4: "4321",
  balance: 48210,
  lastSync: "Today, 09:41",
};
