// Pure helpers for the Job Status board: customData normalisation, per-status counts, tab/search
// filtering and the optimistic job update. No React imports — see __tests__/statusCounts.test.ts.
//
// NOTE: the count rules and the tab-filter rules intentionally differ in a few edge cases
// (case-sensitivity, invalid delivery dates) because that is how the board has always behaved.
// The characterisation tests pin those differences; change them deliberately, not by accident.

export type JobCustomData = Record<string, any>;

export interface StatusBoardJob {
  id: string;
  jobNumber?: string | null;
  category?: string | null;
  date?: string | Date | null;
  status?: string | null;
  customData?: unknown;
  client?: { name?: string | null; phone?: string | null } | null;
  items?: unknown;
  [key: string]: unknown;
}

export interface StatusBoardUser {
  id: string;
  name: string;
  [key: string]: unknown;
}

export type JobStatusTab = "Pending" | "Overdue" | "Designing" | "Printing" | "Ready for Delivery";

export type JobStatusCounts = Record<JobStatusTab, number>;

/** customData arrives as a JSON string (server-serialised) or an object; bad JSON reads as `{}`. */
export function parseJobCustomData(raw: unknown): JobCustomData {
  try {
    return typeof raw === "string" ? JSON.parse(raw) : ((raw as JobCustomData) || {});
  } catch {
    return {};
  }
}

/** The delivery date used by the Overdue card and tab. */
export function getJobDeliveryDate(cd: JobCustomData): string | undefined {
  return cd.job_delivery_date || cd.delivery_date;
}

/** Status as used by the tab filters: trimmed + lower-cased, defaulting to "pending". */
export function normaliseJobStatus(cd: JobCustomData): string {
  return (cd.fld_b_status || "pending").trim().toLowerCase();
}

/**
 * Overdue as counted on the summary card: has a valid delivery date in the past and is not delivered.
 * (An unparseable date is NOT counted.)
 */
function isOverdueForCount(cd: JobCustomData, now: Date): boolean {
  const deliveryDateStr = getJobDeliveryDate(cd);
  if (deliveryDateStr) {
    const deliveryDate = new Date(deliveryDateStr);
    const aStatus = (cd.fld_b_status || "").trim().toLowerCase();
    if (deliveryDate < now && aStatus !== "delivered") return true;
  }
  return false;
}

/** All summary-card counts in a single pass over the jobs. */
export function countJobsByStatus(jobs: readonly StatusBoardJob[] | null | undefined, now: Date = new Date()): JobStatusCounts {
  const counts: JobStatusCounts = { Pending: 0, Designing: 0, Printing: 0, "Ready for Delivery": 0, Overdue: 0 };
  const arr = Array.isArray(jobs) ? jobs : (jobs ?? []);
  for (const job of arr) {
    const cd = parseJobCustomData(job.customData);
    // Exact (case-sensitive) matches, as the cards always counted.
    if ((cd.fld_b_status || "Pending") === "Pending") counts.Pending++;
    if (cd.fld_b_status === "Designing") counts.Designing++;
    if (cd.fld_b_status === "Printing") counts.Printing++;
    if (cd.fld_b_status === "Ready for Delivery") counts["Ready for Delivery"]++;
    if (isOverdueForCount(cd, now)) counts.Overdue++;
  }
  return counts;
}

/**
 * Whether a job belongs in the given tab. Status tabs compare case-insensitively; the Overdue tab
 * keeps any job whose delivery date is not on/after `now` (so an unparseable date is included).
 * Unknown tabs match everything.
 */
export function matchesStatusTab(cd: JobCustomData, tab: string, now: Date = new Date()): boolean {
  const aStatus = normaliseJobStatus(cd);
  if (tab === "Pending" && aStatus !== "pending") return false;
  if (tab === "Designing" && aStatus !== "designing") return false;
  if (tab === "Printing" && aStatus !== "printing") return false;
  if (tab === "Ready for Delivery" && aStatus !== "ready for delivery") return false;
  if (tab === "Overdue") {
    const deliveryDateStr = getJobDeliveryDate(cd);
    if (!deliveryDateStr) return false;
    const deliveryDate = new Date(deliveryDateStr);
    if (deliveryDate >= now || aStatus === "delivered") return false;
  }
  return true;
}

/** Free-text search over client name/phone, job number, category, designer name and id. */
export function matchesJobSearch(
  job: StatusBoardJob,
  cd: JobCustomData,
  searchQuery: string,
  teamUsers: readonly StatusBoardUser[] = [],
): boolean {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  const designerId = cd.designer;
  const designerUser = teamUsers?.find((u) => u.id === designerId);
  const designerName: string = designerUser ? designerUser.name : designerId || "";

  return (
    (job.client?.name || "").toLowerCase().includes(q) ||
    (job.client?.phone || "").toLowerCase().includes(q) ||
    (job.jobNumber || "").toLowerCase().includes(q) ||
    (job.category || "").toLowerCase().includes(q) ||
    designerName.toLowerCase().includes(q) ||
    job.id.toLowerCase().includes(q)
  );
}

export interface JobStatusFilter {
  tab: string;
  searchQuery?: string;
  teamUsers?: readonly StatusBoardUser[];
  now?: Date;
}

export function filterJobsForStatusBoard<T extends StatusBoardJob>(jobs: readonly T[], filter: JobStatusFilter): T[] {
  const now = filter.now ?? new Date();
  return jobs.filter((job) => {
    const cd = parseJobCustomData(job.customData);
    if (!matchesStatusTab(cd, filter.tab, now)) return false;
    return matchesJobSearch(job, cd, filter.searchQuery ?? "", filter.teamUsers);
  });
}

export interface JobTrackingUpdate {
  status?: string;
  customData?: JobCustomData;
}

/**
 * The optimistic version of a tracking update: merges customData (re-serialised as a string) and
 * overrides status when given. Like before, invalid customData JSON throws here.
 */
export function applyJobTrackingUpdate<T extends StatusBoardJob>(job: T, updates: JobTrackingUpdate): T {
  let newCustomData = typeof job.customData === "string" ? JSON.parse(job.customData) : (job.customData || {});
  if (updates.customData) {
    newCustomData = { ...newCustomData, ...updates.customData };
  }
  return {
    ...job,
    status: updates.status !== undefined ? updates.status : job.status,
    customData: JSON.stringify(newCustomData),
  };
}

export interface Page<T> {
  items: T[];
  totalPages: number;
  /** The requested page clamped to the last page. */
  page: number;
}

export function paginate<T>(items: readonly T[], requestedPage: number, perPage: number): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const page = Math.min(requestedPage, totalPages);
  return { items: items.slice((page - 1) * perPage, page * perPage), totalPages, page };
}
