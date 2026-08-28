import { PDFDocument, type PDFImage } from "pdf-lib";
import { getAttachmentKind } from "@/lib/attachment-kind";

export type AttachmentMeta = {
  id: number;
  mimeType: string | null;
  originalName: string | null;
  createdAt?: string | Date;
};

export type BundleResult = {
  blob: Blob;
  /** Attachments we tried to include but couldn't. */
  errors: string[];
  /** Attachments we never attempt — .docx, .xlsx, .zip and friends. */
  skipped: string[];
};

/** A4 in PDF points. */
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 24;

/**
 * Images larger than this are re-encoded through a canvas rather than
 * passed through untouched, to keep the bundle from ballooning. Raise
 * for more fidelity, lower for smaller downloads.
 */
const MAX_PASSTHROUGH_BYTES = 3_000_000;

/** Longest edge after canvas downscaling — ~200 DPI on A4. */
const MAX_DIM = 2400;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The stored `mimeType` is whatever the browser sent at upload, so the
 * bytes are the only reliable source of truth here.
 */
function sniffImageFormat(b: Uint8Array): "png" | "jpeg" | null {
  if (b.length >= 8 && PNG_SIGNATURE.every((v, i) => b[i] === v)) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "jpeg";
  }
  return null;
}

/**
 * pdf-lib's PNG embedder handles neither Adam7-interlaced nor 16-bit
 * PNGs. The IHDR chunk sits at a fixed offset (8 signature + 4 length +
 * 4 type + 13 data), which puts bit depth at byte 24 and the interlace
 * flag at byte 28.
 */
function pngNeedsReencode(b: Uint8Array): boolean {
  return b.length < 29 || b[24] === 16 || b[28] !== 0;
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch {
    // Safari quirks and SVG go through an <img> element instead.
    return await new Promise<DecodedImage>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () =>
        resolve({
          source: img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          release: () => URL.revokeObjectURL(url),
        });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("image decode failed"));
      };
      img.src = url;
    });
  }
}

/**
 * Decode via the browser and re-encode as JPEG. Covers everything
 * pdf-lib can't take directly (webp, gif, bmp, avif, svg, interlaced or
 * 16-bit PNG, CMYK JPEG) plus oversized photos.
 */
async function reencodeViaCanvas(
  bytes: Uint8Array,
  mimeHint: string | null,
): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart], {
    type: mimeHint || "application/octet-stream",
  });
  const decoded = await decodeImage(blob);

  try {
    if (!decoded.width || !decoded.height) {
      throw new Error("zero-dimension image");
    }

    const scale = Math.min(
      1,
      MAX_DIM / Math.max(decoded.width, decoded.height),
    );
    const w = Math.max(1, Math.round(decoded.width * scale));
    const h = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d context unavailable");

    // Flatten alpha onto white first — a PDF page has no transparency
    // backdrop, so an un-flattened transparent PNG renders black in
    // some viewers.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(decoded.source, 0, 0, w, h);

    // JPEG rather than PNG: re-encoding a 12MP photo as PNG would add
    // tens of megabytes. `toBlob` throws on a tainted canvas (SVG, in
    // some engines), which is reported as a per-attachment error.
    const out = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.92),
    );
    if (!out) throw new Error("canvas encode failed");
    return new Uint8Array(await out.arrayBuffer());
  } finally {
    decoded.release();
  }
}

async function embedImageBytes(
  doc: PDFDocument,
  bytes: Uint8Array,
  mimeHint: string | null,
): Promise<PDFImage> {
  const format = sniffImageFormat(bytes);
  const oversize = bytes.byteLength > MAX_PASSTHROUGH_BYTES;

  if (!oversize) {
    try {
      if (format === "jpeg") return await doc.embedJpg(bytes);
      if (format === "png" && !pngNeedsReencode(bytes)) {
        return await doc.embedPng(bytes);
      }
    } catch {
      // Fall through to the canvas path.
    }
  }

  return doc.embedJpg(await reencodeViaCanvas(bytes, mimeHint));
}

/** One A4 page per image, scaled to fit and centred. */
function appendImagePage(doc: PDFDocument, image: PDFImage) {
  // Orient the page to the image so a landscape photo isn't letterboxed
  // into a portrait page at half scale.
  const landscape = image.width > image.height;
  const pageW = landscape ? A4_HEIGHT : A4_WIDTH;
  const pageH = landscape ? A4_WIDTH : A4_HEIGHT;
  const page = doc.addPage([pageW, pageH]);

  // A single uniform scale factor preserves the aspect ratio by
  // construction.
  const scale = Math.min(
    (pageW - PAGE_MARGIN * 2) / image.width,
    (pageH - PAGE_MARGIN * 2) / image.height,
  );
  const drawW = image.width * scale;
  const drawH = image.height * scale;

  // pdf-lib's origin is bottom-left, but centring is symmetric so the
  // same expression works on both axes.
  page.drawImage(image, {
    x: (pageW - drawW) / 2,
    y: (pageH - drawH) / 2,
    width: drawW,
    height: drawH,
  });
}

/**
 * Append every previewable attachment to the given base PDF Blob and
 * return the merged Blob. PDFs are copied page-for-page; images become
 * one A4 page each, scaled to fit and centred.
 *
 * Nothing disappears silently: attachments we can't embed at all
 * (.docx, .xlsx, …) come back in `skipped`, and ones that fail to fetch
 * or decode come back in `errors`. The merge still succeeds for the
 * rest, so the caller can surface both and still hand over a PDF.
 *
 * Bundle order is **chronological** — sorted by ascending id, which is
 * auto-increment and therefore stable even when `createdAt` ties on a
 * bulk upload.
 */
export async function bundleAttachmentsIntoPdf(
  baseBlob: Blob,
  attachments: AttachmentMeta[],
): Promise<BundleResult> {
  const label = (a: AttachmentMeta) =>
    a.originalName ?? `attachment ${a.id}`;

  const ordered = attachments.slice().sort((a, b) => a.id - b.id);
  const mergeable = ordered.filter((a) => getAttachmentKind(a) !== "other");
  const skipped = ordered
    .filter((a) => getAttachmentKind(a) === "other")
    .map(label);

  if (mergeable.length === 0) {
    return { blob: baseBlob, errors: [], skipped };
  }

  const errors: string[] = [];
  const mergedDoc = await PDFDocument.load(await baseBlob.arrayBuffer());

  // Sequential on purpose — this bounds peak memory to roughly one
  // attachment at a time plus the growing document.
  for (const att of mergeable) {
    try {
      const res = await fetch(`/api/attachment/${att.id}`);
      if (!res.ok) {
        errors.push(label(att));
        continue;
      }
      const bytes = new Uint8Array(await res.arrayBuffer());

      if (getAttachmentKind(att) === "pdf") {
        const src = await PDFDocument.load(bytes);
        const pages = await mergedDoc.copyPages(src, src.getPageIndices());
        pages.forEach((p) => mergedDoc.addPage(p));
      } else {
        appendImagePage(
          mergedDoc,
          await embedImageBytes(mergedDoc, bytes, att.mimeType),
        );
      }
    } catch {
      errors.push(label(att));
    }
  }

  const bytes = await mergedDoc.save();
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    errors,
    skipped,
  };
}
