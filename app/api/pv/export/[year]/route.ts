import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import ExcelJS from "exceljs";

// Column configuration
const COLUMN_CONFIG: Partial<ExcelJS.Column>[] = [
  { key: "date", header: "Date", width: 12 },
  { key: "pvNum", header: "Voucher No", width: 20 },
  { key: "documentNum", header: "Document No", width: 15 },
  { key: "poNum", header: "Po No", width: 12 },
  { key: "invoiceNumber", header: "Invoice / Ref No", width: 18 },
  { key: "vendor", header: "Vendor", width: 30 },
  { key: "details", header: "Details", width: 40 },
  { key: "code", header: "GL Code", width: 12 },
  { key: "total", header: "Total", width: 12 },
  { key: "parkedDate", header: "Parked Date", width: 12 },
  { key: "postingDate", header: "Posting Date", width: 12 },
  { key: "paymentMethod", header: "Payment Method C/FT/LT", width: 22 },
  { key: "clearingDocDate", header: "Clearing Document Date", width: 20 },
  { key: "clearingDocNum", header: "Clearing Document No", width: 20 },
  { key: "transferNum", header: "Local Transfer No / Cheque No", width: 28 },
];

function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ year: string }> }
) {
  const { year } = await params;

  // Auth + permission gate
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session, PERMISSIONS.PV_EXPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate year
  if (!/^\d{4}$/.test(year)) {
    return NextResponse.json({ error: "Invalid year format" }, { status: 400 });
  }

  try {
    // Fetch PVs for the year
    const pvs = await prisma.pV.findMany({
      where: {
        pvNum: {
          contains: year,
        },
      },
      include: {
        invoices: {
          include: {
            glDetails: true,
          },
        },
      },
      orderBy: { pvNum: "asc" },
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Archiva";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("PV Register");
    worksheet.columns = COLUMN_CONFIG;

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Flatten data: one row per GL detail
    for (const pv of pvs) {
      for (const invoice of pv.invoices) {
        for (const gl of invoice.glDetails) {
          worksheet.addRow({
            date: formatDate(pv.date),
            pvNum: `1506/${pv.pvNum.replace(/-/g, "/")}`,
            documentNum: invoice.documentNum || "",
            poNum: pv.poNum || "",
            invoiceNumber: invoice.invoiceNumber || "",
            vendor: pv.vendor,
            details: invoice.comments,
            code: gl.code,
            total: gl.amount,
            parkedDate: formatDate(pv.parkedDate),
            postingDate: formatDate(pv.postingDate),
            paymentMethod: pv.paymentMethod,
            clearingDocDate: formatDate(pv.clearingDocDate),
            clearingDocNum: pv.clearingDocNum || "",
            transferNum: pv.transferNum || "",
          });
        }
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=pv_register_${year}.xlsx`,
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel file" },
      { status: 500 }
    );
  }
}
