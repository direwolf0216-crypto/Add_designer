import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { userCan } from "@/lib/auth/session";
import { jobScope } from "@/lib/jobs/scope";
import { stageOptions, type StageOption } from "@/lib/jobs/tracking";
import { addDays, businessTodayUtc } from "@/lib/dates";

// ---------------------------------------------------------------------------------------------
// URL state
// ---------------------------------------------------------------------------------------------

export type WorkspaceView = "board" | "list" | "schedule";
export type WorkspaceScope = "mine" | "all";
export type WorkspaceFocus = "active" | "due_today" | "overdue" | "unassigned" | "ready";
export type WorkspaceSort = "due" | "order" | "client" | "amount" | "updated";

export type WorkspaceParams = {
  view: WorkspaceView;
  scope: WorkspaceScope;
  q: string;
  stages: string[];
  categories: string[];
  assignee: string; // user id | "unassigned" | ""
  from: string; // due date yyyy-MM-dd
  to: string;
  focus: WorkspaceFocus | "";
  sort: WorkspaceSort;
  dir: "asc" | "desc";
  page: number;
  /** Board: stage whose column is expanded beyond the first cards. */
  more: string;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (p: Raw, k: string) => {
  const v = p[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};
const list = (v: string) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30) : []);
const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(v) ? (v as T) : fallback);

export function parseWorkspaceParams(p: Raw, canSeeAll: boolean): WorkspaceParams {
  return {
    view: pick(one(p, "view"), ["board", "list", "schedule"] as const, "board"),
    // People limited to their own jobs always get "mine".
    scope: canSeeAll ? pick(one(p, "scope"), ["mine", "all"] as const, "all") : "mine",
    q: one(p, "q").trim().slice(0, 100),
    stages: list(one(p, "stages")),
    categories: list(one(p, "categories")),
    assignee: one(p, "assignee").slice(0, 64),
    from: iso(one(p, "from")),
    to: iso(one(p, "to")),
    focus: pick(one(p, "focus"), ["active", "due_today", "overdue", "unassigned", "ready", ""] as const, ""),
    sort: pick(one(p, "sort"), ["due", "order", "client", "amount", "updated"] as const, "due"),
    dir: one(p, "dir") === "desc" ? "desc" : "asc",
    page: Math.max(1, Math.min(10000, Number(one(p, "page")) || 1)),
    more: one(p, "more").slice(0, 100),
  };
}

// ---------------------------------------------------------------------------------------------
// Query building
// ---------------------------------------------------------------------------------------------

const CLOSED = ["Delivered", "Cancelled"];
const insensitiveIn = (values: string[]) => values.map((v) => ({ stage: { equals: v, mode: "insensitive" as const } }));

/** Stage filter where the first board stage also matches jobs that have no stage yet. */
function stageWhere(stages: string[], firstStage: string): Prisma.JobWhereInput {
  const or: Prisma.JobWhereInput[] = insensitiveIn(stages);
  if (stages.some((s) => s.toLowerCase() === firstStage.toLowerCase())) or.push({ stage: null });
  return { OR: or };
}

const ACTIVE: Prisma.JobWhereInput = { NOT: { OR: insensitiveIn(CLOSED) } };

function focusWhere(focus: WorkspaceParams["focus"], today: Date, readyStage: string): Prisma.JobWhereInput {
  switch (focus) {
    case "active":
      return ACTIVE;
    case "due_today":
      return { AND: [ACTIVE, { dueDate: { gte: today, lt: addDays(today, 1) } }] };
    case "overdue":
      return { AND: [ACTIVE, { dueDate: { lt: today } }] };
    case "unassigned":
      return { AND: [ACTIVE, { assignments: { none: {} } }] };
    case "ready":
      return { stage: { equals: readyStage, mode: "insensitive" } };
    default:
      return {};
  }
}

const CARD_SELECT = {
  id: true,
  jobNumber: true,
  category: true,
  stage: true,
  dueDate: true,
  date: true,
  location: true,
  updatedAt: true,
  client: { select: { name: true, phone: true } },
  order: { select: { package: true, advance: true, due: true } },
  assignments: { select: { userId: true, user: { select: { id: true, name: true, image: true } } } },
} satisfies Prisma.JobSelect;

type CardRow = Prisma.JobGetPayload<{ select: typeof CARD_SELECT }>;

export type WorkspaceJob = {
  id: string;
  jobNumber: string | null;
  clientName: string;
  clientPhone: string;
  category: string;
  stage: string;
  dueDate: string | null; // yyyy-MM-dd
  orderDate: string;
  location: string;
  /** null when the viewer's role can't see amounts. */
  amount: number | null;
  paid: number | null;
  balance: number | null;
  assignees: { userId: string; user: { id: string; name: string | null; image: string | null } }[];
};

