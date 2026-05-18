import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { deleteFile, getFileStream } from "@/lib/sharepoint";

// Reference types governed by the generic `attachment:*` permissions.
const GENERIC_REFERENCE_TYPES = new Set(["pv", "petty_cash"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id: numericId },
  });
  if (!attachment || !attachment.sharepointFileName) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // `attachment:read` covers download for the generic types. Other ref
  // types are owned by their own routes (signatures via /api/profile/
  // signature) and rarely flow through this endpoint.
  if (
    GENERIC_REFERENCE_TYPES.has(attachment.reference_type) &&
    !hasPermission(session, "attachment:read")
  ) {
    return NextResponse.json(
      { error: "Missing permission: attachment:read" },
      { status: 403 },
    );
  }

  try {
    const stream = await getFileStream(attachment.sharepointFileName);
    const headers = new Headers({
      "Content-Type": attachment.mimeType ?? stream.contentType,
      "Content-Disposition": `inline; filename="${attachment.originalName ?? attachment.sharepointFileName}"`,
    });
    if (stream.contentLength) headers.set("Content-Length", stream.contentLength);
    return new Response(stream.body, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json(
      { error: "Failed to fetch file", detail: message },
      { status: 502 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id: numericId },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Generic `attachment:delete` gate. No longer tied to parent-record
  // state — anyone with this permission can remove evidence regardless
  // of whether the parent PV/petty cash is locked. Workflow lock is
  // about voucher data integrity; attachments are evidence and
  // managed separately.
  if (
    GENERIC_REFERENCE_TYPES.has(attachment.reference_type) &&
    !hasPermission(session, "attachment:delete")
  ) {
    return NextResponse.json(
      { error: "Missing permission: attachment:delete" },
      { status: 403 },
    );
  }

  // Try SharePoint first; if it fails, log but still delete the row so we
  // don't end up with a DB row whose file the user can't reach. An orphan
  // file in SharePoint is the lesser evil.
  if (attachment.sharepointFileName) {
    try {
      await deleteFile(attachment.sharepointFileName);
    } catch (err) {
      console.error(
        "[attachment DELETE] SharePoint delete failed, removing DB row anyway:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  await prisma.attachment.delete({ where: { id: numericId } });
  return NextResponse.json({ success: true });
}
