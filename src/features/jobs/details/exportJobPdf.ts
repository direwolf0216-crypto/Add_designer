import { format } from "date-fns";
import type { FieldMap, FormLayout } from "@/lib/forms/types";
import { pricingUnitLabel, type PricingRules } from "@/lib/jobs/pricing";
import { isCancelStage, readCancellation, refundDue } from "@/lib/jobs/cancellation";
import {
  dynamicFieldValue,
  resolveDynamicSections,
  resolveFinancials,
  resolveJobSummary,
  resolveSpecEntries,
  type DetailsJob,
} from "@/lib/jobs/resolveJobFields";

const SKIP_TYPES = new Set(["FILE", "IMAGE"]);

/** Readable text for a form value (dates, lists and objects included). */
function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.map(text).filter((v) => v !== "-").join(", ") || "-";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    return String(o.name ?? o.label ?? o.title ?? "-");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

const money = (n: number) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A laid-out PDF of the job: header, client, job details, financials and any other layout sections as
 * tables. Built from the data, not a screenshot, so it lines up at any screen size and is searchable.
 */
export async function exportJobPdf(job: DetailsJob, layout: FormLayout | null, fieldMap: FieldMap, showAmounts: boolean, rules: PricingRules = {}, shopName = "Add designer") {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const summary = resolveJobSummary(job, layout, fieldMap);
  const specs = resolveSpecEntries(job, layout, fieldMap, summary, rules);
  const financials = resolveFinancials(job);
  const jobNo = job.jobNumber || `#${job.id.slice(-6).toUpperCase()}`;
  const client = job.client?.name || job.title || job.customData?.fld_b_client || "Client";
  const category = summary.displayCategory && !["N/A", "-"].includes(summary.displayCategory) ? summary.displayCategory : "";

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const slate = [15, 23, 42] as const;
  const muted = [100, 116, 139] as const;

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 92, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(String(client), margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text([category, jobNo].filter(Boolean).join("  ·  "), margin, 60);
  doc.setFontSize(9);
  doc.text(`${shopName}  ·  Job summary  ·  ${format(new Date(), "d MMM yyyy, h:mm a")}`, margin, 78);
  // Status pill, right-aligned
  const status = job.status || "Pending";
  doc.setFontSize(10);
  const pillW = doc.getTextWidth(status) + 24;
  doc.setFillColor(249, 115, 22);
  doc.roundedRect(pageW - margin - pillW, 28, pillW, 22, 11, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.text(status, pageW - margin - pillW / 2, 43, { align: "center" });

  // Key facts strip
  const facts: [string, string][] = [
    ["Job ID", jobNo],
    ["Category", category || "Not specified"],
    ["Created on", format(new Date(job.createdAt), "dd MMM yyyy, hh:mm a")],
    ["Due date", summary.dueDateVal ? format(new Date(summary.dueDateVal), "dd MMM yyyy") : "Not set"],
  ];
  const colW = (pageW - margin * 2) / facts.length;
  facts.forEach(([label, value], i) => {
    const x = margin + i * colW;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(label.toUpperCase(), x, 118);
    doc.setFontSize(10.5);
    doc.setTextColor(...slate);
    doc.text(value, x, 134, { maxWidth: colW - 10 });
  });
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 148, pageW - margin, 148);

  let y = 164;
  const table = (title: string, rows: string[][], head?: string[]) => {
    if (!rows.length) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...slate);
    doc.text(title, margin, y);
    autoTable(doc, {
      startY: y + 8,
      margin: { left: margin, right: margin },
      head: head ? [head] : undefined,
      body: rows,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9.5, cellPadding: 6, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.6, overflow: "linebreak" },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: "bold" },
      columnStyles: head ? {} : { 0: { cellWidth: 170, textColor: [100, 116, 139] }, 1: { fontStyle: "bold" } },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 24;
  };

  table("Client information", [
    ["Client name / company", text(client)],
    ["Phone number", text(job.client?.phone || job.phone || job.customData?.fld_b_phone)],
    ["Email address", text(job.client?.email || job.email || job.customData?.fld_b_email)],
    ...(job.location ? [["Delivery location", text(job.location)]] : []),
  ]);

  if (specs.length <= 1) {
    const e = specs[0];
    table("Job details", e ? [
      ...(e.category ? [["Category", text(e.category)]] : []),
      ["Size", e.area ? `${text(e.size)} (${e.area.toLocaleString("en-IN")} ${pricingUnitLabel(e.unit)})` : text(e.size)],
      ["Quantity", text(e.quantity)],
      ...(showAmounts && e.rateLabel !== "N/A" ? [["Rate", e.rateLabel]] : []),
      ...(showAmounts && e.total !== null ? [["Total", money(e.total)]] : []),
    ] : []);
  } else {
    table(
      "Job details",
      specs.map((e, i) => [String(i + 1), text(e.category), text(e.size), text(e.quantity), ...(showAmounts ? [e.rateLabel === "N/A" ? "-" : e.rateLabel, e.total === null ? "-" : money(e.total)] : [])]),
      ["#", "Category", "Size", "Quantity", ...(showAmounts ? ["Rate", "Total"] : [])],
    );
  }

  if (showAmounts) {
    const cancelled = isCancelStage(job.status) || isCancelStage(job.customData?.fld_b_status);
    const cancellation = cancelled ? readCancellation(job.customData) : null;
    table("Financials", [
      ["Total amount", money(financials.totalAmount)],
      [`Advance paid${financials.paymentMethod && financials.paymentMethod !== "N/A" ? ` (${financials.paymentMethod})` : ""}`, money(financials.advanceAmount)],
      ...(cancelled
        ? [["Cancellation charge", money(cancellation?.charge ?? 0)], ["Refund due to client", money(refundDue(financials.advanceAmount, cancellation?.charge ?? 0))]]
        : [["Outstanding balance", money(financials.dueAmount)]]),
    ]);
  }

  for (const { section, globalFields, itemFields, entries } of resolveDynamicSections(job, layout)) {
    const keep = (f: { type: string }) => !SKIP_TYPES.has(String(f.type));
    const globals = globalFields.filter(keep).map((f) => [f.name, text(dynamicFieldValue(job, f, fieldMap, job.customData))]);
    const items = itemFields.filter(keep);
    const rows = entries.flatMap((entry, i) => items.map((f) => [entries.length > 1 ? `${f.name} (item ${i + 1})` : f.name, text(dynamicFieldValue(job, f, fieldMap, entry))]));
    table(section.title || "Details", [...globals, ...rows]);
  }

  if (job.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...slate);
    doc.text("Notes", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(String(job.notes), pageW - margin * 2), margin, y + 16);
  }

  // Footer with page numbers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${shopName} · ${jobNo}`, margin, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Page ${p} of ${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }

  doc.save(`Job_${jobNo.replace(/[^A-Za-z0-9-]+/g, "_")}.pdf`);
}
