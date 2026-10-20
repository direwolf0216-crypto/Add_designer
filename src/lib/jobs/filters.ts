// Job list filters, carried in the URL so the server can filter before paginating and the export
// uses exactly the same query. Isomorphic: no server-only imports here.
import type { FilterState } from "@/types";

export const EMPTY_JOB_FILTERS: FilterState = {
  categories: [],
  statuses: [],
  clientName: "",
  location: "",
  dateStart: "",
  dateEnd: "",
  amountMin: "",
  amountMax: "",
};

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(params: ParamSource, key: string): string {
  if (params instanceof URLSearchParams) return params.get(key) ?? "";
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

const list = (v: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const isoDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const amount = (v: string) => (v && Number.isFinite(Number(v)) ? v : "");

export function parseJobFilters(params: ParamSource): FilterState {
  return {
    categories: list(read(params, "categories")),
    statuses: list(read(params, "statuses")),
    clientName: read(params, "client").slice(0, 100),
    location: read(params, "location").slice(0, 100),
    dateStart: isoDate(read(params, "from")),
    dateEnd: isoDate(read(params, "to")),
    amountMin: amount(read(params, "min")),
    amountMax: amount(read(params, "max")),
  };
}

/** Write filters into a copy of `base`, dropping empty values and resetting pagination. */
export function jobFiltersToParams(filters: FilterState, base?: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
  set("categories", filters.categories.join(","));
  set("statuses", filters.statuses.join(","));
  set("client", filters.clientName.trim());
  set("location", filters.location.trim());
  set("from", filters.dateStart);
  set("to", filters.dateEnd);
  set("min", filters.amountMin);
  set("max", filters.amountMax);
  p.delete("page");
  return p;
}

export function hasJobFilters(f: FilterState): boolean {
  return Boolean(
    f.categories.length || f.statuses.length || f.clientName || f.location || f.dateStart || f.dateEnd || f.amountMin || f.amountMax
  );
}
