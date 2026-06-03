import { PDFDocument } from "pdf-lib";

export type AttachmentMeta = {
  id: number;
  mimeType: string | null;
  originalName: string | null;
  createdAt?: string | Date;
};

/**
 * Append every PDF attachment in `attachments` to the given base PDF
 * Blob and return the merged Blob. Non-PDF attachments are silently
 * skipped (product decision: bundle = PDFs only). If a particular
 * attachment fails to fetch or parse, it's skipped and the caller
 * receives a list of error descriptions to surface (the merge still
 * succeeds for the rest).
 *
 * Bundle order is **oldest first**: the list endpoint orders by
 * `createdAt desc`, but for an evidence pack a chronological read
 * makes more sense, so we reverse before merging.
 */
export async function bundleAttachmentsIntoPdf(
  baseBlob: Blob,
  attachments: AttachmentMeta[],
): Promise<{ blob: Blob; errors: string[] }> {
  const pdfs = attachments
    .filter(
      (a) =>
        a.mimeType === "application/pdf" ||
        (a.originalName ?? "").toLowerCase().endsWith(".pdf"),
    )
    // Newest-first → oldest-first; reverse a shallow copy so we don't
    // mutate the caller's list.
    .slice()
    .reverse();

  if (pdfs.length === 0) {
    return { blob: baseBlob, errors: [] };
  }

  const errors: string[] = [];
  const mergedDoc = await PDFDocument.load(await baseBlob.arrayBuffer());

  for (const att of pdfs) {
    try {
      const res = await fetch(`/api/attachment/${att.id}`);
      if (!res.ok) {
        errors.push(att.originalName ?? `attachment ${att.id}`);
        continue;
      }
      const buf = await res.arrayBuffer();
      const src = await PDFDocument.load(buf);
      const pages = await mergedDoc.copyPages(src, src.getPageIndices());
      pages.forEach((p) => mergedDoc.addPage(p));
    } catch {
      errors.push(att.originalName ?? `attachment ${att.id}`);
    }
  }

  const bytes = await mergedDoc.save();
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    errors,
  };
}
