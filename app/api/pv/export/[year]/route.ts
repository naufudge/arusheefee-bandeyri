import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { toMvrRounded } from "@/utils/currency";
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
    // Fetch PVs and Petty Cash records for the year in parallel.
    // Year is matched against the document number (substring) which is the
    // same convention the original PV export used; petty cash mirrors it
    // since pettyCashNum carries the year (e.g. PC/01/2025).
    const [pvs, pcs] = await Promise.all([
      prisma.pV.findMany({
        where: { pvNum: { contains: year } },
        include: { invoices: { include: { glDetails: true } } },
      }),
      prisma.pettyCash.findMany({
        where: { pettyCashNum: { contains: year } },
        include: { items: true },
      }),
    ]);

    // Combine into a single date-sorted list. PVs explode into one row
    // per GL detail (multi-row records stay grouped because they share a
    // parent date). PCs contribute exactly one row each.
    type Entry =
      | { kind: "pv"; date: Date; record: (typeof pvs)[number] }
      | { kind: "pc"; date: Date; record: (typeof pcs)[number] };

    const entries: Entry[] = [
      ...pvs.map((pv): Entry => ({ kind: "pv", date: pv.date, record: pv })),
      ...pcs.map((pc): Entry => ({ kind: "pc", date: pc.date, record: pc })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

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

    for (const entry of entries) {
      if (entry.kind === "pv") {
        const pv = entry.record;
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
              // GL amounts are held in the PV's document currency; the
              // register reports MVR. Rounded per line because the sheet
              // stores the raw float, not a formatted string.
              total: toMvrRounded(gl.amount, pv.exchangeRate),
              parkedDate: formatDate(pv.parkedDate),
              postingDate: formatDate(pv.postingDate),
              paymentMethod: pv.paymentMethod,
              clearingDocDate: formatDate(pv.clearingDocDate),
              clearingDocNum: pv.clearingDocNum || "",
              transferNum: pv.transferNum || "",
            });
          }
        }
      } else {
        // PC row: items rendered "Name (qty), Name (qty), …". Columns
        // that don't apply to petty cash (vendor, PO, payment method,
        // clearing doc, transfer) are left blank.
        const pc = entry.record;
        const details = pc.items
          .map((it) => `${it.name} (${it.qty})`)
          .join(", ");
        worksheet.addRow({
          date: formatDate(pc.date),
          // Legacy records were stored with dashes (PC-08-2025); the
          // canonical export shape uses slashes (PC/08/2025).
          pvNum: pc.pettyCashNum.replace(/-/g, "/"),
          documentNum: "",
          poNum: "",
          invoiceNumber: "",
          vendor: "",
          details,
          code: pc.glCode,
          total: pc.totalRequiredAmount,
          parkedDate: formatDate(pc.parkedDate),
          postingDate: formatDate(pc.postingDate),
          paymentMethod: "",
          clearingDocDate: "",
          clearingDocNum: "",
          transferNum: "",
        });
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
