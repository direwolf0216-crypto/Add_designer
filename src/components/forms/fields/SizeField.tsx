import { useState } from "react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { composeSize, isAreaUnit, splitSize, unitsFor } from "@/lib/jobs/size";
import type { FieldProps } from "./types";

/** Size input with a unit picker (units come from the layout field); the value is stored as "3 x 6 ft". */
export default function SizeField({ field, value, onChange, error, variant }: FieldProps) {
  const units = unitsFor(field);
  const parsed = splitSize(value, field);
  // A unit picked before any dimensions are typed has nothing to attach to yet, so it waits here.
  const [pendingUnit, setPendingUnit] = useState<string | null>(null);
  const dims = parsed.dims;
  const unit = dims ? parsed.unit : pendingUnit ?? parsed.unit;
  const options = units.includes(unit) ? units : [unit, ...units];
  const pickUnit = (u: string) => {
    setPendingUnit(u);
    onChange(composeSize(dims, u));
  };
  const transaction = variant === "transaction";

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="new-password"
        value={dims}
        onChange={(e) => onChange(composeSize(e.target.value, unit))}
        placeholder={field.placeholder || (isAreaUnit(unit) ? "e.g. 10" : "e.g. 3 x 6")}
        aria-label={field.name}
        className={`flex h-[45px] w-full rounded-xl border bg-white ${transaction ? "pl-4" : "pl-11"} pr-[5.25rem] py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 ${
          transaction ? "focus-visible:ring-orange-500 shadow-sm" : "focus-visible:ring-blue-500"
        } ${error ? "border-red-500" : "border-gray-200"}`}
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center">
        <CustomDropdown
          options={options}
          value={unit}
          onChange={pickUnit}
          className="h-8 w-auto min-w-[4.25rem] gap-1 rounded-lg border-violet-200 bg-violet-50 px-2.5 py-0 text-[0.8rem] font-bold text-violet-700 hover:border-violet-300 focus:ring-violet-400"
        />
      </div>
    </div>
  );
}
