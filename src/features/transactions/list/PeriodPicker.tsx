"use client";

import DatePickerInput from "@/components/ui/DatePickerInput";
import { toLocalISODate } from "@/lib/dates";
import type { TransactionUrlFilters } from "@/lib/transactions/filters";
import { ViewSelectorCard } from "./ViewSelectorCard";

interface PeriodPickerProps {
  filters: TransactionUrlFilters;
  onViewChange: (view: string) => void;
  onDayChange: (day: string) => void;
  onWeekChange: (dateInWeek: string) => void;
  onMonthChange: (dateInMonth: string) => void;
}

/** Preset view dropdown plus the matching day / week / month picker. */
export function PeriodPicker({ filters: filterParams, onViewChange, onDayChange, onWeekChange, onMonthChange }: PeriodPickerProps) {
  const activeView = filterParams.view;

  return (
    <>
      <ViewSelectorCard
        value={activeView ?? ''}
        onChange={(val) => onViewChange(val)}
      />

      {activeView === 'day' && (
        <div className="w-[140px]">
          <DatePickerInput
            value={(filterParams.dateFrom && filterParams.dateFrom === filterParams.dateTo) ? filterParams.dateFrom : toLocalISODate()}
            onChange={onDayChange}
            placeholder="Select Day"
            mode="day"
          />
        </div>
      )}

      {activeView === 'week' && (
        <div className="w-[200px]">
          <DatePickerInput
            value={(filterParams.dateFrom && filterParams.dateTo) ? filterParams.dateFrom : toLocalISODate()}
            onChange={onWeekChange}
            placeholder="Select Week"
            mode="week"
          />
        </div>
      )}

      {activeView === 'month' && (
        <div className="w-[160px]">
          <DatePickerInput
            value={filterParams.month ? `${filterParams.month}-01` : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`}
            onChange={onMonthChange}
            placeholder="Select Month"
            mode="month"
          />
        </div>
      )}
    </>
  );
}
