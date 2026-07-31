export const sellerOverview = {
  revenue: 128400,
  expenses: 64300,
  profitMargin: 49.9,
  cashOnHand: 312500,
  lastMonth: { revenue: 110200, expenses: 60100 },
};

export const income6m = [
  { month: "Feb", income: 84500, expenses: 51200 },
  { month: "Mar", income: 92300, expenses: 49800 },
  { month: "Apr", income: 101200, expenses: 55600 },
  { month: "May", income: 96800, expenses: 58900 },
  { month: "Jun", income: 110200, expenses: 60100 },
  { month: "Jul", income: 128400, expenses: 64300 },
];

export const incomeCategories = [
  { name: "Product sales", spent: 86400, color: "#10b981" },
  { name: "Online orders", spent: 28900, color: "#34d399" },
  { name: "Wholesale", spent: 8900, color: "#059669" },
  { name: "Other", spent: 4200, color: "#047857" },
];

export const expenseList = [
  { id: "e1", item: "Raw material — fabric", category: "Materials", amount: 21400, date: "28 Jul" },
  { id: "e2", item: "Packaging supplies", category: "Materials", amount: 8600, date: "26 Jul" },
  { id: "e3", item: "Delivery partner fees", category: "Logistics", amount: 12900, date: "24 Jul" },
  { id: "e4", item: "Shop rent", category: "Rent", amount: 15000, date: "01 Jul" },
  { id: "e5", item: "Electricity bill", category: "Utilities", amount: 3400, date: "05 Jul" },
  { id: "e6", item: "Staff salaries (2)", category: "Payroll", amount: 18000, date: "01 Jul" },
];

export const expenseCategories = [
  { name: "Materials", spent: 30000, color: "#10b981" },
  { name: "Payroll", spent: 18000, color: "#34d399" },
  { name: "Rent", spent: 15000, color: "#6ee7b7" },
  { name: "Logistics", spent: 12900, color: "#059669" },
  { name: "Utilities", spent: 8400, color: "#047857" },
];

export const pnl = {
  month: "July 2026",
  rows: [
    { label: "Product sales", amount: 86400 },
    { label: "Online orders", amount: 28900 },
    { label: "Wholesale", amount: 8900 },
    { label: "Other income", amount: 4200 },
  ] as { label: string; amount: number }[],
  incomeTotal: 128400,
  costRows: [
    { label: "Materials", amount: 30000 },
    { label: "Payroll", amount: 18000 },
    { label: "Rent", amount: 15000 },
    { label: "Logistics", amount: 12900 },
    { label: "Utilities", amount: 8400 },
  ] as { label: string; amount: number }[],
  expenseTotal: 64300,
  gst: 6420,
};

export const tax = {
  gstLiability: 41200,
  inputTaxCredit: 12800,
  netPayable: 28400,
  nextFiling: "20 Aug 2026",
  period: "Jul 2026",
};

export const cashflow = [
  { month: "Feb", in: 84500, out: 51200 },
  { month: "Mar", in: 92300, out: 49800 },
  { month: "Apr", in: 101200, out: 55600 },
  { month: "May", in: 96800, out: 58900 },
  { month: "Jun", in: 110200, out: 60100 },
  { month: "Jul", in: 128400, out: 64300 },
];

export const inventory = [
  { id: "i1", sku: "FD-COT-001", name: "Cotton fabric (m)", stock: 420, reorder: 200, unitCost: 42, cogs: 17640 },
  { id: "i2", sku: "PK-BOX-002", name: "Packaging boxes", stock: 85, reorder: 150, unitCost: 8, cogs: 680 },
  { id: "i3", sku: "TH-ROY-003", name: "Royal blue thread (spool)", stock: 240, reorder: 100, unitCost: 12, cogs: 2880 },
  { id: "i4", sku: "LB-BTN-004", name: "Shirt buttons (dozen)", stock: 60, reorder: 80, unitCost: 15, cogs: 900 },
  { id: "i5", sku: "LZ-TAG-005", name: "Hang tags", stock: 900, reorder: 400, unitCost: 3, cogs: 2700 },
];

export const coachInsights = [
  { id: "c1", title: "Materials up 14% vs June", detail: "Fabric costs rose ₹3,800. Consider a second supplier or forward order at current rates.", tone: "warn" },
  { id: "c2", title: "Online orders growing 2.1× MoM", detail: "Push more inventory toward the online channel — it carries your best margin.", tone: "good" },
  { id: "c3", title: "GST filing due 20 Aug", detail: "Net payable ₹28,400 after ITC of ₹12,800. All expenses are GST-tagged and ready.", tone: "info" },
];
