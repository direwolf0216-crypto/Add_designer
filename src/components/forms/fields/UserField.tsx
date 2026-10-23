import UserPicklist from "@/components/ui/UserPicklist";
import MultiUserPicklist from "@/components/ui/MultiUserPicklist";
import { filterUsersForField } from "@/lib/forms/options";
import { asText, type FieldProps } from "./types";

/** USER_PICKLIST (single id) or MULTI_USER_PICKLIST (comma-separated ids). */
export default function UserField({ field, value, onChange, error, context, multiple }: FieldProps & { multiple: boolean }) {
  const filteredUsers = filterUsersForField(context?.users || [], field.userPicklistConfig);
  const Picklist = multiple ? MultiUserPicklist : UserPicklist;

  return (
    <Picklist
      users={filteredUsers}
      value={asText(value)}
      onChange={(val) => onChange(val)}
      placeholder={field.placeholder || `Select ${field.name}...`}
      error={!!error}
      showAvailability={field.userPicklistConfig?.showAvailability}
      className="pl-11"
    />
  );
}
