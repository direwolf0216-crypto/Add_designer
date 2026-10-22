"use client";

import type { ReactNode } from "react";
import type { SaveAction } from "./useLayoutBuilder";

export type EditorStatus = "unsaved" | "draft" | "live";

interface EditorHeaderProps {
  title: string;
  version: number | null | undefined;
  status: EditorStatus;
  saving: SaveAction | null;
  canUndo: boolean;
  canRedo: boolean;
  canPreview: boolean;
  canPublish: boolean;
  onBack: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onHistory: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  /** Overflow menu (export, import, templates). */
  menu?: ReactNode;
}

const iconButton =
  "w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500";
const secondary =
  "hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors disabled:opacity-40";

const STATUS: Record<EditorStatus, { label: string; cls: string; dot?: boolean; icon?: string }> = {
  unsaved: { label: "Unsaved", cls: "text-amber-700 bg-amber-50 border-amber-200", dot: true },
  draft: { label: "Draft · not live", cls: "text-violet-700 bg-violet-50 border-violet-200", icon: "ph-pencil-simple" },
  live: { label: "Live", cls: "text-emerald-700 bg-emerald-50 border-emerald-200", icon: "ph-check" },
};

export default function EditorHeader({ title, version, status, saving, canUndo, canRedo, canPreview, canPublish, onBack, onSaveDraft, onPublish, onHistory, onUndo, onRedo, onPreview, menu }: EditorHeaderProps) {
  const s = STATUS[status];
  return (
    <div className="min-h-[4rem] border-b border-gray-200 bg-white flex flex-wrap items-center justify-between px-3 py-2 sm:px-5 shrink-0 gap-x-4 gap-y-2">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onBack} aria-label="Back to form layouts" className={iconButton}>
          <i className="ph-bold ph-arrow-left text-lg"></i>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-orange-100 text-orange-600 text-[0.65rem] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">Layout Editor</span>
            <span className={`inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-md ${s.cls}`}>
              {s.dot ? <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> : <i className={`ph-bold ${s.icon}`}></i>} {s.label}
            </span>
            {version ? <span className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">v{version} live</span> : null}
          </div>
          <h2 className="font-extrabold text-slate-900 text-lg leading-tight truncate">{title}</h2>
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 mr-1">
          <button onClick={onUndo} disabled={!canUndo} title="Undo (⌘Z)" aria-label="Undo" className={iconButton}>
            <i className="ph-bold ph-arrow-u-up-left text-lg"></i>
          </button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (⇧⌘Z)" aria-label="Redo" className={iconButton}>
            <i className="ph-bold ph-arrow-u-up-right text-lg"></i>
          </button>
        </div>
        <button onClick={onHistory} title="Version history" className={secondary}>
          <i className="ph-bold ph-clock-counter-clockwise"></i> History
        </button>
        <button onClick={onHistory} aria-label="Version history" className={`sm:hidden ${iconButton}`}>
          <i className="ph-bold ph-clock-counter-clockwise text-lg"></i>
        </button>
        <button onClick={onPreview} disabled={!canPreview} title={canPreview ? "Open the real form with this draft" : "Preview is available for the Job and Transaction forms"} className={secondary}>
          <i className="ph-bold ph-eye"></i> Preview
        </button>
        <button onClick={onPreview} disabled={!canPreview} aria-label="Preview" className={`sm:hidden ${iconButton}`}>
          <i className="ph-bold ph-eye text-lg"></i>
        </button>
        <button
          onClick={onSaveDraft}
          disabled={!!saving || status !== "unsaved"}
          title="Keep your work without changing the live form (⌘S)"
          className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          {saving === "draft" ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin"></div> : <i className="ph-bold ph-floppy-disk"></i>}
          Save draft
        </button>
        <button
          onClick={onPublish}
          disabled={!!saving || !canPublish}
          title={canPublish ? "Make this layout live for everyone" : "Nothing to publish: the live form already matches"}
          className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-40 flex items-center gap-2"
        >
          {saving === "publish" ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <i className="ph-bold ph-rocket-launch"></i>}
          Publish
        </button>
        {menu}
      </div>
    </div>
  );
}
