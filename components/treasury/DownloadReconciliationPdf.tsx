"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatNumberWithCommas } from "@/utils/helpers";
import { formatDmy, asOfTitle } from "@/lib/week";
import type { TreasuryWeeklyData } from "@/components/treasury/TreasuryWeeklyPdf";

interface DownloadReconciliationPdfProps {
  reportNum: string;
  withLabel?: boolean;
}

const num = (n: number | null | undefined) => (typeof n === "number" ? n : 0);
const fmt = (n: number | null | undefined) => formatNumberWithCommas(num(n));
// Negative figures are shown in brackets, accounting-style: -120 → "(120.00)".
const bracket = (n: number) => `(${formatNumberWithCommas(Math.abs(n))})`;
const fmtSigned = (n: number) => (n < 0 ? bracket(n) : fmt(n));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transform(r: any): TreasuryWeeklyData {
  const sig = r.signatures ?? {};
  const weekStart = new Date(r.weekStart);
  const weekEnd = new Date(r.weekEnd);
  const prevDay = new Date(weekStart);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);

  // Ledger: opening balance, then per row the net effect (deposited −
  // withdrawn) on the balance. Withdrawals show bracketed in both the ނެގި
  // and ބާކީ columns. The ބާކީ column sums to the closing balance.
  const opening = num(r.openingBalance);
  let totalWithdrawn = 0;
  let totalDeposited = 0;
  const itemRows = (r.items ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (it: any) => {
      const w = num(it.withdrawn);
      const d = 0; // per-item deposits aren't tracked yet
      totalWithdrawn += w;
      totalDeposited += d;
      return {
        date: formatDmy(new Date(it.date)),
        details: it.details || it.detailsEn || "",
        deposited: d ? fmt(d) : "-",
        withdrawn: bracket(w),
        balance: fmtSigned(d - w),
      };
    },
  );

  const transactions = [
    {
      date: formatDmy(prevDay),
      details: "ކުރީ ހަފްތާ ރިޕޯޓުގެ ބާކީ",
      deposited: "-",
      withdrawn: "-",
      balance: fmt(opening),
    },
    ...itemRows,
  ];

  const closingBalance = opening + totalDeposited - totalWithdrawn;
  const totals = {
    deposited: totalDeposited ? fmt(totalDeposited) : "-",
    withdrawn: bracket(totalWithdrawn),
    balance: fmtSigned(closingBalance),
  };

  const breakdown = [
    { label: "ނަގުދުން ހުރި ފައިސާ", value: fmtSigned(num(r.cashInHand)) },
    {
      label: "އ/ކ ނަމްބަރ 1155 ން އަނބުރާ ޖަމާކުރުމަށް",
      value: fmtSigned(num(r.redepositAcc1155)),
    },
    { label: "މުވައްޒަފުންގެ ގަޑީލާރި", value: fmtSigned(num(r.staffWages)) },
    { label: "ކޮއްތާއި އެލަވަންސް", value: fmtSigned(num(r.foodAllowance)) },
    { label: "ޗެކުން ހުރި", value: fmtSigned(num(r.heldInCheque)) },
    { label: "ބިލަށް ދައްކަންޖެހޭ ޖުމްލަ", value: fmtSigned(num(r.totalPayable)) },
    { label: "ޖުމްލަ", value: fmtSigned(num(r.total)) },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dvName = (s: any) => s?.dhivehiName || s?.name || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dvDesig = (s: any) => s?.dhivehiDesignation || s?.designation || "";

  return {
    number: r.reportNum,
    periodText: r.periodText,
    asOfTitle: asOfTitle(weekEnd),
    minRows: 8,
    transactions,
    totals,
    breakdown,
    // ނަގުދު ހުރި (cash held) reflects the ބާކީ closing balance.
    cashHeld: fmtSigned(closingBalance),
    chequeHeld: fmtSigned(num(r.chequeHeld)),
    total: fmtSigned(closingBalance + num(r.chequeHeld)),
    // DOM order left→right: Authorized, Checked, Prepared.
    signatories: [
      {
        role: "އޮތޮރައިޒް ކުރީ",
        name: dvName(r.authorizedBy),
        designation: dvDesig(r.authorizedBy),
        signature: sig.authorizedBy ?? null,
      },
      {
        role: "ޗެކްކުރީ",
        name: dvName(r.checkedBy),
        designation: dvDesig(r.checkedBy),
        signature: sig.checkedBy ?? null,
      },
      {
        role: "ތިޖޫރީއާ ޙަވާލުވެ ހުރި/ތައްޔާރުކުރީ",
        name: dvName(r.preparedBy),
        designation: dvDesig(r.preparedBy),
        signature: sig.preparedBy ?? null,
      },
    ],
  };
}

const DownloadReconciliationPdf: React.FC<DownloadReconciliationPdfProps> = ({
  reportNum,
  withLabel,
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await queryClient.fetchQuery(
        trpc.pcRecon.pdfPayload.queryOptions({ reportNum }),
      );

      const [{ pdf }, { default: TreasuryWeeklyPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/treasury/TreasuryWeeklyPdf"),
      ]);

      const blob = await pdf(
        <TreasuryWeeklyPdf data={transform(data)} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reconciliation_${reportNum.replace(/\//g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Download PDF
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Download PDF"
      onClick={handleDownload}
      disabled={busy}
      className="transition hover:text-foreground disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
    </button>
  );
};

export default DownloadReconciliationPdf;
