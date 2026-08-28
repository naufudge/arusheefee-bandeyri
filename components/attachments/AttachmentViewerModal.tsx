"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { AttachmentPreview } from "@/components/attachments/AttachmentPreview";

interface ViewerAttachment {
  id: number;
  description: string;
  originalName: string | null;
  mimeType: string | null;
}

interface AttachmentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The attachment to display. `null` while the modal is closed. */
  attachment: ViewerAttachment | null;
}

/**
 * Inline attachment viewer modal. `AttachmentPreview` picks the right
 * renderer for the file type — an `<iframe>` for PDFs (the browser's
 * native viewer handles scroll / zoom / page-nav) or an `<img>` for
 * images. It keys on the attachment id, so opening a different
 * attachment forces a fresh load rather than showing the cached src.
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
        {/* `min-h-0` lets this flex child shrink below its content —
            without it an image overflows the `h-[90vh]` dialog. */}
        {attachment && (
          <div className="min-h-0 flex-1 bg-muted/30">
            <AttachmentPreview attachment={attachment} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
