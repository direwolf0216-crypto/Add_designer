import { asText, type FieldProps } from "./types";
import { capitalizeFirst, capitalizeInput, capitalizesFirst } from "@/lib/forms/capitalize";

export default function TextAreaField({ field, value, onChange, register, error, variant }: FieldProps) {
  // Multi-line text starts with a capital letter as it's typed.
  const cap = capitalizesFirst(field);
  if (variant === "transaction") {
    return (
      <textarea
        value={asText(value)}
        onChange={(e) => onChange(cap ? capitalizeFirst(e.target.value) : e.target.value)}
        placeholder={field.placeholder || `Enter ${field.name}...`}
        className={`w-full bg-white rounded-xl border p-4 outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-orange-500/20 shadow-sm transition-all resize-none h-[90px] ${error ? "border-red-400" : "border-slate-200 focus:border-orange-400"}`}
      />
    );
  }

  // Starts one line tall, like the other fields, so the icon sits centred beside the text, and grows
  // with what's typed (up to about eight lines, then it scrolls).
  const fit = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 220)}px`;
  };
  return (
    <textarea
      rows={1}
      className={`flex min-h-[45px] max-h-[220px] w-full resize-none rounded-xl border bg-white pl-11 pr-4 py-[10px] text-[0.95rem] leading-[1.45] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${error ? "border-red-500" : "border-gray-200"}`}
      {...(register ?? { value: asText(value) })}
      onChange={(e) => {
        if (cap) capitalizeInput(e.currentTarget);
        // Registered on the main form; inside a repeated job card it's controlled instead.
        return register ? register.onChange(e) : onChange(e.currentTarget.value);
      }}
      ref={(el) => {
        register?.ref(el);
        fit(el);
      }}
      onInput={(e) => fit(e.currentTarget)}
      placeholder={field.placeholder || `Enter ${field.name}...`}
    />
  );
}
