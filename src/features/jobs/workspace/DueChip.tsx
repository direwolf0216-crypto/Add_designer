import { differenceInCalendarDays, format, parseISO } from "date-fns";

/** Due date with urgency: overdue (red), today/tomorrow (amber), later (neutral). */
export default function DueChip({ due, today, closed = false }: { due: string | null; today: string; closed?: boolean }) {
  if (!due) return <span className="text-xs font-semibold text-slate-400">No due date</span>;
  const days = differenceInCalendarDays(parseISO(due), parseISO(today));
  const label = days === 0 ? "Due today" : days === 1 ? "Tomorrow" : days < 0 ? `${-days}d overdue` : format(parseISO(due), "d MMM");
  const tone = closed
    ? "bg-slate-100 text-slate-500"
    : days < 0
      ? "bg-rose-50 text-rose-600 ring-rose-100"
      : days <= 1
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-slate-50 text-slate-600 ring-slate-100";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-0.5 text-[0.7rem] font-bold ring-1 ${tone}`} title={format(parseISO(due), "EEE, d MMM yyyy")}>
      <i className={`ph-bold ${days < 0 && !closed ? "ph-warning-circle" : "ph-calendar-blank"}`} aria-hidden="true"></i>
      {label}
    </span>
  );
}