function toCard(r: CardRow, firstStage: string, showAmounts: boolean): WorkspaceJob {
  return {
    id: r.id,
    jobNumber: r.jobNumber,
    clientName: r.client.name,
    clientPhone: r.client.phone,
    category: r.category,
    stage: r.stage || firstStage,
    dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    orderDate: r.date.toISOString().slice(0, 10),
    location: r.location,
    amount: showAmounts ? r.order?.package ?? 0 : null,
    paid: showAmounts ? r.order?.advance ?? 0 : null,
    balance: showAmounts ? r.order?.due ?? 0 : null,
    assignees: r.assignments,
  };
}

const ORDER: Record<WorkspaceSort, (dir: "asc" | "desc") => Prisma.JobOrderByWithRelationInput[]> = {
  due: (dir) => [{ dueDate: { sort: dir, nulls: "last" } }, { date: "desc" }],
  order: (dir) => [{ date: dir }],
  client: (dir) => [{ client: { name: dir } }],
  amount: (dir) => [{ order: { package: dir } }],
  updated: (dir) => [{ updatedAt: dir }],
};

// ---------------------------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------------------------

export type WorkspaceData = Awaited<ReturnType<typeof loadJobsWorkspace>>;

const BOARD_CARDS = 25;
const BOARD_EXPANDED = 100;
const LIST_PAGE = 20;
const SCHEDULE_DAYS = 14;

/** Resolve the URL state into Prisma filters (shared by the workspace views and the export). */
export async function buildWorkspaceQuery(user: SessionUser, raw: Raw) {
  const [canSeeAll, canSeeAmounts] = await Promise.all([userCan(user, "view_all_jobs"), userCan(user, "view_amounts")]);
  const params = parseWorkspaceParams(raw, canSeeAll);
  // Sorting by a hidden amount would leak the ordering.
  if (params.sort === "amount" && !canSeeAmounts) params.sort = "due";
  const [layout, visibility] = await Promise.all([
    prisma.formLayout.findUnique({ where: { formKey: "JOB_FORM" }, select: { schema: true } }),
    jobScope(user),
  ]);
  const stages: StageOption[] = stageOptions(layout?.schema as Parameters<typeof stageOptions>[0]);
  const firstStage = stages[0]?.label ?? "Pending";
  const readyStage = stages.find((s) => /ready/i.test(s.label))?.label ?? "Ready for Delivery";
  const categories = categoryOptions(layout?.schema);
  const today = businessTodayUtc();

  const mine: Prisma.JobWhereInput = { assignments: { some: { userId: user.id } } };
  const base: Prisma.JobWhereInput = { deletedAt: null, ...visibility, ...(params.scope === "mine" ? { AND: [mine] } : {}) };

  const filters: Prisma.JobWhereInput[] = [];
  if (params.q) {
    const contains = { contains: params.q, mode: "insensitive" as const };
    filters.push({
      OR: [{ jobNumber: contains }, { category: contains }, { location: contains }, { client: { name: contains } }, { client: { phone: contains } }],
    });
  }
  if (params.stages.length) filters.push(stageWhere(params.stages, firstStage));
  if (params.categories.length) filters.push({ category: { in: params.categories } });
  if (params.assignee === "unassigned") filters.push({ assignments: { none: {} } });
  else if (params.assignee) filters.push({ assignments: { some: { userId: params.assignee } } });
  if (params.from || params.to) {
    filters.push({
      dueDate: {
        ...(params.from ? { gte: new Date(`${params.from}T00:00:00Z`) } : {}),
        ...(params.to ? { lt: addDays(new Date(`${params.to}T00:00:00Z`), 1) } : {}),
      },
    });
  }
  const focus = focusWhere(params.focus, today, readyStage);
  // Stats ignore the quick-filter focus (they are the focus buttons) but respect everything else.
  const filtered: Prisma.JobWhereInput = { ...base, AND: [...((base.AND as Prisma.JobWhereInput[]) ?? []), ...filters] };
  const where: Prisma.JobWhereInput = { ...filtered, AND: [...(filtered.AND as Prisma.JobWhereInput[]), focus] };
  return { canSeeAll, canSeeAmounts, params, stages, firstStage, readyStage, categories, today, visibility, mine, filtered, where };
}

/** Rows for CSV/PDF export with the current filters (capped). */
export async function loadWorkspaceExport(user: SessionUser, raw: Raw, limit = 5000) {
  const { where, firstStage, params, canSeeAmounts } = await buildWorkspaceQuery(user, raw);
  const rows = await prisma.job.findMany({ where, select: CARD_SELECT, orderBy: ORDER[params.sort](params.dir), take: limit });
  return { canSeeAmounts, jobs: rows.map((r) => toCard(r, firstStage, canSeeAmounts)) };
}

