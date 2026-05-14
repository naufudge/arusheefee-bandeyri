import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { deleteFile, getFileStream } from "@/lib/sharepoint";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.ATTACHMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  if (!hasPermission(session, PERMISSIONS.ATTACHMENT_DELETE)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
