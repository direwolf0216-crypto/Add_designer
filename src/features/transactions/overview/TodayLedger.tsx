"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { groupLedgerTransactions } from "@/lib/transactions/grouping";
import type { TransactionRecord } from "@/lib/transactions/types";
import { TransactionRow } from "./TransactionRow";
import { formatINR } from "@/lib/money";
import Amount from "@/components/data/Amount";
import css from "./TodayLedger.module.css";
import { hasOtherModes, type ModeKey, type ModeSplit } from "@/lib/transactions/paymentModes";

const MODES: { key: ModeKey; label: string; icon: string }[] = [
  { key: "cash", label: "Cash", icon: "ph-fill ph-money text-emerald-400" },
  { key: "upi", label: "UPI", icon: "ph-bold ph-qr-code text-indigo-300" },
  { key: "bank", label: "Bank", icon: "ph-bold ph-bank text-sky-300" },
  { key: "other", label: "Other", icon: "ph-bold ph-dots-three-circle text-slate-400" },
];

/** Cash / UPI / Bank (and Other, when used today) as a small list beside one of the day's figures. */
function ModeList({ byMode, figure, signed = false }: { byMode: ModeSplit; figure: "income" | "expense" | "net"; signed?: boolean }) {
  const modes = hasOtherModes(byMode) ? MODES : MODES.slice(0, 3);
  return (
    <ul
      className="min-w-0 divide-y divide-white/[0.06] rounded-xl bg-white/[0.03] px-2.5 py-0.5 ring-1 ring-white/[0.07]"
      aria-label={`${figure} by payment mode`}
    >
      {modes.map((m) => {
        const value = byMode[m.key][figure];
        const tone = signed ? (value < 0 ? "text-red-400" : value > 0 ? "text-emerald-400" : "text-slate-300") : "text-slate-100";
        return (
          <li key={m.key} data-mode={m.key} className="flex min-w-0 items-center justify-between gap-3 py-1.5">
            <div className="flex shrink-0 items-center gap-1.5 text-[0.6rem] font-extrabold uppercase tracking-wider text-slate-400">
              <i className={`${m.icon} text-[0.8rem]`} aria-hidden="true" />
              {m.label}
            </div>
            <span className={`min-w-0 truncate text-right text-[0.8rem] font-bold tabular-nums ${tone}`}>
              {signed && value > 0 ? "+" : ""}
              <Amount value={value} maxChars={13} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const COLUMN_GAP = 14;

/**
 * Whether every figure card has room for its label and total and its payment-mode list side by side,
 * at full size. Measured from the real text widths, rechecked when the cards resize; all three cards
 * then lay out the same way.
 */
function useSideBySide(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(true);
  useLayoutEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const check = () => {
      let fits = true;
      strip.querySelectorAll<HTMLElement>("[data-today-figure]").forEach((card) => {
        const body = card.querySelector<HTMLElement>("[data-figure-body]");
        if (!body) return;
        const left = Math.max(
          ...[...card.querySelectorAll<HTMLElement>("[data-figure-head], [data-figure-total]")].map((el) => el.scrollWidth)
        );
        const list = Math.max(
          0,
          ...[...card.querySelectorAll<HTMLElement>("[data-mode]")].map((row) => {
            const [label, amount] = [...row.children] as HTMLElement[];
            const pad = parseFloat(getComputedStyle(row.parentElement!).paddingLeft) * 2;
            return label.scrollWidth + amount.scrollWidth + parseFloat(getComputedStyle(row).columnGap || "0") + pad;
          })
        );
        if (left + COLUMN_GAP + list > body.clientWidth) fits = false;
      });
      setSide(fits);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(strip);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, side };
}

interface TodayLedgerProps {
  today: Date;
  todayIncome: number;
  todayExpense: number;
  todayNet: number;
  /** The day's figures by payment mode, over every transaction today. */
  byMode: ModeSplit;
  todayTransactions: TransactionRecord[];
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  /** Deletes a transaction or `grp_…` group; rejects with an Error whose message is shown inline. */
  onDelete: (id: string) => Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
}

/** Dark "Today's Transactions" card: income / expense / net strip (each with its payment-mode list) and the grouped ledger with inline delete. */
export function TodayLedger({ today, todayIncome, todayExpense, todayNet, byMode, todayTransactions, onOpen, onEdit, onDelete, canEdit = true, canDelete = true }: TodayLedgerProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: string, message: string } | null>(null);
  const items = useMemo(() => groupLedgerTransactions(todayTransactions), [todayTransactions]);
  const { ref: stripRef, side } = useSideBySide([byMode, todayIncome, todayExpense, todayNet]);

  const handleDeleteConfirm = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setIsDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
      setConfirmDeleteId(null);
      setIsDeletingId(null);
    } catch (err) {
      setDeleteError({ id, message: (err as Error).message || "Failed to delete" });
      setIsDeletingId(null);
    }
  };

  return (
    <div className="relative rounded-[24px] overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-2xl mb-8 transition-transform duration-300 hover:-translate-y-1 group">
      {/* Animated Glow Orbs */}
      <div className="absolute -top-20 -left-20 w-72 h-72 bg-orange-500 rounded-full blur-[120px] opacity-15 group-hover:opacity-25 transition-opacity duration-700" />
      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-violet-500 rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity duration-700" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500 rounded-full blur-[160px] opacity-[0.04]" />

      {/* Header Bar */}
      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between px-5 sm:px-8 pt-5 sm:pt-7 pb-0 gap-3 sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <i className="ph-bold ph-receipt text-white text-lg" />
          </div>
          <div>
            <h3 className="text-white text-[1rem] sm:text-[1.15rem] font-extrabold tracking-tight leading-tight">Today&apos;s Transactions</h3>
            <p className="text-slate-400 text-[0.65rem] sm:text-[0.7rem] font-semibold tracking-wide uppercase">{today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      <div ref={stripRef} className="relative z-10 grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 px-5 sm:px-8 py-5">
        <Link href="/transactions/allTransactions?view=day&type=INCOME" className="block h-full outline-none">
          <div data-today-figure="income" className={`h-full bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors`}>
            <div data-figure-body className={side ? `${css.body} ${css.side}` : css.body}>
              <div className="min-w-0">
                <div data-figure-head className="mb-2 flex w-max max-w-full items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <i className="ph-bold ph-arrow-down-left text-emerald-400 text-xs" />
                  </div>
                  <span className="text-slate-400 text-[0.65rem] font-bold uppercase tracking-[1px]">Income</span>
                </div>
                <span data-figure-total className={`block w-max max-w-full whitespace-nowrap text-[1.5rem] text-white font-extrabold tracking-tight`}>{formatINR(todayIncome)}</span>
              </div>
              <ModeList byMode={byMode} figure="income" />
            </div>
          </div>
        </Link>
        <Link href="/transactions/allTransactions?view=day&type=EXPENSE" className="block h-full outline-none">
          <div data-today-figure="expense" className={`h-full bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors`}>
            <div data-figure-body className={side ? `${css.body} ${css.side}` : css.body}>
              <div className="min-w-0">
                <div data-figure-head className="mb-2 flex w-max max-w-full items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <i className="ph-bold ph-arrow-up-right text-red-400 text-xs" />
                  </div>
                  <span className="text-slate-400 text-[0.65rem] font-bold uppercase tracking-[1px]">Expense</span>
                </div>
                <span data-figure-total className={`block w-max max-w-full whitespace-nowrap text-[1.5rem] text-white font-extrabold tracking-tight`}>{formatINR(todayExpense)}</span>
              </div>
              <ModeList byMode={byMode} figure="expense" />
            </div>
          </div>
        </Link>
        <Link href="/transactions/allTransactions?view=day" className="block h-full outline-none">
          <div data-today-figure="net" className={`h-full bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-colors`}>
            <div data-figure-body className={side ? `${css.body} ${css.side}` : css.body}>
              <div className="min-w-0">
                <div data-figure-head className="mb-2 flex w-max max-w-full items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg ${todayNet >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
                    <i className={`ph-bold ${todayNet >= 0 ? 'ph-trend-up text-emerald-400' : 'ph-trend-down text-red-400'} text-xs`} />
                  </div>
                  <span className="text-slate-400 text-[0.65rem] font-bold uppercase tracking-[1px]">Net Today</span>
                </div>
                <span data-figure-total className={`block w-max max-w-full whitespace-nowrap text-[1.5rem] font-extrabold tracking-tight ${todayNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {todayNet > 0 ? '+' : ''}{formatINR(todayNet)}
                </span>
              </div>
              <ModeList byMode={byMode} figure="net" signed />
            </div>
          </div>
        </Link>
      </div>

      <div className="relative z-10 px-5 sm:px-8 pb-5 sm:pb-7">
        {todayTransactions.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm border border-dashed border-white/10 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
              <i className="ph ph-receipt text-3xl text-slate-500" />
            </div>
            <p className="text-slate-400 font-semibold text-sm">No transactions recorded today</p>
            <p className="text-slate-500 text-xs mt-1">Add your first transaction to see it here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1 sm:pr-2">
            {items.map((txn, idx) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                idx={idx}
                isConfirming={confirmDeleteId === txn.id}
                isDeleting={isDeletingId === txn.id}
                errorMessage={deleteError?.id === txn.id ? deleteError.message : null}
                onOpen={() => onOpen(txn.id)}
                onEdit={() => onEdit(txn.id)}
                onAskDelete={() => { setConfirmDeleteId(txn.id); setDeleteError(null); }}
                onCancelDelete={() => { setConfirmDeleteId(null); setDeleteError(null); }}
                onDismissError={() => setDeleteError(null)}
                onConfirmDelete={(e) => handleDeleteConfirm(e, txn.id)}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
