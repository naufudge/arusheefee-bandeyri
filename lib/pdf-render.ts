import type { ReactElement } from "react";

/**
 * Renders a react-pdf document to a Blob, first dropping fontkit's
 * per-font Glyph cache.
 *
 * fontkit 2.0.4 caches each Glyph by id and freezes the code points from
 * the first call. react-pdf keeps loaded fonts alive across renders in the
 * same tab, so Faruma/MVWaheed glyph objects are shared by every PDF.
 * textkit 6.3.0's bidi step then maps string positions to those stale
 * code points; for Thaana lines first laid out in a different document
 * the mapping runs past the end and `glyph.id` throws.
 *
 * Clearing `_glyphs` before each render avoids that cross-render
 * corruption. `_glyphs` is a private fontkit field, so we only reset it
 * when present and never throw from the cleanup.
 */
export async function renderPdfBlob(
  // react-pdf's `pdf()` wants DocumentProps; callers pass <Document> trees.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: ReactElement<any>,
): Promise<Blob> {
  const { pdf, Font } = await import("@react-pdf/renderer");

  try {
    const registered = Font.getRegisteredFonts() as Record<
      string,
      { sources?: { data?: { _glyphs?: unknown } | null }[] }
    >;

    for (const family of Object.values(registered)) {
      for (const source of family?.sources ?? []) {
        const data = source?.data;
        if (data && typeof data === "object" && "_glyphs" in data) {
          data._glyphs = {};
        }
      }
    }
  } catch {
    // Private API — ignore and render anyway.
  }

  return pdf(doc).toBlob();
}
