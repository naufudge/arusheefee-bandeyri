import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { formatExcelDate } from "@/lib/excel";
import ExcelJS from "exceljs";

// Petty cash register columns. Only A–I carry data; matches Sheet1 of the
// org's "Petty cash registry" workbook.
const COLUMN_CONFIG: Partial<ExcelJS.Column>[] = [
  { key: "no", header: "No.", width: 6 },
  { key: "code", header: "Code", width: 12 },
  { key: "date", header: "Date", width: 12 },
  { key: "formNo", header: "Form No", width: 16 },
  { key: "name", header: "Name", width: 26 },
  { key: "details", header: "Details", width: 44 },
  { key: "received", header: "Received", width: 12 },
  { key: "paid", header: "Paid", width: 12 },
  { key: "balance", header: "Balance", width: 14 },
];

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
    const yearNum = Number(year);
    const start = new Date(Date.UTC(yearNum, 0, 1));
    const end = new Date(Date.UTC(yearNum + 1, 0, 1));

    // Petty cash (Paid rows) + reimbursement PVs (Received rows) + the
    // stored opening balance for the year.
    const [pcs, reimbursements, openingRow] = await Promise.all([
      prisma.pettyCash.findMany({
        where: { date: { gte: start, lt: end } },
        include: { items: true, handledBy: { include: { staff: true } } },
      }),
      prisma.pV.findMany({
        where: {
          isPettyCashReimbursement: true,
          date: { gte: start, lt: end },
        },
        include: { invoices: { select: { invoiceTotal: true, comments: true } } },
      }),
      prisma.pettyCashOpeningBalance.findUnique({ where: { year: yearNum } }),
    ]);

    const opening = openingRow?.amount ?? 0;

    // A "paid" entry per petty cash record, a "received" entry per
    // reimbursement PV. Sorted by date ascending to build the running ledger.
    type Entry =
      | { kind: "paid"; date: Date; record: (typeof pcs)[number] }
      | {
          kind: "received";
          date: Date;
          record: (typeof reimbursements)[number];
        };

    const entries: Entry[] = [
      ...pcs.map((pc): Entry => ({ kind: "paid", date: pc.date, record: pc })),
      ...reimbursements.map(
        (pv): Entry => ({ kind: "received", date: pv.date, record: pv }),
      ),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Archiva";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Petty Cash Register");
    worksheet.columns = COLUMN_CONFIG;
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Opening balance row.
    let balance = opening;
    worksheet.addRow({
      no: "",
      code: "",
      date: formatExcelDate(start),
      formNo: "",
      name: "",
      details: `Opening balance as at 01.01.${year}`,
      received: opening,
      paid: "",
      balance,
    });

    let counter = 0;
    for (const entry of entries) {
      if (entry.kind === "paid") {
        const pc = entry.record;
        const paid = pc.totalRequiredAmount;
        balance -= paid;
        counter += 1;
        const details = pc.items
          .map((it) => it.name || it.nameDhivehi || "")
          .filter(Boolean)
          .join(", ");
        worksheet.addRow({
          no: counter,
          code: pc.glCode,
          date: formatExcelDate(pc.date),
          formNo: pc.pettyCashNum.replace(/-/g, "/"),
          name: pc.handledBy?.staff?.name ?? "",
          details,
          received: "",
          paid,
          balance,
        });
      } else {
        const pv = entry.record;
        const received = pv.invoices.reduce(
          (sum, inv) => sum + inv.invoiceTotal,
          0,
        );
        balance += received;
        worksheet.addRow({
          no: "",
          code: "",
          date: formatExcelDate(pv.date),
          formNo: "",
          name: "",
          details: pv.notes || "Petty Cash Reimbursement",
          received,
          paid: "",
          balance,
        });
      }
    }

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
