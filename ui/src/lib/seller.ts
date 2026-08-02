import { gql } from "@/lib/gql";

export type SellerDashboard = {
  revenue: number;
  expenses: number;
  profitMargin: number;
  cashOnHand: number;
  lastMonthRevenue: number;
  lastMonthExpenses: number;
};

export type SellerSeriesPoint = { month: string; income: number; expenses: number };
export type SellerCategory = { name: string; spent: number };
export type SellerFinanceEntry = {
  entryId: string;
  entryType: string;
  amount: number;
  category: string | null;
  description: string | null;
  transactionDate: string;
};
export type SellerInventoryItem = {
  itemId: string;
  sku: string;
  name: string;
  stock: number;
  reorderLevel: number;
  unitCost: number;
};

export const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const PALETTE = ["#10b981", "#34d399", "#6ee7b7", "#059669", "#047857", "#0d9488"];

export const withColors = (cats: SellerCategory[]) =>
  cats.map((c, i) => ({ ...c, color: PALETTE[i % PALETTE.length] }));

export const REVENUE_CATEGORIES = ["Product sales", "Online orders", "Wholesale", "Other"];
export const EXPENSE_CATEGORIES = ["Materials", "Payroll", "Rent", "Logistics", "Utilities", "Other"];

export const currentMonth = () =>
  new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });

export const taxPeriod = () =>
  new Date().toLocaleString("en-IN", { month: "short", year: "numeric" });

export const nextFiling = () =>
  new Date(new Date().getFullYear(), new Date().getMonth() + 1, 20).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export async function fetchSellerDashboard(): Promise<SellerDashboard> {
  const d = await gql<{ sellerDashboard: SellerDashboard }>(
    `{ sellerDashboard { revenue expenses profitMargin cashOnHand lastMonthRevenue lastMonthExpenses } }`,
  );
  return d.sellerDashboard;
}

export async function fetchSellerSeries(months = 6): Promise<SellerSeriesPoint[]> {
  const d = await gql<{ sellerSeries: SellerSeriesPoint[] }>(
    `{ sellerSeries(months: ${months}) { month income expenses } }`,
  );
  return d.sellerSeries;
}

export async function fetchSellerCategories(entryType: "revenue" | "expense"): Promise<SellerCategory[]> {
  const d = await gql<{ sellerCategories: SellerCategory[] }>(
    `{ sellerCategories(entryType: "${entryType}") { name spent } }`,
  );
  return d.sellerCategories;
}

export async function fetchSellerFinances(limit = 50): Promise<SellerFinanceEntry[]> {
  const d = await gql<{ sellerFinances: SellerFinanceEntry[] }>(
    `{ sellerFinances(limit: ${limit}) { entryId entryType amount category description transactionDate } }`,
  );
  return d.sellerFinances;
}

export async function fetchSellerInventory(): Promise<SellerInventoryItem[]> {
  const d = await gql<{ sellerInventory: SellerInventoryItem[] }>(
    `{ sellerInventory { itemId sku name stock reorderLevel unitCost } }`,
  );
  return d.sellerInventory;
}
