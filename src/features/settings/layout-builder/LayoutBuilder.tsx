"use client";

import { useCallback, useEffect, useState } from "react";
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
import RemoveFieldDialog from "./RemoveFieldDialog";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import LayoutPreviewDialog, { PREVIEWABLE_FORMS } from "./LayoutPreviewDialog";

const isTypingTarget = (el: EventTarget | null) => {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    node.isContentEditable
  );
};

/**
 * Settings → Layouts & Fields: list of form layouts, and a full-height workbench for one layout:
 * palette · canvas · properties, with undo/redo, live preview, an unsaved-changes guard and delete protection.
 */
export default function LayoutBuilder() {
  const builder = useLayoutBuilder();
  const { activeLayout, selectedField, dirty } = builder;

  const drag = useBuilderDrag({
    onInsertNewField: (sectionId, fieldType, index) =>
      builder.addField(sectionId, fieldType, index),
    onMoveField: builder.moveField,
    onMoveSection: builder.moveSection,
  });

  const [showNewFormModal, setShowNewFormModal] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormDescription, setNewFormDescription] = useState("");
  const [leavePrompt, setLeavePrompt] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  const handleCreateForm = () => {
    if (!newFormName) return;
    builder.createForm(newFormName, newFormDescription);
    setShowNewFormModal(false);
    setNewFormName("");
    setNewFormDescription("");
  };

  // Leaving the editor with unsaved edits asks first; closing the tab gets the browser's own prompt.
  const requestBack = () => {
    if (dirty) setLeavePrompt(true);
    else builder.closeForm();
  };
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ⌘Z / ⌃Z undo, ⇧⌘Z / ⌃Y redo, ⌘S save — outside text inputs, where the browser's own undo applies.
  const { undo, redo, handleSave } = builder;
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void handleSave();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo, handleSave],
  );
  useEffect(() => {
    if (!activeLayout) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeLayout, onKeyDown]);

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
      <FormList
        layouts={builder.layouts}
        onOpen={builder.openForm}
        onCreateClick={() => setShowNewFormModal(true)}
      >
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

  const canPreview = PREVIEWABLE_FORMS.has(activeLayout.formKey);
  const formNoun =
    activeLayout.formKey === "TRANSACTION_FORM" ? "transaction" : "job";

  // --- View 2: Workbench ---
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col font-sans lg:h-[calc(100dvh-140px)] lg:min-h-[560px]">
      <EditorHeader
        title={activeLayout.name}
        saving={builder.saving}
        dirty={dirty}
        canUndo={builder.canUndo}
        canRedo={builder.canRedo}
        canPreview={canPreview}
        onBack={requestBack}
        onSave={() => void builder.handleSave()}
        onUndo={builder.undo}
        onRedo={builder.redo}
        onPreview={() =>
          canPreview
            ? setPreviewOpen(true)
            : toast.info(
                "Preview is available for the Job and Transaction forms.",
              )
        }
      />

      <div className="flex flex-col lg:flex-row flex-1 lg:min-h-0 lg:overflow-hidden bg-slate-50">
        <FieldPalette
          onDragTypeStart={drag.setDraggedNewFieldType}
          onDragTypeEnd={() => drag.setDraggedNewFieldType(null)}
          onAddField={(fieldType) => {
            if (
              !activeLayout.schema.sections ||
              activeLayout.schema.sections.length === 0
            ) {
              toast.error("Please add a section first!");
              return;
            }
            builder.addField(activeLayout.schema.sections[0].id, fieldType);
          }}
          onAddSection={builder.addSection}
        />

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
          onRemoveField={(sectionId, fieldId) =>
            void builder.requestRemoveField(sectionId, fieldId)
          }
          onDuplicateField={builder.duplicateField}
        />

        <PropertiesPanel
          layout={activeLayout}
          field={selectedField}
          sectionId={builder.selectedSectionId}
          users={builder.allUsers}
          onChange={builder.updateSelectedField}
          onRemoveOption={builder.handleRemoveOption}
          checkingUsage={builder.checkingUsage}
          onRoleChange={(role) => selectedField && builder.setFieldRole(selectedField.id, role)}
          onSelectField={builder.selectField}
          onDuplicate={() =>
            selectedField &&
            builder.selectedSectionId &&
            builder.duplicateField(builder.selectedSectionId, selectedField.id)
          }
          onArchive={(archived) =>
            selectedField &&
            builder.selectedSectionId &&
            builder.setFieldArchived(
              builder.selectedSectionId,
              selectedField.id,
              archived,
            )
          }
          onRemove={() =>
            selectedField &&
            builder.selectedSectionId &&
            void builder.requestRemoveField(
              builder.selectedSectionId,
              selectedField.id,
            )
          }
          removing={
            !!selectedField && builder.checkingField === selectedField.id
          }
          onClose={() => builder.selectField(null)}
        />
      </div>

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

      <RemoveFieldDialog
        prompt={builder.removePrompt}
        formNoun={formNoun}
        onArchive={() => {
          builder.setFieldArchived(
            builder.removePrompt!.sectionId,
            builder.removePrompt!.fieldId,
            true,
          );
          builder.setRemovePrompt(null);
          toast.success("Field archived. Save the layout to apply it.");
        }}
        onDelete={() => {
          builder.removeField(
            builder.removePrompt!.sectionId,
            builder.removePrompt!.fieldId,
          );
          builder.setRemovePrompt(null);
        }}
        onCancel={() => builder.setRemovePrompt(null)}
      />

      <UnsavedChangesDialog
        open={leavePrompt}
        saving={builder.saving}
        onSave={async () => {
          const ok = await builder.handleSave();
          if (ok) {
            setLeavePrompt(false);
            builder.closeForm();
          }
        }}
        onDiscard={() => {
          setLeavePrompt(false);
          builder.closeForm();
        }}
        onCancel={() => setLeavePrompt(false)}
      />

      {canPreview && (
        <LayoutPreviewDialog
          layout={activeLayout}
          open={previewOpen}
          onClose={closePreview}
        />
      )}
    </div>
  );
}
