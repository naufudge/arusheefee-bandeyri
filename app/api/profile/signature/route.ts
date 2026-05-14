import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildSharePointFileName,
  deleteFile,
  getFileStream,
  uploadFile,
} from "@/lib/sharepoint";

const SIGNATURE_REF_TYPE = "staff_signature";

async function findCurrent(staffId: string) {
  return prisma.attachment.findFirst({
    where: { reference_type: SIGNATURE_REF_TYPE, reference_id: staffId },
    orderBy: { createdAt: "desc" },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const current = await findCurrent(session.user.id);
  if (!current?.sharepointFileName) {
    return NextResponse.json({ error: "No signature" }, { status: 404 });
  }

  try {
    const stream = await getFileStream(current.sharepointFileName);
    const headers = new Headers({
      "Content-Type": current.mimeType ?? stream.contentType,
      "Cache-Control": "no-store",
    });
    if (stream.contentLength) headers.set("Content-Length", stream.contentLength);
    return new Response(stream.body, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json(
      { error: "Failed to fetch signature", detail: message },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const originalName = searchParams.get("filename");
  if (!originalName?.trim()) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }

  const mimeType = request.headers.get("content-type") ?? "";
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json(
      { error: "Signature must be an image" },
      { status: 400 },
    );
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await request.arrayBuffer();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[profile/signature POST] arrayBuffer() threw:", err);
    return NextResponse.json(
      { error: "Could not read request body", detail: message },
      { status: 400 },
    );
  }
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: "Empty image body" }, { status: 400 });
  }

  const staffId = session.user.id;
  const sharepointFileName = buildSharePointFileName({
    referenceType: SIGNATURE_REF_TYPE,
    referenceId: staffId,
    originalName,
  });

  // Remove the previous signature (if any) before writing the new one so we
  // don't accumulate orphans in SharePoint or carry two rows in the DB.
  const previous = await findCurrent(staffId);

  try {
    const result = await uploadFile(
      { buffer, mimeType },
      { name: sharepointFileName },
    );

    if (previous) {
      if (previous.sharepointFileName) {
        try {
          await deleteFile(previous.sharepointFileName);
        } catch (err) {
          console.error(
            "[profile/signature POST] SharePoint delete of previous failed:",
            err instanceof Error ? err.message : err,
          );
        }
      }
      await prisma.attachment.delete({ where: { id: previous.id } });
    }

    const attachment = await prisma.attachment.create({
      data: {
        description: "Signature",
        mimeType,
        originalName,
        sharepointFileName,
        sharepointUrl: result.webUrl,
        createdById: staffId,
        reference_id: staffId,
        reference_type: SIGNATURE_REF_TYPE,
      },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { error: "An error occurred uploading signature", detail: message },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await findCurrent(session.user.id);
  if (!current) {
    return NextResponse.json({ error: "No signature" }, { status: 404 });
  }

  if (current.sharepointFileName) {
    try {
      await deleteFile(current.sharepointFileName);
    } catch (err) {
      console.error(
        "[profile/signature DELETE] SharePoint delete failed, removing DB row anyway:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  await prisma.attachment.delete({ where: { id: current.id } });
  return NextResponse.json({ success: true });
}
