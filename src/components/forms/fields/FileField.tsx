import FileAttachment from "@/components/ui/FileAttachment";
import type { FieldProps } from "./types";

export default function FileField({ field, name, value, onChange, context }: FieldProps) {
  return (
    <FileAttachment
      id={name}
      type={field.type as "IMAGE" | "FILE"}
      value={value}
      onChange={(vals: unknown[]) => onChange(vals)}
      driveStatus={context?.driveStatus}
      moduleName={context?.moduleName || ""}
      categoryName={context?.categoryName}
    />
  );
}
