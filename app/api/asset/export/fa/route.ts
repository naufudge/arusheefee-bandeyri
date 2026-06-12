import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { buildFaRegisterWorkbook } from "@/lib/assetWorkbook";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.ASSET_EXPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // `year` is either "all" (default) or a 4-digit year. A specific year filters
  // by the asset's acquisition `date` using getUTCFullYear semantics, so assets
  // with no date only ever appear in the "all" export.
  const yearParam = request.nextUrl.searchParams.get("year") ?? "all";
  const isYear = /^\d{4}$/.test(yearParam);

  try {
    const where =
      isYear && yearParam !== "all"
        ? {
            date: {
              gte: new Date(Date.UTC(Number(yearParam), 0, 1)),
              lt: new Date(Date.UTC(Number(yearParam) + 1, 0, 1)),
            },
          }
        : {};

    const assets = await prisma.asset.findMany({
      where,
      orderBy: [{ assetNum: "asc" }],
    });

    const workbook = buildFaRegisterWorkbook(assets);
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = isYear
      ? `Asset Register ${yearParam}.xlsx`
      : "Asset Register (All).xlsx";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Asset FA register export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel file" },
      { status: 500 },
    );
  }
}
