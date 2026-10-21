// Job queue priorities, most urgent first (the same order the database sorts them in). Isomorphic.

export const PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_STYLE: Record<Priority, { label: string; icon: string; hex: string }> = {
  URGENT: { label: "Urgent", icon: "ph-fire", hex: "#e11d48" },
  HIGH: { label: "High", icon: "ph-arrow-fat-up", hex: "#f97316" },
  NORMAL: { label: "Normal", icon: "ph-equals", hex: "#64748b" },
  LOW: { label: "Low", icon: "ph-arrow-fat-down", hex: "#0ea5e9" },
};

export const isPriority = (v: unknown): v is Priority => typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
