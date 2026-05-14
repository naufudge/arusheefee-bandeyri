import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  buildSharePointFileName,
  uploadFile,
} from "@/lib/sharepoint";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.ATTACHMENT_UPLOAD)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Metadata travels as URL query params; the file is the raw request body.
  // Going this route (rather than multipart/form-data) sidesteps Next.js's
  // request.formData() multipart parser, which fails on bodies > ~4 MB.
  const { searchParams } = new URL(request.url);
  const referenceType = searchParams.get("referenceType");
  const referenceId = searchParams.get("referenceId");
  const description = searchParams.get("description");
  const originalName = searchParams.get("filename");

  if (!referenceType?.trim()) {
    return NextResponse.json({ error: "referenceType is required" }, { status: 400 });
  }
  if (!referenceId?.trim()) {
    return NextResponse.json({ error: "referenceId is required" }, { status: 400 });
  }
  if (!description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (!originalName?.trim()) {
    return NextResponse.json({ error: "filename is required" }, { status: 400 });
  }

  const mimeType = request.headers.get("content-type") ?? "application/octet-stream";

  let buffer: ArrayBuffer;
  try {
    buffer = await request.arrayBuffer();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[attachment POST] arrayBuffer() threw:", err);
    return NextResponse.json(
      { error: "Could not read request body", detail: message },
      { status: 400 },
    );
  }
  if (buffer.byteLength === 0) {
    return NextResponse.json({ error: "Empty file body" }, { status: 400 });
  }

  const sharepointFileName = buildSharePointFileName({
    referenceType,
    referenceId,
    originalName,
  });

  try {
    const result = await uploadFile(
      { buffer, mimeType },
      { name: sharepointFileName },
    );

    const attachment = await prisma.attachment.create({
      data: {
        description,
        mimeType: mimeType || null,
        originalName,
        sharepointFileName,
        sharepointUrl: result.webUrl,
        createdById: session.user.id,
        reference_id: referenceId,
        reference_type: referenceType,
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json(
      { error: "An error occurred uploading file", detail: message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.ATTACHMENT_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const referenceType = searchParams.get("referenceType");
  const referenceId = searchParams.get("referenceId");

  const attachments = await prisma.attachment.findMany({
    where: {
      ...(referenceType ? { reference_type: referenceType } : {}),
      ...(referenceId ? { reference_id: referenceId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ attachments });
}
