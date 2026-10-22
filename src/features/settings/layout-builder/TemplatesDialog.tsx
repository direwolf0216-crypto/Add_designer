"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { templatesFor, type LayoutTemplate } from "@/lib/layout-builder/templates";

interface TemplatesDialogProps {
  open: boolean;
  formKey: string;
  onPick: (template: LayoutTemplate) => void;
  onClose: () => void;
}

/** Ready-made layouts to start from; picking one replaces the draft (undo brings the old draft back). */
export default function TemplatesDialog({ open, formKey, onPick, onClose }: TemplatesDialogProps) {
  const templates = templatesFor(formKey);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[720px] sm:max-w-[720px] rounded-2xl p-0 overflow-hidden border-0">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-extrabold text-slate-900">Start from a template</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-600">Replaces the current draft; nothing goes live until you publish, and Undo brings your draft back.</DialogDescription>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60dvh] overflow-y-auto">
          {templates.length === 0 && <p className="text-sm text-slate-500 col-span-full">No templates for this form yet.</p>}
          {templates.map((t) => {
            const fields = t.schema.sections.reduce((n, s) => n + s.fields.length, 0);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onPick(t)}
                className="text-left rounded-2xl border border-gray-200 bg-white p-4 hover:border-orange-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-extrabold text-slate-900 text-[0.95rem] group-hover:text-orange-700">{t.name}</h4>
                  <span className="shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">{t.schema.sections.length} sections · {fields} fields</span>
                </div>
                <p className="mt-1 text-[0.8rem] text-slate-500 leading-snug">{t.description}</p>
                <ul className="mt-3 space-y-1">
                  {t.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-[0.75rem] font-semibold text-slate-600"><i className="ph-bold ph-check text-emerald-500"></i>{h}</li>
                  ))}
                </ul>
                <span className="mt-3 inline-flex items-center gap-1 text-[0.75rem] font-bold text-orange-600">Use this template <i className="ph-bold ph-arrow-right"></i></span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
