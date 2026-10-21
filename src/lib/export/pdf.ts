// PDF table export. jspdf / jspdf-autotable are imported on demand to keep them out of page bundles.

export interface PdfTableSection {
  /** Heading printed above the table (ignored for the first table, which sits under the title). */
  heading?: string;
  head: string[][];
  body: string[][];
}

/**
 * Save a PDF with a title and one or more tables. The first table starts under the title; each later
 * table gets a 12pt heading 10pt below the previous table and starts 15pt below it.
 */
export async function saveTablesPdf(filename: string, title: string, sections: PdfTableSection[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.text(title, 14, 15);

  sections.forEach((section, i) => {
    if (i === 0) {
      autoTable(doc, { head: section.head, body: section.body, startY: 20 });
      return;
    }
    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 20;
    doc.setFontSize(12);
    if (section.heading) doc.text(section.heading, 14, finalY + 10);
    autoTable(doc, { head: section.head, body: section.body, startY: finalY + 15 });
  });

  doc.save(filename);
}
