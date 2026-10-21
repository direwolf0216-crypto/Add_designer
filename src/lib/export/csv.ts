// Small CSV helpers. `downloadCsv` needs a browser; the rest is pure.

/** Quote a cell: always wrapped in double quotes; empty / nullish becomes `""`; objects are JSON. */
export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined || val === "") return '""';
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/** Join pre-escaped cells into CSV text (rows separated by `\n`). */
export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.join(",")).join("\n");
}

/** Trigger a browser download of `content` as a UTF-8 CSV (with BOM so Excel detects the encoding). */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
