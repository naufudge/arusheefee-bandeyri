/**
 * Attachment file-type classification, shared by the preview UI and the
 * PDF bundler so the two can't drift apart.
 *
 * `mimeType` comes straight from the browser-reported `Content-Type`
 * header at upload (`app/api/attachment/route.ts`), so it's usually
 * right but can be empty or `application/octet-stream`. The filename
 * extension is the backstop — `buildSharePointFileName` preserves it.
 *
 * Format support downstream (see `lib/pdf-bundle.ts`):
 *   - pdf-lib native: JPEG, and non-interlaced 8-bit PNG.
 *   - Canvas-convertible in-browser: webp, gif (first frame), bmp, avif,
 *     svg, interlaced/16-bit PNG, CMYK JPEG.
 *   - Usually undecodable: heic/heif and tiff outside Safari.
 * We deliberately classify those last ones as images anyway and let the
 * decode attempt fail loudly, rather than blanket-rejecting formats that
 * do work on some browsers.
 */

export type AttachmentKind = "pdf" | "image" | "other";

export type AttachmentLike = {
  mimeType?: string | null;
  originalName?: string | null;
};

/** Extensions we treat as images when the MIME type is useless. */
const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "jfif",
  "pjpeg",
  "pjp",
  "gif",
  "webp",
  "bmp",
  "avif",
  "svg",
  "tif",
  "tiff",
  "heic",
  "heif",
]);

/** Lowercased extension without the dot, or "" if there isn't one. */
export function fileExtension(name: string | null | undefined): string {
  const clean = (name ?? "").toLowerCase().split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot + 1);
}

export function getAttachmentKind(a: AttachmentLike): AttachmentKind {
  // Strip any `; charset=` suffix — the upload route stores the raw
  // request header verbatim.
  const mime = (a.mimeType ?? "").toLowerCase().split(";")[0].trim();

  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";

  // MIME was empty, `application/octet-stream`, or something bogus —
  // fall back to the filename.
  const ext = fileExtension(a.originalName);
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";

  return "other";
}

export const isPdfAttachment = (a: AttachmentLike) =>
  getAttachmentKind(a) === "pdf";

export const isImageAttachment = (a: AttachmentLike) =>
  getAttachmentKind(a) === "image";

/** Anything we can render inline — an iframe or an `<img>`. */
export const isPreviewable = (a: AttachmentLike) =>
  getAttachmentKind(a) !== "other";
