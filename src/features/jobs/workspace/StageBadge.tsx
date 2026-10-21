import { stageHex } from "./stageStyle";

export default function StageBadge({ stage, color, size = "sm" }: { stage: string; color?: string; size?: "sm" | "xs" }) {
  const hex = stageHex(color);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-bold ${size === "xs" ? "px-2 py-0.5 text-[0.65rem]" : "px-2.5 py-1 text-[0.7rem]"}`}
      style={{ backgroundColor: `${hex}14`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}33` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
      <span className="truncate">{stage}</span>
    </span>
  );
}
