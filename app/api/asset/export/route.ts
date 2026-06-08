import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { buildAssetWorkbook } from "@/lib/assetWorkbook";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.ASSET_EXPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const assets = await prisma.asset.findMany({
      orderBy: [{ assetType: "asc" }, { assetNum: "asc" }],
    });

    const workbook = buildAssetWorkbook(assets);
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=asset_register.xlsx",
      },
    });
  } catch (error) {
    console.error("Asset export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel file" },
      { status: 500 },
    );
  }
}
