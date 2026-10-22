"use client";

interface EditorHeaderProps {
  title: string;
  saving: boolean;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPreview: boolean;
  onBack: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
}

const iconButton =
  "w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500";

export default function EditorHeader({ title, saving, dirty, canUndo, canRedo, canPreview, onBack, onSave, onUndo, onRedo, onPreview }: EditorHeaderProps) {
  return (
    <div className="min-h-[4rem] border-b border-gray-200 bg-white flex flex-wrap items-center justify-between px-3 py-2 sm:px-5 shrink-0 gap-x-4 gap-y-2">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onBack} aria-label="Back to form layouts" className={iconButton}>
          <i className="ph-bold ph-arrow-left text-lg"></i>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="bg-orange-100 text-orange-600 text-[0.65rem] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">Layout Editor</span>
            {dirty ? (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Unsaved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                <i className="ph-bold ph-check"></i> Saved
              </span>
            )}
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
        <button
          onClick={onPreview}
          disabled={!canPreview}
          title={canPreview ? "Open the real form with these unsaved changes" : "Preview is available for the Job and Transaction forms"}
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors disabled:opacity-40"
        >
          <i className="ph-bold ph-eye"></i> Preview
        </button>
        <button onClick={onPreview} disabled={!canPreview} aria-label="Preview" className={`sm:hidden ${iconButton}`}>
          <i className="ph-bold ph-eye text-lg"></i>
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className={`px-5 py-2 font-semibold text-sm rounded-lg transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 ${
            dirty ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <i className="ph-bold ph-check"></i>}
          Save Layout
        </button>
      </div>
    </div>
  );
}
