import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { buildRegister } from "@/server/lib/petty-cash-registry";

// GET /api/petty-cash/export/2026 — the year's register in the layout of the
// org's petty cash registry workbook (server/lib/petty-cash-registry.ts).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> },
) {
  const { year } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.PETTYCASH_EXPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: "Invalid year format" }, { status: 400 });
  }

  try {
    const workbook = await buildRegister(prisma, Number(year));
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=petty_cash_register_${year}.xlsx`,
      },
    });
  } catch (error) {
    console.error("Petty cash export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel file" },
      { status: 500 },
    );
  }
}
