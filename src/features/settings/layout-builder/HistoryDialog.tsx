"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { diffLayouts, summarizeChanges } from "@/lib/layout-builder/diff";
import type { FormLayout } from "@/lib/layout-builder/types";
import type { LayoutVersion } from "./useLayoutBuilder";

interface HistoryDialogProps {
  open: boolean;
  versions: LayoutVersion[];
  loading: boolean;
  liveVersion: number | null | undefined;
  /** The draft currently in the editor, to show how far it has moved from each version. */
  draft: FormLayout["schema"];
  onRestore: (v: LayoutVersion) => void;
  onClose: () => void;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Publish history: who published what, the field-level changes of each version, and a way back. */
export default function HistoryDialog({ open, versions, loading, liveVersion, draft, onRestore, onClose }: HistoryDialogProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[620px] sm:max-w-[620px] rounded-2xl p-0 overflow-hidden border-0">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-extrabold text-slate-900">Version history</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-600">Every publish, newest first. Restoring loads a version into the draft; publish it to make it live again.</DialogDescription>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400"><div className="w-5 h-5 border-2 border-slate-300 border-t-orange-500 rounded-full animate-spin mr-3"></div> Loading history…</div>
          ) : versions.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nothing published yet. The first publish creates version 1.</p>
          ) : (
            <ol className="space-y-2">
              {versions.map((v, i) => {
                const previous = versions[i + 1];
                const changes = previous ? diffLayouts(previous.schema as never, v.schema as never) : [];
                const isLive = v.version === liveVersion;
                const draftDiff = diffLayouts(v.schema as never, draft as never).length;
                const isOpen = expanded === v.version;
                return (
                  <li key={v.id} className={`rounded-2xl border ${isLive ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 ${isLive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>v{v.version}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900">{v.note || (i === versions.length - 1 ? "First version" : "Published")}</span>
                          {isLive && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-emerald-700">Live</span>}
                        </div>
                        <p className="text-[0.75rem] text-slate-500 mt-0.5">
                          {v.authorName || "System"} · {when(v.createdAt)}{previous ? ` · ${summarizeChanges(changes)}` : ""}
                          {draftDiff === 0 ? " · same as your draft" : ""}
                        </p>
                        {isOpen && previous && (
                          <ul className="mt-2 space-y-1">
                            {changes.length === 0 ? <li className="text-[0.78rem] text-slate-500">Identical to v{previous.version}.</li> : changes.map((c, idx) => (
                              <li key={idx} className={`flex items-start gap-2 text-[0.78rem] ${c.affectsData ? "text-amber-800" : "text-slate-700"}`}>
                                <i className={`ph-bold mt-0.5 ${c.affectsData ? "ph-warning text-amber-500" : "ph-dot-outline text-slate-300"}`}></i>{c.text}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {previous && (
                          <button type="button" onClick={() => setExpanded(isOpen ? null : v.version)} className="rounded-lg px-2.5 py-1.5 text-[0.72rem] font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                            {isOpen ? "Hide changes" : "Changes"}
                          </button>
                        )}
                        {draftDiff > 0 && (
                          <button type="button" onClick={() => onRestore(v)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[0.72rem] font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors">
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
