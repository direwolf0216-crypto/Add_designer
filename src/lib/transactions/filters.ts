// URL search params <-> typed filters for the All Transactions list. Every builder takes the current
// query string and returns the next one, so callers only have to `router.push(`?${next}`)`.

export interface TransactionUrlFilters {
  view: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  categories: string | null;
  amountMin: string | null;
  amountMax: string | null;
  type: string | null;
  paymentMode: string | null;
  month: string | null;
}

/** Editable copy of the filters shown in the Advanced Filters dialog. "ALL" means no filter. */
export interface TransactionFilterDraft {
  dateFrom: string;
  dateTo: string;
  categories: string;
  amountMin: string;
  amountMax: string;
  type: string;
  paymentMode: string;
}

export const EMPTY_FILTER_DRAFT: TransactionFilterDraft = {
  dateFrom: "",
  dateTo: "",
  categories: "",
  amountMin: "",
  amountMax: "",
  type: "ALL",
  paymentMode: "ALL",
};

export const PAGE_SIZE = 25;

interface ParamsLike {
  get(name: string): string | null;
}

export function readTransactionFilters(params: ParamsLike): TransactionUrlFilters {
  return {
    view: params.get("view"),
    dateFrom: params.get("dateFrom"),
    dateTo: params.get("dateTo"),
    categories: params.get("categories"),
    amountMin: params.get("amountMin"),
    amountMax: params.get("amountMax"),
    type: params.get("type"),
    paymentMode: params.get("paymentMode"),
    month: params.get("month"),
  };
}

export const hasCustomDateRange = (f: TransactionUrlFilters) => !!(f.dateFrom || f.dateTo);

/** Non-date filters are set (highlights the Filters button). */
export const hasAdvancedFilters = (f: TransactionUrlFilters) =>
  !!(f.type || f.paymentMode || f.amountMin || f.amountMax || f.categories);

/** Any filter worth a badge in the "Active Filters" strip. */
export const hasActiveFilterBadges = (f: TransactionUrlFilters) =>
  !!(
    f.dateFrom ||
    f.dateTo ||
    f.categories ||
    f.amountMin ||
    f.amountMax ||
    (f.type && f.type !== "ALL") ||
    (f.paymentMode && f.paymentMode !== "ALL")
  );

/** Filters that explain an empty result (drives the empty-state copy and its "Clear Filters" button). */
export const hasEmptyStateFilters = (f: TransactionUrlFilters) =>
  !!(f.dateFrom || f.dateTo || f.type || f.paymentMode || f.categories);

export function draftFromFilters(f: TransactionUrlFilters): TransactionFilterDraft {
  return {
    dateFrom: f.dateFrom || "",
    dateTo: f.dateTo || "",
    categories: f.categories || "",
    amountMin: f.amountMin || "",
    amountMax: f.amountMax || "",
    type: f.type || "ALL",
    paymentMode: f.paymentMode || "ALL",
  };
}

/** Apply the dialog draft. A custom date range replaces the preset view / month. */
export function applyDraftToQuery(current: string, draft: TransactionFilterDraft): string {
  const params = new URLSearchParams(current);
  if (draft.dateFrom) params.set("dateFrom", draft.dateFrom); else params.delete("dateFrom");
  if (draft.dateTo) params.set("dateTo", draft.dateTo); else params.delete("dateTo");
  if (draft.categories) params.set("categories", draft.categories.trim()); else params.delete("categories");
  if (draft.amountMin) params.set("amountMin", draft.amountMin); else params.delete("amountMin");
  if (draft.amountMax) params.set("amountMax", draft.amountMax); else params.delete("amountMax");
  if (draft.type && draft.type !== "ALL") params.set("type", draft.type); else params.delete("type");
  if (draft.paymentMode && draft.paymentMode !== "ALL") params.set("paymentMode", draft.paymentMode); else params.delete("paymentMode");

  if (draft.dateFrom || draft.dateTo) {
    params.delete("view");
    params.delete("month");
  }
  return params.toString();
}

/** Clear every filter but keep the preset view. */
export function clearedQuery(view: string | null): string {
  const params = new URLSearchParams();
  if (view) params.set("view", view);
  return params.toString();
}

export function viewQuery(current: string, view: string): string {
  const params = new URLSearchParams(current);
  params.set("view", view);
  params.delete("dateFrom");
  params.delete("dateTo");
  params.delete("month");
  return params.toString();
}

export function dayQuery(current: string, day: string): string {
  const params = new URLSearchParams(current);
  params.set("view", "day");
  params.set("dateFrom", day);
  params.set("dateTo", day);
  return params.toString();
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Sunday..Saturday week containing `dateStr`, as local `yyyy-MM-dd` strings. */
export function weekRangeFromDate(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr);
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // End of week (Saturday)
  return { start: ymd(start), end: ymd(end) };
}

export function weekQuery(current: string, dateStr: string): string {
  const { start, end } = weekRangeFromDate(dateStr);
  const params = new URLSearchParams(current);
  params.set("view", "week");
  params.set("dateFrom", start);
  params.set("dateTo", end);
  return params.toString();
}

export function monthQuery(current: string, dateStr: string): string {
  const d = new Date(dateStr);
  const params = new URLSearchParams(current);
  params.set("view", "month");
  params.set("month", `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  params.delete("dateFrom");
  params.delete("dateTo");
  return params.toString();
}

/** Query string for GET /api/transactions. A custom date range wins over the preset view / month. */
export function buildListQuery(f: TransactionUrlFilters, page: number): string {
  const custom = hasCustomDateRange(f);
  const params = new URLSearchParams();
  if (f.view && !custom) params.append("view", f.view);
  if (f.dateFrom) params.append("dateFrom", f.dateFrom);
  if (f.dateTo) params.append("dateTo", f.dateTo);
  if (f.categories) params.append("categories", f.categories);
  if (f.amountMin) params.append("amountMin", f.amountMin);
  if (f.amountMax) params.append("amountMax", f.amountMax);
  if (f.type) params.append("type", f.type);
  if (f.paymentMode) params.append("paymentMode", f.paymentMode);
  if (f.month && f.view === "month" && !custom) params.append("month", f.month);
  if (page > 1) params.append("page", String(page));
  return params.toString();
}
