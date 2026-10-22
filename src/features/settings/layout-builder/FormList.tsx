"use client";

import type { ReactNode } from "react";
import type { FormLayout } from "@/lib/layout-builder/types";

interface FormListProps {
  layouts: FormLayout[];
  onOpen: (formKey: string) => void;
  children?: ReactNode;
}

/** View 1: grid of all form layouts. */
export default function FormList({ layouts, onOpen, children }: FormListProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden md:h-[750px] flex flex-col">
      <div className="px-5 py-5 md:px-8 md:py-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Form Layouts</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage and customize your data entry forms.</p>
        </div>
        {/* Custom forms have nowhere to be used yet, so new forms are not offered; open a form to import, export or start from a template. */}
        <p className="shrink-0 text-[0.75rem] text-slate-500">Open a form to edit, preview, import or export it.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 md:p-8 bg-slate-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {layouts.map(layout => (
            <div
              key={layout.formKey}
              onClick={() => onOpen(layout.formKey)}
              className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-orange-300 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                <i className="ph-fill ph-layout"></i>
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg mb-1">{layout.name}</h3>
              <p className="text-sm text-slate-500 mb-4 line-clamp-2">{layout.description}</p>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                <span className="flex items-center gap-2">
                  {layout.schema.sections?.length || 0} Sections
                  {layout.publishedVersion ? <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[0.65rem] font-bold text-emerald-700">v{layout.publishedVersion} live</span> : null}
                  {layout.draftSchema ? <span className="rounded-md bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[0.65rem] font-bold text-violet-700">Draft pending</span> : null}
                </span>
                <span className="text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Edit Layout <i className="ph-bold ph-arrow-right"></i>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
