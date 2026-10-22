"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useLayoutBuilder } from "./useLayoutBuilder";
import { useBuilderDrag } from "./useBuilderDrag";
import FormList from "./FormList";
import NewFormDialog from "./NewFormDialog";
import EditorHeader from "./EditorHeader";
import FieldPalette from "./FieldPalette";
import BuilderCanvas from "./BuilderCanvas";
import PropertiesPanel from "./PropertiesPanel";
import MigrateOptionDialog from "./MigrateOptionDialog";

/** Settings → Layouts & Fields: list of form layouts, and a 3-column drag-and-drop editor for one layout. */
export default function LayoutBuilder() {
  const builder = useLayoutBuilder();
  const { activeLayout, selectedField } = builder;

  const drag = useBuilderDrag({
    onInsertNewField: (sectionId, fieldType, index) => builder.addField(sectionId, fieldType, index),
    onMoveField: builder.moveField,
    onMoveSection: builder.moveSection,
  });

  const [showNewFormModal, setShowNewFormModal] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormDescription, setNewFormDescription] = useState("");

  const handleCreateForm = () => {
    if (!newFormName) return;
    builder.createForm(newFormName, newFormDescription);
    setShowNewFormModal(false);
    setNewFormName("");
    setNewFormDescription("");
  };

  if (builder.loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 flex items-center justify-center text-slate-400">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-orange-500 rounded-full animate-spin mr-3"></div>
        Loading Layouts...
      </div>
    );
  }

  // --- View 1: List of Forms ---
  if (!activeLayout) {
    return (
      <FormList layouts={builder.layouts} onOpen={builder.openForm} onCreateClick={() => setShowNewFormModal(true)}>
        {showNewFormModal && (
          <NewFormDialog
            name={newFormName}
            description={newFormDescription}
            onNameChange={setNewFormName}
            onDescriptionChange={setNewFormDescription}
            onCancel={() => setShowNewFormModal(false)}
            onCreate={handleCreateForm}
          />
        )}
      </FormList>
    );
  }

  // --- View 2: Form Editor (3-Column Layout) ---
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden lg:h-[850px] flex flex-col font-sans">

      {/* Top Header */}
      <EditorHeader title={activeLayout.name} saving={builder.saving} onBack={builder.closeForm} onSave={builder.handleSave} />

      <div className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden bg-slate-50">

        {/* Left Column: Palette */}
        <FieldPalette
          onDragTypeStart={drag.setDraggedNewFieldType}
          onDragTypeEnd={() => drag.setDraggedNewFieldType(null)}
          onAddField={(fieldType) => {
            if (!activeLayout.schema.sections || activeLayout.schema.sections.length === 0) {
              toast.error("Please add a section first!");
              return;
            }
            builder.addField(activeLayout.schema.sections[0].id, fieldType);
          }}
          onAddSection={builder.addSection}
        />

        {/* Center Column: Canvas (WYSIWYG Form Representation) */}
        <BuilderCanvas
          layout={activeLayout}
          selectedFieldId={builder.selectedFieldId}
          drag={drag}
          onAddSection={builder.addSection}
          onUpdateSection={builder.updateSection}
          onSectionIconChange={builder.setSectionIcon}
          onRemoveSection={builder.removeSection}
          onAddField={(sectionId) => builder.addField(sectionId)}
          onSelectField={builder.selectField}
          onRemoveField={builder.removeField}
        />

        {/* Right Column: Properties Panel */}
        <PropertiesPanel
          layout={activeLayout}
          field={selectedField}
          sectionId={builder.selectedSectionId}
          users={builder.allUsers}
          onChange={builder.updateSelectedField}
          onRemoveOption={builder.handleRemoveOption}
          checkingUsage={builder.checkingUsage}
          onClose={() => builder.selectField(null)}
        />
      </div>

      {/* Migration Modal */}
      {builder.usageModalData && (
        <MigrateOptionDialog
          data={builder.usageModalData}
          value={builder.migrationValue}
          onValueChange={builder.setMigrationValue}
          migrating={builder.migrating}
          onCancel={() => builder.setUsageModalData(null)}
          onConfirm={builder.handleMigrateOption}
        />
      )}

    </div>
  );
}