export async function loadJobsWorkspace(user: SessionUser, raw: Raw) {
  const { canSeeAll, canSeeAmounts, params, stages, firstStage, readyStage, categories, today, visibility, mine, filtered, where } = await buildWorkspaceQuery(user, raw);

  const statsWhere = (extra: Prisma.JobWhereInput) => ({ ...filtered, AND: [...(filtered.AND as Prisma.JobWhereInput[]), extra] });
  const statsPromise = Promise.all([
    prisma.job.count({ where: statsWhere(focusWhere("active", today, readyStage)) }),
    prisma.job.count({ where: statsWhere(focusWhere("due_today", today, readyStage)) }),
    prisma.job.count({ where: statsWhere(focusWhere("overdue", today, readyStage)) }),
    prisma.job.count({ where: statsWhere(focusWhere("unassigned", today, readyStage)) }),
    prisma.job.count({ where: statsWhere(focusWhere("ready", today, readyStage)) }),
    // Scope switch badge: how many open jobs are assigned to me.
    prisma.job.count({ where: { deletedAt: null, ...visibility, AND: [mine, ACTIVE] } }),
  ]).then(([active, dueToday, overdue, unassigned, ready, mineActive]) => ({ active, dueToday, overdue, unassigned, ready, mineActive }));

  let board: { stage: string; color: string; count: number; jobs: WorkspaceJob[]; expanded: boolean }[] | null = null;
  let listData: { jobs: WorkspaceJob[]; total: number; page: number; pageSize: number } | null = null;
  let schedule: { overdue: WorkspaceJob[]; days: { date: string; jobs: WorkspaceJob[] }[]; undated: number } | null = null;

  if (params.view === "board") {
    // Cancelled stays off the board unless explicitly filtered for.
    const columns = stages.filter((s) => !/cancel/i.test(s.label) || params.stages.some((x) => x.toLowerCase() === s.label.toLowerCase()));
    board = await Promise.all(
      columns.map(async (s) => {
        const colWhere: Prisma.JobWhereInput = { ...where, AND: [...(where.AND as Prisma.JobWhereInput[]), stageWhere([s.label], firstStage)] };
        const expanded = params.more.toLowerCase() === s.label.toLowerCase();
        const [count, rows] = await Promise.all([
          prisma.job.count({ where: colWhere }),
          prisma.job.findMany({ where: colWhere, select: CARD_SELECT, orderBy: ORDER.due("asc"), take: expanded ? BOARD_EXPANDED : BOARD_CARDS }),
        ]);
        return { stage: s.label, color: s.color, count, jobs: rows.map((r) => toCard(r, firstStage, canSeeAmounts)), expanded };
      })
    );
  } else if (params.view === "list") {
    const [total, rows] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({ where, select: CARD_SELECT, orderBy: ORDER[params.sort](params.dir), skip: (params.page - 1) * LIST_PAGE, take: LIST_PAGE }),
    ]);
    listData = { jobs: rows.map((r) => toCard(r, firstStage, canSeeAmounts)), total, page: params.page, pageSize: LIST_PAGE };
  } else {
    const end = addDays(today, SCHEDULE_DAYS);
    const scheduleWhere = (extra: Prisma.JobWhereInput) => ({ ...where, AND: [...(where.AND as Prisma.JobWhereInput[]), ACTIVE, extra] });
    const [overdueRows, upcomingRows, undated] = await Promise.all([
      prisma.job.findMany({ where: scheduleWhere({ dueDate: { lt: today } }), select: CARD_SELECT, orderBy: [{ dueDate: "asc" }], take: 50 }),
      prisma.job.findMany({ where: scheduleWhere({ dueDate: { gte: today, lt: end } }), select: CARD_SELECT, orderBy: [{ dueDate: "asc" }, { date: "asc" }], take: 400 }),
      prisma.job.count({ where: scheduleWhere({ dueDate: null }) }),
    ]);
    const byDay = new Map<string, WorkspaceJob[]>();
    for (let i = 0; i < SCHEDULE_DAYS; i++) byDay.set(addDays(today, i).toISOString().slice(0, 10), []);
    for (const r of upcomingRows) byDay.get(r.dueDate!.toISOString().slice(0, 10))?.push(toCard(r, firstStage, canSeeAmounts));
    schedule = {
      overdue: overdueRows.map((r) => toCard(r, firstStage, canSeeAmounts)),
      days: [...byDay].map(([date, jobs]) => ({ date, jobs })),
      undated,
    };
  }

  return {
    params,
    canSeeAll,
    canSeeAmounts,
    stages,
    categories,
    stats: await statsPromise,
    board,
    list: listData,
    schedule,
    today: today.toISOString().slice(0, 10),
  };
}

function categoryOptions(schema: unknown): string[] {
  const sections = (schema as { sections?: { fields?: { id?: string; options?: unknown[] }[] }[] } | null)?.sections ?? [];
  for (const s of sections) {
    for (const f of s.fields ?? []) {
      if (f.id === "fld_b_job_category" && Array.isArray(f.options)) {
        return f.options.map((o) => (typeof o === "string" ? o : (o as { label?: string })?.label)).filter((o): o is string => !!o);
      }
    }
  }
  return [];
}
