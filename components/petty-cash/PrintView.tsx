import React from "react";
import { formatNumberWithCommas } from "@/utils/helpers";

// Minimal placeholder shape — what DownloadPdf passes in. The real petty
// cash template will replace this layout once the user provides it.
export interface PettyCashPrintData {
  pettyCashNum: string;
  date: Date | null;
  formNum: string;
  sectionUnit: string;
  totalRequiredAmount: number;
  glCode: number;
  parkedDate: Date | null;
  postingDate: Date | null;
  items: { qty: number; name: string }[];
  roles: {
    label: string;
    name: string;
    designation: string;
    amount: number | null;
    isApproved: boolean;
    date: Date | null;
  }[];
}

interface PrintViewProps {
  pettyCash: PettyCashPrintData;
}

const formatDate = (date?: Date | null) => {
  if (!date) return "";
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  try {
    return date.toLocaleDateString("en-GB", dateOptions).replace(/ /g, "-");
  } catch {
    return "";
  }
};

const PrintView: React.FC<PrintViewProps> = ({ pettyCash }) => {
  return (
    <div className="mx-5 text-[13px]">
      <div className="container m-10 pb-4 outline outline-1 mx-auto max-w-[950px] p-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="font-waheed text-[24px]">ޕެޓީ ކޭޝް ފޯމް</h1>
          <h1 className="font-bold text-lg">Petty Cash Form</h1>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border p-3">
          <Field label="Petty Cash No." value={pettyCash.pettyCashNum} />
          <Field label="Form No." value={pettyCash.formNum} />
          <Field label="Date" value={formatDate(pettyCash.date)} />
          <Field label="Section / Unit" value={pettyCash.sectionUnit} />
          <Field label="GL Code" value={String(pettyCash.glCode)} />
          <Field
            label="Total Required"
            value={`MVR ${formatNumberWithCommas(pettyCash.totalRequiredAmount)}`}
          />
        </div>

        {/* Items */}
        <div className="mt-4">
          <div className="font-bold mb-1">
            Items / <span className="font-waheed">ތަކެތި</span>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted">
                <th className="border px-2 py-1 w-16 text-center">#</th>
                <th className="border px-2 py-1 w-24 text-center">Qty</th>
                <th className="border px-2 py-1">Item</th>
              </tr>
            </thead>
            <tbody>
              {pettyCash.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="border px-2 py-1 text-center">{idx + 1}</td>
                  <td className="border px-2 py-1 text-center">{item.qty}</td>
                  <td className="border px-2 py-1">{item.name}</td>
                </tr>
              ))}
              {pettyCash.items.length === 0 && (
                <tr>
                  <td colSpan={3} className="border px-2 py-3 text-center text-muted-foreground">
                    No items recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="mt-6">
          <div className="font-bold mb-1">
            Signatures &amp; Approvals /{" "}
            <span className="font-waheed">ހުއްދަ</span>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted">
                <th className="border px-2 py-1">Role</th>
                <th className="border px-2 py-1">Name</th>
                <th className="border px-2 py-1">Designation</th>
                <th className="border px-2 py-1 text-right">Amount (MVR)</th>
                <th className="border px-2 py-1 text-center">Approved</th>
                <th className="border px-2 py-1">Date</th>
              </tr>
            </thead>
            <tbody>
              {pettyCash.roles.map((role) => (
                <tr key={role.label}>
                  <td className="border px-2 py-1 font-medium">{role.label}</td>
                  <td className="border px-2 py-1">{role.name || "—"}</td>
                  <td className="border px-2 py-1">{role.designation || "—"}</td>
                  <td className="border px-2 py-1 text-right">
                    {role.amount != null
                      ? formatNumberWithCommas(role.amount)
                      : "—"}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    {role.isApproved ? "Yes" : "No"}
                  </td>
                  <td className="border px-2 py-1">{formatDate(role.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Posting */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border p-3 text-[12px]">
          <Field label="Parked Date" value={formatDate(pettyCash.parkedDate)} />
          <Field label="Posting Date" value={formatDate(pettyCash.postingDate)} />
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex">
    <div className="w-40 font-medium">{label}:</div>
    <div className="flex-1">{value || "—"}</div>
  </div>
);

export default PrintView;
