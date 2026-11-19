import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { fiyesFileName, fiyesForm, parsePeriod, returnTitle } from "@/lib/fiyes";
import { fiyesWorkbookBuffer, returnData } from "@/server/lib/fiyes-workbook";

// GET /api/fiyes/2026-10/F01 — one form of a return, as the exact Fiyes
// template with this return's cells filled in, ready to upload.
export async function GET(_request: Request, { params }: { params: Promise<{ period: string; form: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session, PERMISSIONS.FIYES_READ)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { period, form: code } = await params;
  const p = parsePeriod(period);
  const form = fiyesForm(code.toUpperCase());
  if (!p || !form) return NextResponse.json({ error: "Unknown period or form" }, { status: 400 });
  if (form.kind !== p.kind) {
    return NextResponse.json({ error: `${form.title} isn't part of the ${returnTitle(p)}.` }, { status: 400 });
  }

  const signatory = { select: { name: true, designation: true } } as const;
  const ret = await prisma.fiyesReturn.findUnique({
    where: { period },
    include: { enteredBy: signatory, approvedBy: signatory, payables: { orderBy: { position: "asc" } } },
  });
  if (!ret) return NextResponse.json({ error: `No return for ${period}` }, { status: 404 });

  try {
    const buffer = await fiyesWorkbookBuffer(returnData(ret), form);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fiyesFileName(form, p, "xlsx")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Fiyes workbook error:", error);
    return NextResponse.json({ error: "Failed to generate the Excel file" }, { status: 500 });
  }
}
