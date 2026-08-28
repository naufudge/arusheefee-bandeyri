"use client";

import React, { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { getAttachmentKind } from "@/lib/attachment-kind";

export type PreviewAttachment = {
  id: number;
  description: string;
  originalName: string | null;
  mimeType: string | null;
};

/**
 * Renders a single attachment to fill its parent box.
 *
 * PDFs go in an `<iframe>` — the route serves them with
 * `Content-Disposition: inline`, so the browser's native viewer handles
 * scroll / zoom / page-nav. Images render as a centred `<img>`.
 * Anything else falls back to an "open in a new tab" card.
 *
 * The **parent owns the height**; this component is always
 * `h-full w-full`.
 */
export function AttachmentPreview({
  attachment,
}: {
  attachment: PreviewAttachment;
}) {
  // Reset on attachment change comes free from the `key` on the elements
  // below — a different id remounts them.
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const kind = getAttachmentKind(attachment);
  const src = `/api/attachment/${attachment.id}`;

  if (kind === "pdf") {
    return (
      <iframe
        key={attachment.id}
        src={src}
        title={attachment.description}
        className="h-full w-full border-0"
      />
    );
  }

  // `failed` covers formats the browser can't actually decode (a HEIC
  // outside Safari, say) — we show the placeholder rather than a broken
  // image icon.
  if (kind === "image" && !failed) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-auto p-4">
        {!loaded && (
          <Loader2 className="absolute size-5 animate-spin text-muted-foreground" />
        )}
        {/* `max-h-full` resolves against the padded content box, so the
            image can never overflow and the aspect ratio is preserved
            without setting both dimensions. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={attachment.id}
          src={src}
          alt={attachment.description}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <FileText className="size-10 text-muted-foreground/60" />
      <p className="text-sm text-muted-foreground">
        Preview isn&apos;t available for this file type.
      </p>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
      >
        <Download className="size-4" />
        Open in new tab
      </a>
    </div>
  );
}
