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

/**
 * How strongly a job card is tinted with its priority colour (hex alpha for the border, the wash and
 * the accent bar). Normal cards stay plain so the others stand out.
 */
export const PRIORITY_TINT: Record<Priority, { border: string; wash: string; bar: string } | null> = {
  URGENT: { border: "66", wash: "1A", bar: "FF" },
  HIGH: { border: "55", wash: "14", bar: "E6" },
  NORMAL: null,
  LOW: { border: "40", wash: "0D", bar: "99" },
};
