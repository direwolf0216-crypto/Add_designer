"use client";

import React, { useState } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DatePickerInput from '@/components/ui/DatePickerInput';

type DateRange = { startDate: Date; endDate: Date };
type RangeOption = 'Today' | 'This Week' | 'This Month' | 'Custom';

interface DashboardDateRangePickerProps {
  /** Called with the new range and the period in words ("this week", "1 Oct – 15 Oct"). */
  onRangeChange: (range: DateRange | null, label?: string) => void;
}

const OPTIONS: { label: string; value: RangeOption }[] = [
  { label: 'Today', value: 'Today' },
  { label: 'This week', value: 'This Week' },
  { label: 'This month', value: 'This Month' },
  { label: 'Custom', value: 'Custom' },
];

/** The dashboard's period: a 32px outlined control that opens a short menu. */
export default function DashboardDateRangePicker({ onRangeChange }: DashboardDateRangePickerProps) {
  const [selected, setSelected] = useState<RangeOption>('This Month');
  const [open, setOpen] = useState(false);
  // Custom range: chosen in the menu with two date fields, applied with a button.
  const [customOpen, setCustomOpen] = useState(false);
  const [from, setFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [customLabel, setCustomLabel] = useState('Custom');

  const ranges: Record<RangeOption, DateRange> = {
    'Today': { startDate: new Date(), endDate: new Date() },
    'This Week': { startDate: startOfWeek(new Date()), endDate: endOfWeek(new Date()) },
    'This Month': { startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()) },
    'Custom': { startDate: new Date(), endDate: new Date() }, // Fallback for custom
  };

  const handleSelect = (val: string) => {
    const option = val as RangeOption;
    if (option === 'Custom') {
      setCustomOpen(true);
      return;
    }
    setSelected(option);
    setCustomOpen(false);
    setOpen(false);
    onRangeChange(ranges[option], OPTIONS.find((o) => o.value === option)!.label.toLowerCase());
  };

  const current = OPTIONS.find((o) => o.value === selected)!;
  const parse = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, (m || 1) - 1, day || 1);
  };
  const fromDate = parse(from);
  const toDate = parse(to);
  const customValid = fromDate <= toDate;

  const applyCustom = () => {
    if (!customValid) return;
    const sameYear = fromDate.getFullYear() === toDate.getFullYear();
    const label = `${format(fromDate, sameYear ? 'd MMM' : 'd MMM yyyy')} – ${format(toDate, 'd MMM yyyy')}`;
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    setSelected('Custom');
    setCustomLabel(label);
    setCustomOpen(false);
    setOpen(false);
    onRangeChange({ startDate: fromDate, endDate: end }, label);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`Period: ${current.label}`}
        className="inline-flex h-11 min-w-[160px] items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 pl-4 pr-3 text-[0.95rem] font-semibold text-slate-800 shadow-sm outline-none backdrop-blur transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-orange-400 aria-expanded:ring-2 aria-expanded:ring-orange-200"
      >
        <span className="flex items-center gap-2">
          <i className="ph-bold ph-calendar-blank text-[17px] text-orange-500" aria-hidden="true"></i>
          {selected === 'Custom' ? customLabel : current.label}
        </span>
        <i className="ph-bold ph-caret-down text-[12px] text-slate-400" aria-hidden="true"></i>
      </PopoverTrigger>
      <PopoverContent align="end" className={`${customOpen ? 'w-72' : 'w-48'} gap-0 rounded-2xl p-1.5`} role="listbox" aria-label="Period">
        {OPTIONS.map((opt) => {
          const isSelected = opt.value === selected;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(opt.value)}
              className={`flex h-9 w-full items-center justify-between rounded-xl px-3 text-left text-[14px] outline-none transition-colors focus-visible:bg-raised ${
                isSelected ? 'bg-orange-50 font-semibold text-orange-600' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
              {isSelected && <i className="ph ph-check text-[14px]" aria-hidden="true"></i>}
            </button>
          );
        })}
        {customOpen && (
          <div className="mt-1 flex flex-col gap-2 border-t border-slate-100 px-1.5 pb-1 pt-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
              From
              <DatePickerInput value={from} onChange={setFrom} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
              To
              <DatePickerInput value={to} onChange={setTo} />
            </label>
            {!customValid && <p className="text-xs font-medium text-rose-500">“To” must be on or after “From”.</p>}
            <button
              type="button"
              onClick={applyCustom}
              disabled={!customValid}
              className="mt-1 h-9 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-sm font-bold text-white shadow-md shadow-orange-500/25 transition-opacity disabled:opacity-50"
            >
              Apply range
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
