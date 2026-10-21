"use client";

import { useReducer, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { toast } from "sonner";
import { asList, fetcher } from "@/lib/swr";
import { DEFAULT_LAYOUTS } from "@/lib/defaultLayouts";
import { FIXED_OPTIONS_FIELD_ID } from "@/lib/layout-builder/fieldTypes";
import {
  findSelectedField,
  getActiveLayout,
  initialLayoutBuilderState,
  layoutBuilderReducer,
  type SectionEdits,
} from "@/lib/layout-builder/reducer";
import type { FieldPosition, FormField, FormLayout } from "@/lib/layout-builder/types";

/** Timestamp-based id for new sections/fields; only called from event handlers. */
const newLayoutId = (prefix: string) => `${prefix}_${Date.now()}`;

export interface UsageModalData {
  formKey: string;
  fieldId: string;
  oldValue: string;
  availableOptions: string[];
  inUseCount: number;
}

export interface BuilderUser {
  id: string;
  name: string;
  role: string;
  roleName?: string;
}

export function useLayoutBuilder() {
  const [state, dispatch] = useReducer(layoutBuilderReducer, initialLayoutBuilderState);
  const [saving, setSaving] = useState(false);

  const { data: usersData } = useSWR("/api/users", fetcher);
  const allUsers = asList<BuilderUser>(usersData);

  // Safe deletion of pick-list options that existing records still use.
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [usageModalData, setUsageModalData] = useState<UsageModalData | null>(null);
  const [migrationValue, setMigrationValue] = useState("");
  const [migrating, setMigrating] = useState(false);

  // Layouts are edited as a local draft: seed it once from the first successful load. Later revalidations
  // (e.g. the globalMutate after a save) must not clobber unsaved edits.
  const { data: dbLayouts, error: layoutsError } = useSWR<FormLayout[]>("/api/settings/layouts", fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    onError: () => toast.error("Failed to load form layouts"),
  });
  if (!state.seeded && Array.isArray(dbLayouts)) {
    dispatch({ type: "seed", defaults: DEFAULT_LAYOUTS as unknown as FormLayout[], fromServer: dbLayouts });
  }
  const loading = !state.seeded && !layoutsError;

  const activeLayout = getActiveLayout(state);
  const selected = findSelectedField(state);
  const selectedField = selected?.field ?? null;
  const selectedSectionId = selected?.sectionId ?? null;

  const handleSave = async () => {
    if (!activeLayout) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/layouts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeLayout),
      });
      if (!res.ok) throw new Error("Failed to save layout");
      toast.success(`${activeLayout.name} saved successfully!`);
      globalMutate(`/api/settings/layouts/${activeLayout.formKey}`);
      globalMutate(`/api/settings/layouts`);
    } catch {
      toast.error("Failed to save layout");
    } finally {
      setSaving(false);
    }
  };

  // --- Navigation / selection ---
  const openForm = (formKey: string) => dispatch({ type: "openForm", formKey });
  const closeForm = () => dispatch({ type: "closeForm" });
  const selectField = (fieldId: string | null) => dispatch({ type: "selectField", fieldId });

  const createForm = (name: string, description: string) => {
    const formKey = name.toUpperCase().replace(/[^A-Z0-9]/g, "_") + "_" + Date.now();
    dispatch({ type: "createForm", formKey, name, description });
  };

  // --- Sections ---
  const addSection = () => dispatch({ type: "addSection", id: newLayoutId("sec") });
  const updateSection = (sectionId: string, updates: SectionEdits) => dispatch({ type: "updateSection", sectionId, updates });
  const setSectionIcon = (sectionId: string, icon: string) => dispatch({ type: "setSectionIcon", sectionId, icon });
  const removeSection = (sectionId: string) => dispatch({ type: "removeSection", sectionId });
  const moveSection = (sourceId: string, targetId: string) => dispatch({ type: "moveSection", sourceId, targetId });

  // --- Fields ---
  const addField = (sectionId: string, fieldType: string = "SINGLE_LINE", index?: number) =>
    dispatch({ type: "addField", sectionId, fieldType, id: newLayoutId("field"), index });
  const moveField = (from: FieldPosition, toSectionId: string, toIndex: number) =>
    dispatch({ type: "moveField", from, toSectionId, toIndex });
  const removeField = (sectionId: string, fieldId: string) => dispatch({ type: "removeField", sectionId, fieldId });
  const updateSelectedField = (updates: Partial<FormField>) => dispatch({ type: "updateSelectedField", updates });

  // --- Option removal with usage check / migration ---
  const handleRemoveOption = async (idx: number) => {
    if (!activeLayout || !selectedField || !selectedField.options || !selectedSectionId) return;
    if (selectedField.id === FIXED_OPTIONS_FIELD_ID) {
      // INCOME / EXPENSE drive every financial report and are a database enum.
      toast.error("Transaction type options are fixed and can't be removed.");
      return;
    }
    const options = selectedField.options;
    const oldValue = options[idx];
    const target = { sectionId: selectedSectionId, fieldId: selectedField.id };

    setCheckingUsage(true);
    try {
      const res = await fetch("/api/settings/layouts/check-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formKey: activeLayout.formKey, fieldId: selectedField.id, value: oldValue }),
      });
      const data = await res.json();
      if (data.inUse) {
        setUsageModalData({
          formKey: activeLayout.formKey,
          fieldId: selectedField.id,
          oldValue,
          inUseCount: data.count,
          availableOptions: options.filter((o) => o !== oldValue),
        });
      } else {
        const newOpts = options.filter((_, i) => i !== idx);
        dispatch({ type: "updateField", ...target, updates: { options: newOpts } });
      }
    } catch {
      toast.error("Failed to check usage");
    } finally {
      setCheckingUsage(false);
    }
  };

  const handleMigrateOption = async () => {
    if (!usageModalData || !migrationValue) return;
    const newOpts = (selectedField?.options || []).filter((o) => o !== usageModalData.oldValue);
    const target = selectedField && selectedSectionId ? { sectionId: selectedSectionId, fieldId: selectedField.id } : null;
    setMigrating(true);
    try {
      const res = await fetch("/api/settings/layouts/migrate-value", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...usageModalData, newValue: migrationValue }),
      });
      if (res.ok) {
        toast.success("Successfully migrated existing records!");
        if (target) dispatch({ type: "updateField", ...target, updates: { options: newOpts } });
        setUsageModalData(null);
        setMigrationValue("");
      } else {
        throw new Error("Failed to migrate");
      }
    } catch {
      toast.error("Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  return {
    layouts: state.layouts,
    loading,
    saving,
    allUsers,
    activeLayout,
    selectedFieldId: state.selectedFieldId,
    selectedField,
    selectedSectionId,
    handleSave,
    openForm,
    closeForm,
    selectField,
    createForm,
    addSection,
    updateSection,
    setSectionIcon,
    removeSection,
    moveSection,
    addField,
    moveField,
    removeField,
    updateSelectedField,
    // option removal / migration
    checkingUsage,
    usageModalData,
    setUsageModalData,
    migrationValue,
    setMigrationValue,
    migrating,
    handleRemoveOption,
    handleMigrateOption,
  };
}

export type LayoutBuilderApi = ReturnType<typeof useLayoutBuilder>;
