// Images that end up in PDFs (signatures, the office stamp) must be PNG or
// JPEG — react-pdf can't draw anything else — so check the real bytes rather
// than trusting the browser's content type.

export type PdfImageType = "image/png" | "image/jpeg";

export function detectPdfImage(bytes: Uint8Array): PdfImageType | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}
