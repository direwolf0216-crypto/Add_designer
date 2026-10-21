"use client";

import type { SectionEdits } from "@/lib/layout-builder/reducer";
import type { FormLayout } from "@/lib/layout-builder/types";
import type { BuilderDrag } from "./useBuilderDrag";
import SectionCard from "./SectionCard";

interface BuilderCanvasProps {
  layout: FormLayout;
  selectedFieldId: string | null;
  drag: BuilderDrag;
  onAddSection: () => void;
  onUpdateSection: (sectionId: string, updates: SectionEdits) => void;
  onSectionIconChange: (sectionId: string, icon: string) => void;
  onRemoveSection: (sectionId: string) => void;
  onAddField: (sectionId: string) => void;
  onSelectField: (fieldId: string | null) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
}

/** Center column: WYSIWYG representation of the form. Clicking the background clears the selection. */
export default function BuilderCanvas({
  layout,
  selectedFieldId,
  drag,
  onAddSection,
  onUpdateSection,
  onSectionIconChange,
  onRemoveSection,
  onAddField,
  onSelectField,
  onRemoveField,
}: BuilderCanvasProps) {
  const sections = layout.schema.sections;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-10 relative bg-white" onClick={() => onSelectField(null)}>
      <div className="max-w-[850px] mx-auto flex flex-col gap-6 lg:gap-8 pb-20">
        {(!sections || sections.length === 0) ? (
          <div className="border-2 border-dashed border-gray-200 bg-slate-50/50 rounded-2xl p-16 text-center shadow-sm">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
              <i className="ph ph-layout text-3xl text-slate-400"></i>
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg mb-2">No Sections Yet</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">Start building your form by adding a section. Sections help group related fields together logically.</p>
            <button onClick={(e) => { e.stopPropagation(); onAddSection(); }} className="px-5 py-2.5 bg-orange-100 text-orange-700 font-bold text-sm rounded-xl hover:bg-orange-200 transition-colors">
              Add First Section
            </button>
          </div>
        ) : (
          sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              selectedFieldId={selectedFieldId}
              drag={drag}
              onUpdate={(updates) => onUpdateSection(section.id, updates)}
              onIconChange={(icon) => onSectionIconChange(section.id, icon)}
              onRemove={() => onRemoveSection(section.id)}
              onAddField={() => onAddField(section.id)}
              onSelectField={onSelectField}
              onRemoveField={(fieldId) => onRemoveField(section.id, fieldId)}
            />
          ))
        )}
      </div>
    </div>
  );
}
