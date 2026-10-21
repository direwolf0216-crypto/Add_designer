"use client";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import CustomMultiDropdown from "@/components/ui/CustomMultiDropdown";
import { getAllFields } from "@/lib/layout-builder/reducer";
import type { VisibilityOperator, VisibilityRule } from "@/lib/layout-builder/types";
import type { FieldEditorProps } from "./types";

/** Older layouts stored a single `value` instead of `values`. */
type StoredVisibilityRule = VisibilityRule & { value?: string };

/** "Show conditionally": show the field only when another field matches. */
export default function VisibilityRuleEditor({ field: selectedField, layout: activeLayout, onChange: updateSelectedField }: FieldEditorProps) {
  const allFields = getAllFields(activeLayout);
  const rule = selectedField.visibilityRule as StoredVisibilityRule | undefined;

  const renderValuesInput = () => {
    const dependingField = allFields.find(f => f.id === rule?.fieldId);
    if (dependingField && dependingField.options && dependingField.options.length > 0) {
      const selectedValues = Array.isArray(rule?.values) ? rule.values : (rule?.value ? [rule.value] : []);
      return (
        <CustomMultiDropdown
          options={dependingField.options}
          value={selectedValues}
          onChange={(val) => updateSelectedField({ visibilityRule: { ...selectedField.visibilityRule!, values: Array.isArray(val) ? val : [val as string] } })}
          placeholder="Select Values..."
        />
      );
    }

    const textValues = rule?.values?.join(', ') || rule?.value || '';
    return (
      <input
        type="text"
        value={textValues}
        onChange={(e) => updateSelectedField({ visibilityRule: { ...selectedField.visibilityRule!, values: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
        placeholder="e.g. Flex Printing, Visiting Cards"
        className="w-full text-sm font-semibold text-slate-800 bg-white border border-gray-300 rounded-lg h-[40px] px-3 outline-none focus:border-orange-500 transition-all"
      />
    );
  };

  return (
    <div className="pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <label className="text-[0.75rem] font-bold text-slate-600 flex items-center gap-1">
          Conditional Visibility
        </label>
      </div>
      <div className="flex items-center gap-3 cursor-pointer group mb-3">
        <div
          onClick={() => {
            if (selectedField.visibilityRule) {
              // Leaves the key present with an undefined value; JSON.stringify drops it on save.
              updateSelectedField({ visibilityRule: undefined });
            } else {
              updateSelectedField({ visibilityRule: { fieldId: '', operator: 'EQUALS', values: [] } });
            }
          }}
          className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${selectedField.visibilityRule ? 'bg-orange-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${selectedField.visibilityRule ? 'translate-x-5' : 'translate-x-0'}`}></span>
        </div>
        <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Show conditionally</span>
      </div>

      {selectedField.visibilityRule && (
        <div className="bg-slate-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-3">
          <div>
            <label className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Depends on Field</label>
            <Select
              value={selectedField.visibilityRule.fieldId}
              onValueChange={(val) => updateSelectedField({ visibilityRule: { ...selectedField.visibilityRule!, fieldId: val || "" } })}
            >
              <SelectTrigger className="w-full text-sm font-semibold text-slate-800 bg-white border border-gray-300 rounded-lg h-[40px] px-3 outline-none focus:border-orange-500 transition-all">
                <span className="truncate flex-1 text-left">
                  {selectedField.visibilityRule?.fieldId
                    ? allFields.find(f => f.id === selectedField.visibilityRule!.fieldId)?.name || selectedField.visibilityRule.fieldId
                    : "-- Select Field --"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {allFields.filter(f => f.id !== selectedField.id).map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <div className="min-w-[120px] shrink-0">
              <label className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Operator</label>
              <Select
                value={selectedField.visibilityRule.operator}
                onValueChange={(val) => updateSelectedField({ visibilityRule: { ...selectedField.visibilityRule!, operator: val as VisibilityOperator } })}
              >
                <SelectTrigger className="w-full text-sm font-semibold text-slate-800 bg-white border border-gray-300 rounded-lg h-[40px] px-3 outline-none focus:border-orange-500 transition-all">
                  <span className="truncate flex-1 text-left">
                    {selectedField.visibilityRule?.operator === 'EQUALS' ? 'Is any of' :
                      selectedField.visibilityRule?.operator === 'NOT_EQUALS' ? 'Is not' :
                        selectedField.visibilityRule?.operator === 'CONTAINS' ? 'Contains' : 'Operator'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EQUALS">Is any of</SelectItem>
                  <SelectItem value="NOT_EQUALS">Is not</SelectItem>
                  <SelectItem value="CONTAINS">Contains</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Values</label>
              {renderValuesInput()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
