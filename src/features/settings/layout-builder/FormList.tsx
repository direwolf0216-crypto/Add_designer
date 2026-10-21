"use client";

import type { ReactNode } from "react";
import type { FormLayout } from "@/lib/layout-builder/types";

interface FormListProps {
  layouts: FormLayout[];
  onOpen: (formKey: string) => void;
  onCreateClick: () => void;
  /** Rendered inside the card (the "Create New Form" dialog). */
  children?: ReactNode;
}

/** View 1: grid of all form layouts. */
export default function FormList({ layouts, onOpen, onCreateClick, children }: FormListProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-[750px] flex flex-col">
      <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Form Layouts</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage and customize your data entry forms.</p>
        </div>
        <button
          onClick={onCreateClick}
          className="px-5 py-2.5 bg-orange-500 text-white font-semibold text-sm rounded-xl hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-2"
        >
          <i className="ph-bold ph-plus"></i> Create Form
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <span>{layout.schema.sections?.length || 0} Sections</span>
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
