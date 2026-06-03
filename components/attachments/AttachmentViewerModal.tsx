"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface ViewerAttachment {
  id: number;
  description: string;
  originalName: string | null;
}

interface AttachmentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The attachment to display. `null` while the modal is closed. */
  attachment: ViewerAttachment | null;
}

/**
 * Inline PDF viewer modal. The browser's native PDF viewer handles
 * scroll / zoom / page-nav inside an `<iframe>` pointed at
 * `/api/attachment/{id}` — the route serves the file with
 * `Content-Disposition: inline`, which is what makes the browser
 * render rather than download.
 *
 * The `key` on the iframe is the attachment id, so opening a different
 * attachment forces a fresh iframe load (browsers cache the previous
 * src otherwise).
 */
export function AttachmentViewerModal({
  open,
  onOpenChange,
  attachment,
}: AttachmentViewerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-0 p-0 sm:rounded-md">
        <div className="flex items-baseline justify-between gap-3 border-b px-6 py-4 pr-12">
          <DialogTitle className="truncate text-base font-semibold">
            {attachment?.description ?? "Attachment"}
          </DialogTitle>
          {attachment?.originalName && (
            <span className="truncate text-xs text-muted-foreground">
              {attachment.originalName}
            </span>
          )}
        </div>
        {attachment && (
          <iframe
            key={attachment.id}
            src={`/api/attachment/${attachment.id}`}
            title={attachment.description}
            className="h-full w-full flex-1 border-0"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
